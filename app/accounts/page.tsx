"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Account, AccountType, Transaction } from "@/lib/types";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Icon, Plus, X, ChevronLeft } from "@/components/Icon";
import { formatMoney, CURRENCIES } from "@/lib/format";

const TYPES: { value: AccountType; label: string; icon: string }[] = [
  { value: "bank", label: "Bankszámla", icon: "landmark" },
  { value: "cash", label: "Készpénz", icon: "wallet" },
  { value: "card", label: "Kártya", icon: "credit-card" },
  { value: "savings", label: "Megtakarítás", icon: "piggy-bank" },
  { value: "other", label: "Egyéb", icon: "coins" },
];
const COLORS = ["#0A84FF", "#2FD6A8", "#FF6B6B", "#FFB020", "#7C6AE0", "#64748B"];

export default function AccountsPage() {
  const supabase = createClient();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);

  async function loadAll() {
    const [{ data: acc }, { data: tx }] = await Promise.all([
      supabase.from("accounts").select("*").order("sort_order"),
      supabase.from("transactions").select("*"),
    ]);
    setAccounts(acc || []);
    setTxs(tx || []);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const balances = useMemo(() => {
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

  async function archive(a: Account) {
    await supabase.from("accounts").update({ is_archived: !a.is_archived }).eq("id", a.id);
    loadAll();
  }

  return (
    <main className="min-h-dvh px-5 pb-32 max-w-lg mx-auto">
      <div className="flex items-center gap-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] mb-5">
        <Link href="/settings" className="w-9 h-9 rounded-full glass flex items-center justify-center">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <h1 className="font-display font-semibold text-2xl">Fiókok</h1>
      </div>

      <div className="space-y-3 mb-5">
        {accounts.map((a) => (
          <button
            key={a.id}
            onClick={() => {
              setEditing(a);
              setFormOpen(true);
            }}
            className={`w-full glass rounded-3xl p-4 flex items-center gap-3 text-left ${
              a.is_archived ? "opacity-50" : ""
            }`}
          >
            <div
              className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${a.color}22` }}
            >
              <Icon name={a.icon} className="w-5 h-5" style={{ color: a.color }} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{a.name}</p>
              <p className="text-xs text-slate-400">{TYPES.find((t) => t.value === a.type)?.label}</p>
            </div>
            <p className="font-mono tabular text-sm font-semibold">
              {formatMoney(balances[a.id] ?? Number(a.initial_balance), a.currency)}
            </p>
          </button>
        ))}
        {accounts.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-10">Még nincs egy fiókod sem.</p>
        )}
      </div>

      <button
        onClick={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        className="w-full py-3 rounded-2xl border border-dashed border-slate-400/40 text-sm text-slate-500 flex items-center justify-center gap-1.5"
      >
        <Plus className="w-4 h-4" /> Új fiók
      </button>

      {formOpen && (
        <AccountForm
          account={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false);
            loadAll();
          }}
          onArchive={editing ? () => archive(editing) : undefined}
        />
      )}

      <BottomNav />
    </main>
  );
}

function AccountForm({
  account,
  onClose,
  onSaved,
  onArchive,
}: {
  account: Account | null;
  onClose: () => void;
  onSaved: () => void;
  onArchive?: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState(account?.name || "");
  const [type, setType] = useState<AccountType>(account?.type || "bank");
  const [currency, setCurrency] = useState(account?.currency || "HUF");
  const [color, setColor] = useState(account?.color || COLORS[0]);
  const [initial, setInitial] = useState(account ? String(account.initial_balance) : "0");
  const [includeInStats, setIncludeInStats] = useState(account?.include_in_stats ?? true);
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim()) return;
    setSaving(true);
    const icon = TYPES.find((t) => t.value === type)?.icon || "wallet";
    const payload = {
      name,
      type,
      currency,
      color,
      icon,
      initial_balance: Number(initial) || 0,
      include_in_stats: includeInStats,
    };
    if (account) {
      await supabase.from("accounts").update(payload).eq("id", account.id);
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await supabase.from("accounts").insert({ ...payload, user_id: user.id });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md glass-strong rounded-t-4xl sm:rounded-4xl p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] max-h-[90dvh] overflow-y-auto animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-lg">{account ? "Fiók szerkesztése" : "Új fiók"}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full glass flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Név</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pl. Revolut"
          className="w-full px-4 py-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm mb-4"
        />

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Típus</label>
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
          {TYPES.map((t) => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`shrink-0 px-3 py-2 rounded-2xl text-xs font-medium border flex items-center gap-1.5 ${
                type === t.value ? "border-signal bg-signal/10 text-signal" : "border-white/60 dark:border-white/10 glass"
              }`}
            >
              <Icon name={t.icon} className="w-3.5 h-3.5" /> {t.label}
            </button>
          ))}
        </div>

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Pénznem</label>
        <div className="flex gap-2 flex-wrap mb-4">
          {CURRENCIES.map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium ${
                currency === c ? "bg-signal text-white" : "bg-slate-500/10 text-slate-500"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Szín</label>
        <div className="flex gap-2 mb-4">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ backgroundColor: c, outline: color === c ? "2px solid white" : "none", boxShadow: color === c ? `0 0 0 2px ${c}` : "none" }}
            />
          ))}
        </div>

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Kezdő egyenleg</label>
        <input
          type="number"
          value={initial}
          onChange={(e) => setInitial(e.target.value)}
          className="w-full px-4 py-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm mb-4 font-mono tabular"
        />

        <button
          onClick={() => setIncludeInStats((v) => !v)}
          className="w-full flex items-center justify-between px-1 mb-5"
        >
          <span className="text-xs font-medium text-slate-500 dark:text-slate-400">Számítson a statisztikákba</span>
          <span
            className={`w-10 h-6 rounded-full relative transition-colors ${
              includeInStats ? "bg-signal" : "bg-slate-500/20"
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                includeInStats ? "translate-x-[18px]" : "translate-x-0.5"
              }`}
            />
          </span>
        </button>

        <div className="flex gap-2">
          {onArchive && (
            <button
              onClick={onArchive}
              className="px-4 py-3 rounded-2xl bg-slate-500/10 text-slate-500 text-sm font-medium"
            >
              {account?.is_archived ? "Visszaállítás" : "Archiválás"}
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
