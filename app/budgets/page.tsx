"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Account, Budget, Category, Transaction, TransactionSplit } from "@/lib/types";
import { BottomNav } from "@/components/BottomNav";
import { Icon, ChevronLeft, X } from "@/components/Icon";
import { ProgressRing } from "@/components/ProgressRing";
import { AmountInput } from "@/components/AmountInput";
import { formatShortMoney } from "@/lib/format";
import { netAmount, splitTotalsByTransaction } from "@/lib/splits";
import { excludedAccountIds } from "@/lib/accounts";

function monthStartISO(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
}

export default function BudgetsPage() {
  const supabase = createClient();
  const [categories, setCategories] = useState<Category[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [splits, setSplits] = useState<TransactionSplit[]>([]);
  const [editing, setEditing] = useState<Category | null>(null);

  const month = monthStartISO();

  async function loadAll() {
    const [{ data: cat }, { data: b }, { data: acc }, { data: tx }, { data: spl }] = await Promise.all([
      supabase.from("categories").select("*").eq("kind", "expense"),
      supabase.from("budgets").select("*").eq("month", month),
      supabase.from("accounts").select("*"),
      supabase
        .from("transactions")
        .select("*")
        .eq("type", "expense")
        .gte("occurred_on", month),
      supabase.from("transaction_splits").select("*"),
    ]);
    setCategories(cat || []);
    setBudgets(b || []);
    setAccounts(acc || []);
    setTxs(tx || []);
    setSplits(spl || []);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const splitTotals = useMemo(() => splitTotalsByTransaction(splits), [splits]);
  const excludedIds = useMemo(() => excludedAccountIds(accounts), [accounts]);

  const spentByCategory = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of txs) {
      if (excludedIds.has(t.account_id)) continue;
      if (!t.category_id) continue;
      map[t.category_id] = (map[t.category_id] || 0) + netAmount(t, splitTotals);
    }
    return map;
  }, [txs, splitTotals, excludedIds]);

  const withBudget = categories.filter((c) => budgets.some((b) => b.category_id === c.id));
  const withoutBudget = categories.filter((c) => !budgets.some((b) => b.category_id === c.id));

  return (
    <main className="min-h-dvh px-5 pb-32 max-w-lg mx-auto">
      <div className="flex items-center gap-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] mb-5">
        <Link href="/settings" className="w-9 h-9 rounded-full glass flex items-center justify-center">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <h1 className="font-display font-semibold text-2xl">Havi büdzsé</h1>
      </div>

      {withBudget.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-6">
          {withBudget.map((c) => {
            const b = budgets.find((x) => x.category_id === c.id)!;
            const spent = spentByCategory[c.id] || 0;
            const progress = spent / Number(b.amount);
            return (
              <button
                key={c.id}
                onClick={() => setEditing(c)}
                className="glass rounded-3xl p-4 flex flex-col items-center text-center"
              >
                <ProgressRing progress={progress} color={c.color} size={56} stroke={6}>
                  <Icon name={c.icon} className="w-5 h-5" style={{ color: c.color }} />
                </ProgressRing>
                <p className="text-xs font-medium mt-2">{c.name}</p>
                <p className="text-[11px] font-mono tabular text-slate-500 mt-0.5">
                  {formatShortMoney(spent, b.currency)} / {formatShortMoney(Number(b.amount), b.currency)}
                </p>
              </button>
            );
          })}
        </div>
      )}

      <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 px-1">Limit beállítása</h2>
      <div className="glass rounded-4xl divide-y divide-slate-500/10 overflow-hidden">
        {withoutBudget.map((c) => (
          <button
            key={c.id}
            onClick={() => setEditing(c)}
            className="w-full flex items-center gap-3 px-4 py-3 text-left"
          >
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ backgroundColor: `${c.color}22` }}>
              <Icon name={c.icon} className="w-4 h-4" style={{ color: c.color }} />
            </div>
            <span className="text-sm flex-1">{c.name}</span>
            <span className="text-xs text-signal">Beállítás</span>
          </button>
        ))}
      </div>

      {editing && (
        <BudgetForm
          category={editing}
          month={month}
          existing={budgets.find((b) => b.category_id === editing.id) || null}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            loadAll();
          }}
        />
      )}

      <BottomNav />
    </main>
  );
}

function BudgetForm({
  category,
  month,
  existing,
  onClose,
  onSaved,
}: {
  category: Category;
  month: string;
  existing: Budget | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [amount, setAmount] = useState(existing ? String(existing.amount) : "");
  const [currency, setCurrency] = useState(existing?.currency || "HUF");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    if (!amount || Number(amount) <= 0) {
      if (existing) await supabase.from("budgets").delete().eq("id", existing.id);
    } else if (existing) {
      await supabase.from("budgets").update({ amount: Number(amount), currency }).eq("id", existing.id);
    } else {
      await supabase.from("budgets").insert({
        user_id: user.id,
        category_id: category.id,
        month,
        amount: Number(amount),
        currency,
      });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md glass-strong rounded-t-4xl sm:rounded-4xl p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-lg flex items-center gap-2">
            <Icon name={category.icon} className="w-5 h-5" style={{ color: category.color }} />
            {category.name}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full glass flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>
        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Havi limit</label>
        <AmountInput
          value={amount}
          onChange={setAmount}
          placeholder="0 = nincs limit"
          className="w-full px-4 py-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm mb-5 font-mono tabular"
        />
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
