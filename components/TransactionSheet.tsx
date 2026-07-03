"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Account, Category, Transaction, TxType } from "@/lib/types";
import { Icon, X, Check } from "./Icon";

export function TransactionSheet({
  accounts,
  categories,
  editing,
  defaultDate,
  onClose,
  onSaved,
}: {
  accounts: Account[];
  categories: Category[];
  editing?: Transaction | null;
  defaultDate?: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const supabase = createClient();
  const [type, setType] = useState<TxType>(editing?.type || "expense");
  const [amount, setAmount] = useState(editing ? String(editing.amount) : "");
  const [accountId, setAccountId] = useState(editing?.account_id || accounts[0]?.id || "");
  const [toAccountId, setToAccountId] = useState(editing?.to_account_id || "");
  const [categoryId, setCategoryId] = useState(editing?.category_id || "");
  const [date, setDate] = useState(editing?.occurred_on || defaultDate || new Date().toISOString().slice(0, 10));
  const [note, setNote] = useState(editing?.note || "");
  const [saving, setSaving] = useState(false);

  const account = accounts.find((a) => a.id === accountId);
  const currency = account?.currency || "HUF";
  const visibleCategories = categories.filter((c) => c.kind === (type === "income" ? "income" : "expense"));

  useEffect(() => {
    if (!categoryId && visibleCategories.length > 0) setCategoryId(visibleCategories[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  async function handleSave() {
    if (!amount || Number(amount) <= 0 || !accountId) return;
    if (type === "transfer" && (!toAccountId || toAccountId === accountId)) return;
    setSaving(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const payload = {
      user_id: user.id,
      account_id: accountId,
      to_account_id: type === "transfer" ? toAccountId : null,
      category_id: type === "transfer" ? null : categoryId || null,
      type,
      amount: Number(amount),
      currency,
      occurred_on: date,
      note: note || null,
    };

    if (editing) {
      await supabase.from("transactions").update(payload).eq("id", editing.id);
    } else {
      await supabase.from("transactions").insert(payload);
    }

    setSaving(false);
    onSaved();
  }

  async function handleDelete() {
    if (!editing) return;
    setSaving(true);
    await supabase.from("transactions").delete().eq("id", editing.id);
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-md glass-strong rounded-t-4xl sm:rounded-4xl p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] max-h-[90dvh] overflow-y-auto animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-lg">
            {editing ? "Tétel szerkesztése" : "Új tétel"}
          </h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full glass flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Type switch */}
        <div className="flex gap-1 mb-4 p-1 rounded-2xl bg-slate-500/10">
          {(["expense", "income", "transfer"] as TxType[]).map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium transition-all ${
                type === t ? "bg-white dark:bg-white/10 shadow-sm" : "text-slate-500 dark:text-slate-400"
              } ${type === t && t === "expense" ? "text-coral" : ""} ${
                type === t && t === "income" ? "text-mint-dark" : ""
              } ${type === t && t === "transfer" ? "text-signal" : ""}`}
            >
              {t === "expense" ? "Kiadás" : t === "income" ? "Bevétel" : "Átvezetés"}
            </button>
          ))}
        </div>

        {/* Amount */}
        <div className="mb-4">
          <input
            type="number"
            inputMode="decimal"
            placeholder="0"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full text-center font-mono tabular text-4xl font-semibold bg-transparent outline-none placeholder:text-slate-300 dark:placeholder:text-slate-600"
            autoFocus
          />
          <p className="text-center text-xs text-slate-400 mt-1">{currency}</p>
        </div>

        {/* Account(s) */}
        <div className="mb-4">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">
            {type === "transfer" ? "Honnan" : "Fiók"}
          </label>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {accounts.map((a) => (
              <button
                key={a.id}
                onClick={() => setAccountId(a.id)}
                className={`shrink-0 px-3 py-2 rounded-2xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                  accountId === a.id
                    ? "border-signal bg-signal/10 text-signal"
                    : "border-white/60 dark:border-white/10 glass text-slate-600 dark:text-slate-300"
                }`}
              >
                <Icon name="wallet" className="w-3.5 h-3.5" />
                {a.name}
              </button>
            ))}
          </div>
        </div>

        {type === "transfer" && (
          <div className="mb-4">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Hova</label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {accounts
                .filter((a) => a.id !== accountId)
                .map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setToAccountId(a.id)}
                    className={`shrink-0 px-3 py-2 rounded-2xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                      toAccountId === a.id
                        ? "border-signal bg-signal/10 text-signal"
                        : "border-white/60 dark:border-white/10 glass text-slate-600 dark:text-slate-300"
                    }`}
                  >
                    <Icon name="wallet" className="w-3.5 h-3.5" />
                    {a.name}
                  </button>
                ))}
            </div>
          </div>
        )}

        {/* Category */}
        {type !== "transfer" && (
          <div className="mb-4">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Kategória</label>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {visibleCategories.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setCategoryId(c.id)}
                  className={`shrink-0 px-3 py-2 rounded-2xl text-xs font-medium border transition-all flex items-center gap-1.5 ${
                    categoryId === c.id
                      ? "border-signal bg-signal/10 text-signal"
                      : "border-white/60 dark:border-white/10 glass text-slate-600 dark:text-slate-300"
                  }`}
                >
                  <Icon name={c.icon} className="w-3.5 h-3.5" />
                  {c.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Date */}
        <div className="mb-4">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Dátum</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full px-4 py-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm"
          />
        </div>

        {/* Note */}
        <div className="mb-5">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Jegyzet</label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Pl. heti nagybevásárlás"
            rows={2}
            className="w-full px-4 py-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm resize-none placeholder:text-slate-400"
          />
        </div>

        <div className="flex gap-2">
          {editing && (
            <button
              onClick={handleDelete}
              disabled={saving}
              className="px-4 py-3 rounded-2xl bg-coral/10 text-coral text-sm font-medium active:scale-95 transition-transform"
            >
              Törlés
            </button>
          )}
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 py-3 rounded-2xl bg-signal text-white font-medium text-sm flex items-center justify-center gap-2 shadow-glow-signal active:scale-[0.98] transition-transform disabled:opacity-60"
          >
            <Check className="w-4 h-4" />
            Mentés
          </button>
        </div>
      </div>
    </div>
  );
}
