"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Account, Category, Frequency, RecurringRule } from "@/lib/types";
import { BottomNav } from "@/components/BottomNav";
import { Icon, Plus, X, ChevronLeft, Trash2 } from "@/components/Icon";
import { AmountInput } from "@/components/AmountInput";
import { formatMoney } from "@/lib/format";
import { processDueRecurring } from "@/lib/automations";

const FREQ_LABEL: Record<Frequency, string> = {
  daily: "Naponta",
  weekly: "Hetente",
  monthly: "Havonta",
  yearly: "Évente",
};

export default function RecurringPage() {
  const supabase = createClient();
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<RecurringRule | null>(null);
  const [running, setRunning] = useState(false);

  async function loadAll() {
    const [{ data: r }, { data: acc }, { data: cat }] = await Promise.all([
      supabase.from("recurring_rules").select("*").order("next_run_date"),
      supabase.from("accounts").select("*"),
      supabase.from("categories").select("*"),
    ]);
    setRules(r || []);
    setAccounts(acc || []);
    setCategories(cat || []);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Lefuttatja az esedékes automatikus tételeket (kliens oldali "cron" belépéskor)
  async function processDue() {
    setRunning(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) await processDueRecurring(supabase, user.id);
    setRunning(false);
    loadAll();
  }

  useEffect(() => {
    if (rules.some((r) => r.active && r.next_run_date <= new Date().toISOString().slice(0, 10))) {
      processDue();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rules.length]);

  async function toggleActive(r: RecurringRule) {
    await supabase.from("recurring_rules").update({ active: !r.active }).eq("id", r.id);
    loadAll();
  }
  async function remove(r: RecurringRule) {
    if (!confirm(`Törlöd a(z) "${r.name}" automatikus tételt?`)) return;
    await supabase.from("recurring_rules").delete().eq("id", r.id);
    loadAll();
  }

  return (
    <main className="min-h-dvh px-5 pb-32 max-w-lg mx-auto">
      <div className="flex items-center gap-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] mb-5">
        <Link href="/settings" className="w-9 h-9 rounded-full glass flex items-center justify-center">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <h1 className="font-display font-semibold text-2xl">Automatikus tételek</h1>
      </div>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-5 -mt-3">
        Ismétlődő levonások (pl. előfizetések) és bevételek (pl. fizetés) — bejelentkezéskor automatikusan
        rögzülnek, ha esedékesek.
      </p>

      <div className="space-y-3 mb-5">
        {rules.map((r) => {
          const acc = accounts.find((a) => a.id === r.account_id);
          const toAcc = accounts.find((a) => a.id === r.to_account_id);
          const cat = categories.find((c) => c.id === r.category_id);
          return (
            <div key={r.id} className={`glass rounded-3xl p-4 flex items-center gap-3 ${!r.active ? "opacity-50" : ""}`}>
              <div
                className="w-10 h-10 rounded-2xl flex items-center justify-center shrink-0"
                style={{ backgroundColor: r.type === "transfer" ? "#0A84FF22" : `${cat?.color || "#64748B"}22` }}
              >
                <Icon name={r.type === "transfer" ? "arrow-left-right" : cat?.icon || "repeat"} className="w-4.5 h-4.5" />
              </div>
              <button
                onClick={() => {
                  setEditing(r);
                  setFormOpen(true);
                }}
                className="flex-1 min-w-0 text-left"
              >
                <p className="text-sm font-medium truncate">{r.name}</p>
                <p className="text-xs text-slate-400">
                  {r.type === "transfer" ? `${acc?.name} → ${toAcc?.name}` : acc?.name} · {FREQ_LABEL[r.frequency]} · Köv.: {r.next_run_date}
                </p>
              </button>
              <div className="text-right shrink-0">
                <p
                  className={`font-mono tabular text-sm font-semibold ${
                    r.type === "income" ? "text-mint-dark" : r.type === "transfer" ? "text-signal" : "text-coral"
                  }`}
                >
                  {r.type === "income" ? "+" : r.type === "transfer" ? "" : "−"}
                  {formatMoney(r.amount, r.currency)}
                </p>
                <div className="flex items-center gap-2 mt-1 justify-end">
                  <button onClick={() => toggleActive(r)} className="text-[10px] text-signal">
                    {r.active ? "Szüneteltet" : "Aktivál"}
                  </button>
                  <button onClick={() => remove(r)} className="text-coral">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}
        {rules.length === 0 && <p className="text-center text-sm text-slate-400 py-10">Nincs automatikus tétel.</p>}
      </div>

      <button
        onClick={() => {
          setEditing(null);
          setFormOpen(true);
        }}
        disabled={accounts.length === 0}
        className="w-full py-3 rounded-2xl border border-dashed border-slate-400/40 text-sm text-slate-500 flex items-center justify-center gap-1.5 disabled:opacity-40"
      >
        <Plus className="w-4 h-4" /> Új automatikus tétel
      </button>

      {formOpen && (
        <RuleForm
          rule={editing}
          accounts={accounts}
          categories={categories}
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

function RuleForm({
  rule,
  accounts,
  categories,
  onClose,
  onSaved,
}: {
  rule: RecurringRule | null;
  accounts: Account[];
  categories: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [name, setName] = useState(rule?.name || "");
  const [type, setType] = useState<"expense" | "income" | "transfer">(rule?.type || "expense");
  const [amount, setAmount] = useState(rule ? String(rule.amount) : "");
  const [accountId, setAccountId] = useState(rule?.account_id || accounts[0]?.id || "");
  const [toAccountId, setToAccountId] = useState(rule?.to_account_id || "");
  const [categoryId, setCategoryId] = useState(rule?.category_id || "");
  const [frequency, setFrequency] = useState<Frequency>(rule?.frequency || "monthly");
  const [nextRun, setNextRun] = useState(rule?.next_run_date || new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const account = accounts.find((a) => a.id === accountId);
  const visibleCategories = categories.filter((c) => c.kind === (type === "transfer" ? "expense" : type));

  async function save() {
    if (!name.trim() || !amount || !accountId) return;
    if (type === "transfer" && (!toAccountId || toAccountId === accountId)) return;
    setSaving(true);
    setError(null);
    const payload = {
      name,
      type,
      amount: Number(amount),
      currency: account?.currency || "HUF",
      account_id: accountId,
      to_account_id: type === "transfer" ? toAccountId : null,
      category_id: type === "transfer" ? null : categoryId || null,
      frequency,
      next_run_date: nextRun,
      active: true,
    };
    let dbError = null;
    if (rule) {
      ({ error: dbError } = await supabase.from("recurring_rules").update(payload).eq("id", rule.id));
    } else {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        ({ error: dbError } = await supabase.from("recurring_rules").insert({ ...payload, user_id: user.id }));
      }
    }
    setSaving(false);
    if (dbError) {
      setError(dbError.message);
      return;
    }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md glass-strong rounded-t-4xl sm:rounded-4xl p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] max-h-[90dvh] overflow-y-auto animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-lg">{rule ? "Szerkesztés" : "Új automatikus tétel"}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full glass flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Elnevezés</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Pl. Netflix előfizetés"
          className="w-full px-4 py-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm mb-4"
        />

        <div className="flex gap-1 mb-4 p-1 rounded-2xl bg-slate-500/10">
          <button
            onClick={() => setType("expense")}
            className={`flex-1 py-2 rounded-xl text-xs font-medium ${type === "expense" ? "bg-white dark:bg-white/10 text-coral" : "text-slate-500"}`}
          >
            Kiadás
          </button>
          <button
            onClick={() => setType("income")}
            className={`flex-1 py-2 rounded-xl text-xs font-medium ${type === "income" ? "bg-white dark:bg-white/10 text-mint-dark" : "text-slate-500"}`}
          >
            Bevétel
          </button>
          <button
            onClick={() => setType("transfer")}
            className={`flex-1 py-2 rounded-xl text-xs font-medium ${type === "transfer" ? "bg-white dark:bg-white/10 text-signal" : "text-slate-500"}`}
          >
            Átvezetés
          </button>
        </div>

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Összeg</label>
        <AmountInput
          value={amount}
          onChange={setAmount}
          className="w-full px-4 py-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm mb-4 font-mono tabular"
        />

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">{type === "transfer" ? "Honnan" : "Fiók"}</label>
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

        {type === "transfer" ? (
          <>
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">Hova</label>
            <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
              {accounts
                .filter((a) => a.id !== accountId)
                .map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setToAccountId(a.id)}
                    className={`shrink-0 px-3 py-2 rounded-2xl text-xs font-medium border ${
                      toAccountId === a.id ? "border-signal bg-signal/10 text-signal" : "border-white/60 dark:border-white/10 glass"
                    }`}
                  >
                    {a.name}
                  </button>
                ))}
            </div>
          </>
        ) : (
          <>
            <label className="text-xs font-medium text-slate-500 mb-1.5 block">Kategória</label>
            <div className="flex gap-2 overflow-x-auto pb-1 mb-4">
              {visibleCategories.map((c) => (
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
          </>
        )}

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Gyakoriság</label>
        <div className="flex gap-2 mb-4">
          {(Object.keys(FREQ_LABEL) as Frequency[]).map((f) => (
            <button
              key={f}
              onClick={() => setFrequency(f)}
              className={`px-3 py-1.5 rounded-xl text-xs font-medium ${
                frequency === f ? "bg-signal text-white" : "bg-slate-500/10 text-slate-500"
              }`}
            >
              {FREQ_LABEL[f]}
            </button>
          ))}
        </div>

        <label className="text-xs font-medium text-slate-500 mb-1.5 block">Következő esedékesség</label>
        <input
          type="date"
          value={nextRun}
          onChange={(e) => setNextRun(e.target.value)}
          className="w-full px-4 py-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm mb-5"
        />

        {error && <p className="text-xs text-coral mb-4">{error}</p>}

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
