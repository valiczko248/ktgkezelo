"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Account, Goal, Transaction } from "@/lib/types";
import { BottomNav } from "@/components/BottomNav";
import { Icon, Plus, X, ChevronLeft, Trash2 } from "@/components/Icon";
import { ProgressRing } from "@/components/ProgressRing";
import { AmountInput } from "@/components/AmountInput";
import { formatMoney } from "@/lib/format";

const COLORS = ["#0A84FF", "#2FD6A8", "#FF6B6B", "#FFB020", "#7C6AE0", "#64748B"];

export default function GoalsPage() {
  const supabase = createClient();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Goal | null>(null);

  async function loadAll() {
    const [{ data: g }, { data: acc }, { data: tx }] = await Promise.all([
      supabase.from("goals").select("*").eq("is_archived", false).order("created_at"),
      supabase.from("accounts").select("*"),
      supabase.from("transactions").select("*"),
    ]);
    setGoals(g || []);
    setAccounts(acc || []);
    setTxs(tx || []);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accountBalances = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of accounts) map[a.id] = Number(a.initial_balance);
    for (const t of txs) {
      if (t.type === "expense") map[t.account_id] = (map[t.account_id] || 0) - Number(t.amount);
      if (t.type === "income") map[t.account_id] = (map[t.account_id] || 0) + Number(t.amount);
      if (t.type === "transfer") {
        map[t.account_id] = (map[t.account_id] || 0) - Number(t.amount);
        if (t.to_account_id) map[t.to_account_id] = (map[t.to_account_id] || 0) + Number(t.amount);
      }
    }
    return map;
  }, [accounts, txs]);

  async function archive(g: Goal) {
    if (!confirm(`Biztosan archiválod "${g.name}" célt?`)) return;
    await supabase.from("goals").update({ is_archived: true }).eq("id", g.id);
    loadAll();
  }

  return (
    <main className="min-h-dvh px-5 pb-32 max-w-lg mx-auto">
      <div className="flex items-center gap-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] mb-5">
        <Link href="/settings" className="w-9 h-9 rounded-full glass flex items-center justify-center">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <h1 className="font-display font-semibold text-2xl">Célok</h1>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 -mt-3">
        Kösd egy célt egy fiókhoz (pl. megtakarítási számla) — a haladás a fiók egyenlege alapján frissül.
      </p>

      <div className="space-y-3 mb-5">
        {goals.map((g) => {
          const acc = accounts.find((a) => a.id === g.account_id);
          const balance = g.account_id ? accountBalances[g.account_id] ?? 0 : 0;
          const progress = balance / Number(g.target_amount);
          return (
            <button
              key={g.id}
              onClick={() => {
                setEditing(g);
                setFormOpen(true);
              }}
              className="w-full glass rounded-3xl p-4 flex items-center gap-3 text-left"
            >
              <ProgressRing progress={progress} size={52} stroke={5} color={g.color}>
                <Icon name={g.icon} className="w-5 h-5" style={{ color: g.color }} />
              </ProgressRing>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{g.name}</p>
                <p className="text-xs text-slate-400">{acc?.name || "Nincs fiókhoz kötve"}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono tabular text-sm font-semibold">{formatMoney(balance, acc?.currency)}</p>
                <p className="text-[10px] text-slate-400">/ {formatMoney(g.target_amount, acc?.currency)}</p>
              </div>
            </button>
          );
        })}
        {goals.length === 0 && <p className="text-center text-sm text-slate-400 py-10">Nincs felvéve cél.</p>}
      </div>

      <button
        onClick={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        className="w-full py-3 rounded-2xl border border-dashed border-slate-400/40 text-sm text-slate-500 flex items-center justify-center gap-1.5"
      >
        <Plus className="w-4 h-4" /> Új cél
      </button>

      {formOpen && (
        <GoalForm
          goal={editing}
          accounts={accounts}
          onClose={() => setFormOpen(false)}
          onArchive={editing ? () => archive(editing) : undefined}
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

function GoalForm({
  goal,
  accounts,
  onClose,
  onSaved,
  onArchive,
}: {
  goal: Goal | null;
  accounts: Account[];
  onClose: () => void;
  onSaved: () => void;
  onArchive?: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState(goal?.name || "");
  const [targetAmount, setTargetAmount] = useState(goal ? String(goal.target_amount) : "");
  const [accountId, setAccountId] = useState(goal?.account_id || "");
  const [color, setColor] = useState(goal?.color || COLORS[0]);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || !targetAmount) return;
    setSaving(true);
    const payload = {
      name,
      target_amount: Number(targetAmount),
      account_id: accountId || null,
      color,
      icon: "piggy-bank",
    };
    if (goal) {
      await supabase.from("goals").update(payload).eq("id", goal.id);
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await supabase.from("goals").insert({ ...payload, user_id: user.id });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md glass-strong rounded-t-4xl sm:rounded-4xl p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] max-h-[90dvh] overflow-y-auto animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-lg">{goal ? "Cél szerkesztése" : "Új cél"}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full glass flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Elnevezés</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pl. Új telefon"
          className="w-full px-4 py-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm mb-4"
        />

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Cél összeg</label>
        <AmountInput
          value={targetAmount}
          onChange={setTargetAmount}
          className="w-full px-4 py-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm mb-4 font-mono tabular"
        />

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Fiók (a haladás ebből számol)</label>
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
          {accounts.map((a) => (
            <button
              key={a.id}
              onClick={() => setAccountId(a.id)}
              className={`shrink-0 px-3 py-2 rounded-2xl text-xs font-medium border ${
                accountId === a.id ? "border-signal bg-signal/10 text-signal" : "border-white/60 dark:border-white/10 glass"
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>

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

        <div className="flex gap-2">
          {onArchive && (
            <button
              onClick={onArchive}
              className="px-4 py-3 rounded-2xl bg-slate-500/10 text-slate-500 text-sm font-medium"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={save}
            disabled={saving}
            className="flex-1 py-3 rounded-2xl bg-signal text-white font-medium text-sm active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            Mentés
          </button>
        </div>
      </div>
    </div>
  );
}
