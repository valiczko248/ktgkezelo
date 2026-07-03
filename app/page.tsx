"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Account, Category, Transaction } from "@/lib/types";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { TransactionSheet } from "@/components/TransactionSheet";
import { ProgressRing } from "@/components/ProgressRing";
import { Icon, Plus } from "@/components/Icon";
import { formatMoney, formatShortMoney } from "@/lib/format";

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function fmtISO(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function DashboardPage() {
  const supabase = createClient();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [prevTxs, setPrevTxs] = useState<Transaction[]>([]);
  const [allTxs, setAllTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);

  const now = new Date();
  const thisMonthStart = startOfMonth(now);
  const thisMonthEnd = endOfMonth(now);
  const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const lastMonthStart = startOfMonth(lastMonthDate);
  const lastMonthEnd = endOfMonth(lastMonthDate);

  async function loadAll() {
    setLoading(true);
    const [{ data: acc }, { data: cat }, { data: tx }, { data: ptx }, { data: atx }] = await Promise.all([
      supabase.from("accounts").select("*").eq("is_archived", false).order("sort_order"),
      supabase.from("categories").select("*").order("sort_order"),
      supabase
        .from("transactions")
        .select("*")
        .gte("occurred_on", fmtISO(thisMonthStart))
        .lte("occurred_on", fmtISO(thisMonthEnd))
        .order("occurred_on", { ascending: false }),
      supabase
        .from("transactions")
        .select("*")
        .gte("occurred_on", fmtISO(lastMonthStart))
        .lte("occurred_on", fmtISO(lastMonthEnd)),
      supabase.from("transactions").select("*"),
    ]);
    setAccounts(acc || []);
    setCategories(cat || []);
    setTxs(tx || []);
    setPrevTxs(ptx || []);
    setAllTxs(atx || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const accountBalances = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of accounts) map[a.id] = Number(a.initial_balance);
    for (const t of allTxs) {
      if (t.type === "expense") {
        map[t.account_id] = (map[t.account_id] || 0) - Number(t.amount);
      } else if (t.type === "income") {
        map[t.account_id] = (map[t.account_id] || 0) + Number(t.amount);
      } else if (t.type === "transfer") {
        map[t.account_id] = (map[t.account_id] || 0) - Number(t.amount);
        if (t.to_account_id) map[t.to_account_id] = (map[t.to_account_id] || 0) + Number(t.amount);
      }
    }
    return map;
  }, [accounts, allTxs]);

  const balancesByCurrency = useMemo(() => {
    const map: Record<string, number> = {};
    for (const a of accounts) {
      map[a.currency] = (map[a.currency] || 0) + (accountBalances[a.id] ?? Number(a.initial_balance));
    }
    return map;
  }, [accounts, accountBalances]);

  const spendByCurrency = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of txs) {
      if (t.type === "expense") map[t.currency] = (map[t.currency] || 0) + Number(t.amount);
    }
    return map;
  }, [txs]);

  const incomeByCurrency = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of txs) {
      if (t.type === "income") map[t.currency] = (map[t.currency] || 0) + Number(t.amount);
    }
    return map;
  }, [txs]);

  const prevSpendByCurrency = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of prevTxs) {
      if (t.type === "expense") map[t.currency] = (map[t.currency] || 0) + Number(t.amount);
    }
    return map;
  }, [prevTxs]);

  const topCategories = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of txs) {
      if (t.type !== "expense" || !t.category_id) continue;
      map[t.category_id] = (map[t.category_id] || 0) + Number(t.amount);
    }
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([catId, amount]) => ({
        category: categories.find((c) => c.id === catId),
        amount,
      }))
      .filter((x) => x.category);
  }, [txs, categories]);

  const currencies = Object.keys({ ...spendByCurrency, ...incomeByCurrency, ...balancesByCurrency });
  const primaryCurrency = currencies[0] || "HUF";

  function categoryOf(id: string | null) {
    return categories.find((c) => c.id === id);
  }
  function accountOf(id: string) {
    return accounts.find((a) => a.id === id);
  }

  return (
    <main className="min-h-dvh px-5 pb-32 max-w-lg mx-auto">
      <TopBar title="Áttekintés" subtitle={new Intl.DateTimeFormat("hu-HU", { month: "long", year: "numeric" }).format(now)} />

      {loading ? (
        <div className="text-center text-slate-400 py-20 text-sm">Betöltés…</div>
      ) : accounts.length === 0 ? (
        <EmptyAccountsState onCreated={loadAll} />
      ) : (
        <>
          {/* Balance cards per currency */}
          <div className="flex gap-3 overflow-x-auto pb-2 mb-5 -mx-5 px-5">
            {currencies.map((cur) => (
              <div
                key={cur}
                className="shrink-0 glass rounded-4xl p-5 min-w-[220px] animate-fade-up"
              >
                <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Egyenleg · {cur}</p>
                <p className="font-mono tabular text-2xl font-semibold text-slate-800 dark:text-slate-50">
                  {formatMoney(balancesByCurrency[cur] || 0, cur)}
                </p>
                <div className="flex items-center gap-3 mt-3 text-xs">
                  <span className="flex items-center gap-1 text-mint-dark">
                    <Icon name="trending-up" className="w-3.5 h-3.5" />
                    {formatShortMoney(incomeByCurrency[cur] || 0, cur)}
                  </span>
                  <span className="flex items-center gap-1 text-coral">
                    <Icon name="trending-down" className="w-3.5 h-3.5" />
                    {formatShortMoney(spendByCurrency[cur] || 0, cur)}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Month comparison ring */}
          <div className="glass rounded-4xl p-5 mb-5 flex items-center gap-4">
            <ProgressRing
              progress={
                (spendByCurrency[primaryCurrency] || 0) /
                Math.max(prevSpendByCurrency[primaryCurrency] || 1, 1)
              }
              color="#0A84FF"
            >
              <span className="font-mono text-[11px] font-semibold tabular">
                {prevSpendByCurrency[primaryCurrency]
                  ? `${Math.round(
                      ((spendByCurrency[primaryCurrency] || 0) / prevSpendByCurrency[primaryCurrency]) * 100
                    )}%`
                  : "—"}
              </span>
            </ProgressRing>
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">
                Havi kiadás az előző hónaphoz képest
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Előző hónap: {formatShortMoney(prevSpendByCurrency[primaryCurrency] || 0, primaryCurrency)}
              </p>
            </div>
          </div>

          {/* Top categories */}
          {topCategories.length > 0 && (
            <div className="mb-5">
              <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 px-1">
                Legtöbbet költött kategóriák
              </h2>
              <div className="grid grid-cols-2 gap-3">
                {topCategories.map(({ category, amount }) => (
                  <div key={category!.id} className="glass rounded-3xl p-4">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center mb-2"
                      style={{ backgroundColor: `${category!.color}22` }}
                    >
                      <Icon name={category!.icon} className="w-4.5 h-4.5" strokeWidth={2} />
                    </div>
                    <p className="text-xs text-slate-500 dark:text-slate-400">{category!.name}</p>
                    <p className="font-mono tabular text-sm font-semibold mt-0.5">
                      {formatShortMoney(amount, primaryCurrency)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent transactions */}
          <div className="mb-5">
            <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2 px-1">Legutóbbi tételek</h2>
            <div className="glass rounded-4xl divide-y divide-slate-500/10 overflow-hidden">
              {txs.slice(0, 8).map((t) => {
                const cat = categoryOf(t.category_id);
                const acc = accountOf(t.account_id);
                return (
                  <div key={t.id} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{
                        backgroundColor:
                          t.type === "transfer" ? "#0A84FF22" : `${cat?.color || "#64748B"}22`,
                      }}
                    >
                      <Icon
                        name={t.type === "transfer" ? "arrow-left-right" : cat?.icon || "tag"}
                        className="w-4 h-4"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {t.type === "transfer" ? "Átvezetés" : cat?.name || "Egyéb"}
                      </p>
                      <p className="text-xs text-slate-400 truncate">{acc?.name} · {t.note || "—"}</p>
                    </div>
                    <p
                      className={`font-mono tabular text-sm font-semibold shrink-0 ${
                        t.type === "income"
                          ? "text-mint-dark"
                          : t.type === "expense"
                          ? "text-coral"
                          : "text-signal"
                      }`}
                    >
                      {t.type === "expense" ? "−" : t.type === "income" ? "+" : ""}
                      {formatShortMoney(t.amount, t.currency)}
                    </p>
                  </div>
                );
              })}
              {txs.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-8">Még nincs tétel ebben a hónapban.</p>
              )}
            </div>
          </div>
        </>
      )}

      <button
        onClick={() => setSheetOpen(true)}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-signal text-white flex items-center justify-center shadow-glow-signal active:scale-90 transition-transform z-30"
        aria-label="Új tétel hozzáadása"
      >
        <Plus className="w-6 h-6" />
      </button>

      {sheetOpen && (
        <TransactionSheet
          accounts={accounts}
          categories={categories}
          onClose={() => setSheetOpen(false)}
          onSaved={() => {
            setSheetOpen(false);
            loadAll();
          }}
        />
      )}

      <BottomNav />
    </main>
  );
}

function EmptyAccountsState({ onCreated }: { onCreated: () => void }) {
  const supabase = createClient();
  const [name, setName] = useState("Készpénz");
  const [saving, setSaving] = useState(false);

  async function createFirst() {
    setSaving(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("accounts").insert({
        user_id: user.id,
        name,
        type: "cash",
        currency: "HUF",
        icon: "wallet",
        color: "#0A84FF",
        initial_balance: 0,
      });
    }
    setSaving(false);
    onCreated();
  }

  return (
    <div className="glass rounded-4xl p-6 text-center mt-6">
      <div className="w-14 h-14 rounded-full glass-strong flex items-center justify-center mx-auto mb-4">
        <Icon name="wallet" className="w-6 h-6 text-signal" />
      </div>
      <h2 className="font-display font-semibold text-lg mb-1">Hozz létre egy fiókot</h2>
      <p className="text-sm text-slate-500 dark:text-slate-400 mb-4">
        Pl. Készpénz, Revolut, OTP — bármi, amivel fizetsz.
      </p>
      <input
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full px-4 py-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm text-center mb-3"
      />
      <button
        onClick={createFirst}
        disabled={saving}
        className="w-full py-3 rounded-2xl bg-signal text-white font-medium text-sm active:scale-[0.98] transition-transform"
      >
        Fiók létrehozása
      </button>
    </div>
  );
}
