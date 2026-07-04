"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Person, Transaction, TransactionSplit } from "@/lib/types";
import { BottomNav } from "@/components/BottomNav";
import { Icon, Plus, X, ChevronLeft, Trash2, Check } from "@/components/Icon";
import { formatMoney, formatShortMoney } from "@/lib/format";
import { openAmount } from "@/lib/splits";

const COLORS = ["#0A84FF", "#2FD6A8", "#FF6B6B", "#FFB020", "#7C6AE0", "#64748B"];

export default function PeoplePage() {
  const supabase = createClient();
  const [people, setPeople] = useState<Person[]>([]);
  const [splits, setSplits] = useState<TransactionSplit[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  async function loadAll() {
    const [{ data: p }, { data: s }, { data: t }] = await Promise.all([
      supabase.from("people").select("*").eq("is_archived", false).order("created_at"),
      supabase.from("transaction_splits").select("*"),
      supabase.from("transactions").select("*"),
    ]);
    setPeople(p || []);
    setSplits(s || []);
    setTxs(t || []);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const splitsByPerson = useMemo(() => {
    const map: Record<string, TransactionSplit[]> = {};
    for (const s of splits) {
      map[s.person_id] = map[s.person_id] || [];
      map[s.person_id].push(s);
    }
    return map;
  }, [splits]);

  function openBalance(personId: string) {
    return (splitsByPerson[personId] || []).reduce((sum, s) => sum + Math.max(openAmount(s), 0), 0);
  }

  function txOf(id: string) {
    return txs.find((t) => t.id === id);
  }

  async function markSettled(split: TransactionSplit) {
    await supabase
      .from("transaction_splits")
      .update({ settled_amount: split.amount, settled_at: new Date().toISOString() })
      .eq("id", split.id);
    loadAll();
  }

  async function setPartial(split: TransactionSplit, value: string) {
    const n = Number(value);
    if (Number.isNaN(n) || n < 0) return;
    await supabase
      .from("transaction_splits")
      .update({ settled_amount: n, settled_at: n >= Number(split.amount) ? new Date().toISOString() : null })
      .eq("id", split.id);
    loadAll();
  }

  async function archivePerson(p: Person) {
    if (!confirm(`Biztosan archiválod "${p.name}"-t?`)) return;
    await supabase.from("people").update({ is_archived: true }).eq("id", p.id);
    loadAll();
  }

  return (
    <main className="min-h-dvh px-5 pb-32 max-w-lg mx-auto">
      <div className="flex items-center gap-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] mb-5">
        <Link href="/settings" className="w-9 h-9 rounded-full glass flex items-center justify-center">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <h1 className="font-display font-semibold text-2xl">Személyek</h1>
      </div>

      <div className="space-y-3 mb-5">
        {people.map((p) => {
          const balance = openBalance(p.id);
          const personSplits = (splitsByPerson[p.id] || [])
            .slice()
            .sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
          const expanded = expandedId === p.id;
          return (
            <div key={p.id} className="glass rounded-4xl overflow-hidden">
              <div className="w-full flex items-center gap-2 px-4 py-3.5">
                <button
                  onClick={() => setExpandedId(expanded ? null : p.id)}
                  className="flex-1 flex items-center gap-3 text-left min-w-0"
                >
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: `${p.color}22` }}
                  >
                    <Icon name="users" className="w-4.5 h-4.5" style={{ color: p.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{p.name}</p>
                    <p className="text-xs text-slate-400">{balance > 0 ? "Nyitott elszámolás" : "Elszámolva"}</p>
                  </div>
                  {balance > 0 ? (
                    <p className="font-mono tabular text-sm font-semibold text-coral shrink-0">
                      {formatShortMoney(balance)}
                    </p>
                  ) : (
                    <Check className="w-4 h-4 text-mint-dark shrink-0" />
                  )}
                </button>
                <button
                  onClick={() => archivePerson(p)}
                  className="w-8 h-8 rounded-full bg-coral/10 text-coral flex items-center justify-center shrink-0"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {expanded && (
                <div className="divide-y divide-slate-500/10 border-t border-slate-500/10">
                  {personSplits.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-4">Még nincs hozzá tétel.</p>
                  ) : (
                    personSplits.map((s) => {
                      const tx = txOf(s.transaction_id);
                      const open = openAmount(s);
                      return (
                        <div key={s.id} className="px-4 py-3 flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-slate-500 truncate">
                              {tx
                                ? new Intl.DateTimeFormat("hu-HU", { month: "short", day: "numeric" }).format(
                                    new Date(tx.occurred_on)
                                  )
                                : ""}
                              {tx?.note ? ` · ${tx.note}` : ""}
                            </p>
                            <p className="font-mono tabular text-sm font-semibold mt-0.5">
                              {formatMoney(Number(s.amount), tx?.currency)}
                              {Number(s.settled_amount) > 0 && (
                                <span className="text-xs text-slate-400 font-normal ml-1">
                                  ({formatMoney(Number(s.settled_amount), tx?.currency)} rendezve)
                                </span>
                              )}
                            </p>
                          </div>
                          {open > 0 ? (
                            <div className="flex items-center gap-1.5 shrink-0">
                              <input
                                type="number"
                                placeholder="részlet"
                                defaultValue=""
                                onBlur={(e) => e.target.value && setPartial(s, e.target.value)}
                                className="w-20 px-2 py-1.5 rounded-xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-xs font-mono tabular"
                              />
                              <button
                                onClick={() => markSettled(s)}
                                className="px-2.5 py-1.5 rounded-xl bg-mint/10 text-mint-dark text-xs font-medium shrink-0"
                              >
                                Elszámolva
                              </button>
                            </div>
                          ) : (
                            <Check className="w-4 h-4 text-mint-dark shrink-0" />
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          );
        })}
        {people.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-8">Még nincs felvéve személy.</p>
        )}
      </div>

      <button
        onClick={() => setFormOpen(true)}
        className="w-full py-3 rounded-2xl border border-dashed border-slate-400/40 text-sm text-slate-500 flex items-center justify-center gap-1.5"
      >
        <Plus className="w-4 h-4" /> Új személy hozzáadása
      </button>

      {formOpen && (
        <PersonForm
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            loadAll();
          }}
        />
      )}

      <BottomNav />
    </main>
  );
}

function PersonForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const supabase = createClient();
  const [name, setName] = useState("");
  const [color, setColor] = useState(COLORS[0]);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await supabase.from("people").insert({ user_id: user.id, name, color });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md glass-strong rounded-t-4xl sm:rounded-4xl p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-lg">Új személy</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full glass flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Név</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pl. Anna"
          autoFocus
          className="w-full px-4 py-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm mb-4"
        />

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Szín</label>
        <div className="flex gap-2 mb-5">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-8 h-8 rounded-full"
              style={{ backgroundColor: c, boxShadow: color === c ? `0 0 0 2px white, 0 0 0 4px ${c}` : "none" }}
            />
          ))}
        </div>

        <button
          onClick={save}
          disabled={saving}
          className="w-full py-3 rounded-2xl bg-signal text-white font-medium text-sm active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          Mentés
        </button>
      </div>
    </div>
  );
}
