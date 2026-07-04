"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Account, Category, Loan } from "@/lib/types";
import { BottomNav } from "@/components/BottomNav";
import { Icon, Plus, X, ChevronLeft, Trash2 } from "@/components/Icon";
import { ProgressRing } from "@/components/ProgressRing";
import { formatMoney } from "@/lib/format";
import { processDueLoans } from "@/lib/automations";

export default function LoansPage() {
  const supabase = createClient();
  const [loans, setLoans] = useState<Loan[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Loan | null>(null);

  async function loadAll() {
    const [{ data: l }, { data: acc }, { data: cat }] = await Promise.all([
      supabase.from("loans").select("*").order("next_run_date"),
      supabase.from("accounts").select("*"),
      supabase.from("categories").select("*").eq("kind", "expense"),
    ]);
    setLoans(l || []);
    setAccounts(acc || []);
    setCategories(cat || []);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lefuttatja az esedékes törlesztéseket (kliens oldali "cron" belépéskor)
  async function processDue() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await processDueLoans(supabase, user.id, accounts);
    loadAll();
  }

  useEffect(() => {
    if (loans.some((l) => l.active && l.next_run_date <= new Date().toISOString().slice(0, 10))) {
      processDue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loans.length]);

  async function remove(l: Loan) {
    if (!confirm(`Törlöd a(z) "${l.name}" hitelt?`)) return;
    await supabase.from("loans").delete().eq("id", l.id);
    loadAll();
  }

  return (
    <main className="min-h-dvh px-5 pb-32 max-w-lg mx-auto">
      <div className="flex items-center gap-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] mb-5">
        <Link href="/settings" className="w-9 h-9 rounded-full glass flex items-center justify-center">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <h1 className="font-display font-semibold text-2xl">Hitelek</h1>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 -mt-3">
        Áruhitelek automatikus havi törlesztéssel — a fennmaradó összeg minden esedékességkor csökken.
      </p>

      <div className="space-y-3 mb-5">
        {loans.map((l) => {
          const acc = accounts.find((a) => a.id === l.account_id);
          const progress = 1 - Number(l.remaining_balance) / Number(l.principal);
          return (
            <button
              key={l.id}
              onClick={() => {
                setEditing(l);
                setFormOpen(true);
              }}
              className={`w-full glass rounded-3xl p-4 flex items-center gap-3 text-left ${!l.active ? "opacity-60" : ""}`}
            >
              <ProgressRing progress={progress} size={52} stroke={5} color="#7C6AE0">
                <span className="text-[10px] font-mono tabular font-semibold">{Math.round(progress * 100)}%</span>
              </ProgressRing>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{l.name}</p>
                <p className="text-xs text-slate-400">
                  {acc?.name} · Havi {formatMoney(l.monthly_payment, acc?.currency)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-mono tabular text-sm font-semibold">
                  {formatMoney(l.remaining_balance, acc?.currency)}
                </p>
                <p className="text-[10px] text-slate-400">/ {formatMoney(l.principal, acc?.currency)}</p>
              </div>
            </button>
          );
        })}
        {loans.length === 0 && <p className="text-center text-sm text-slate-400 py-10">Nincs felvéve hitel.</p>}
      </div>

      <button
        onClick={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        disabled={accounts.length === 0}
        className="w-full py-3 rounded-2xl border border-dashed border-slate-400/40 text-sm text-slate-500 flex items-center justify-center gap-1.5 disabled:opacity-40"
      >
        <Plus className="w-4 h-4" /> Új hitel
      </button>

      {formOpen && (
        <LoanForm
          loan={editing}
          accounts={accounts}
          categories={categories}
          onClose={() => setFormOpen(false)}
          onDelete={editing ? () => remove(editing) : undefined}
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

function LoanForm({
  loan,
  accounts,
  categories,
  onClose,
  onSaved,
  onDelete,
}: {
  loan: Loan | null;
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
  onDelete?: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState(loan?.name || "");
  const [principal, setPrincipal] = useState(loan ? String(loan.principal) : "");
  const [remaining, setRemaining] = useState(loan ? String(loan.remaining_balance) : "");
  const [monthlyPayment, setMonthlyPayment] = useState(loan ? String(loan.monthly_payment) : "");
  const [accountId, setAccountId] = useState(loan?.account_id || accounts[0]?.id || "");
  const [categoryId, setCategoryId] = useState(loan?.category_id || "");
  const [nextRun, setNextRun] = useState(loan?.next_run_date || new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  async function save() {
    if (!name.trim() || !principal || !monthlyPayment || !accountId) return;
    setSaving(true);
    const payload = {
      name,
      account_id: accountId,
      category_id: categoryId || null,
      principal: Number(principal),
      remaining_balance: Number(remaining || principal),
      monthly_payment: Number(monthlyPayment),
      next_run_date: nextRun,
      active: true,
    };
    if (loan) {
      await supabase.from("loans").update(payload).eq("id", loan.id);
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) await supabase.from("loans").insert({ ...payload, user_id: user.id });
    }
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md glass-strong rounded-t-4xl sm:rounded-4xl p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] max-h-[90dvh] overflow-y-auto animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-lg">{loan ? "Hitel szerkesztése" : "Új hitel"}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full glass flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Elnevezés</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pl. Új mosógép áruhitel"
          className="w-full px-4 py-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm mb-4"
        />

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Teljes hitelösszeg</label>
        <input
          type="number"
          value={principal}
          onChange={(e) => setPrincipal(e.target.value)}
          className="w-full px-4 py-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm mb-4 font-mono tabular"
        />

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Fennmaradó összeg</label>
        <input
          type="number"
          value={remaining}
          onChange={(e) => setRemaining(e.target.value)}
          placeholder="Ha üres, a teljes összeg"
          className="w-full px-4 py-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm mb-4 font-mono tabular"
        />

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Havi törlesztő</label>
        <input
          type="number"
          value={monthlyPayment}
          onChange={(e) => setMonthlyPayment(e.target.value)}
          className="w-full px-4 py-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm mb-4 font-mono tabular"
        />

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Fiók (innen vonódik le)</label>
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

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Kategória</label>
        <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryId(c.id)}
              className={`shrink-0 px-3 py-2 rounded-2xl text-xs font-medium border flex items-center gap-1.5 ${
                categoryId === c.id ? "border-signal bg-signal/10 text-signal" : "border-white/60 dark:border-white/10 glass"
              }`}
            >
              <Icon name={c.icon} className="w-3.5 h-3.5" /> {c.name}
            </button>
          ))}
        </div>

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Következő törlesztés</label>
        <input
          type="date"
          value={nextRun}
          onChange={(e) => setNextRun(e.target.value)}
          className="w-full px-4 py-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm mb-5"
        />

        <div className="flex gap-2">
          {onDelete && (
            <button
              onClick={onDelete}
              disabled={saving}
              className="px-4 py-3 rounded-2xl bg-coral/10 text-coral text-sm font-medium active:scale-95 transition-transform"
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
