"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Account, Category, Transaction, TransactionSplit } from "@/lib/types";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Icon } from "@/components/Icon";
import { formatShortMoney } from "@/lib/format";
import { netAmount, splitTotalsByTransaction } from "@/lib/splits";
import { excludedAccountIds } from "@/lib/accounts";
import {
  PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis,
  Tooltip, LineChart, Line, CartesianGrid,
} from "recharts";

function fmtISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function monthsAgo(n: number) {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth() - n, 1);
}

type Period = "this_month" | "last_month" | "3m" | "6m" | "year";

export default function StatsPage() {
  const supabase = createClient();
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [splits, setSplits] = useState<TransactionSplit[]>([]);
  const [period, setPeriod] = useState<Period>("this_month");
  const [currency, setCurrency] = useState<string>("HUF");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: cat }, { data: acc }, { data: tx }, { data: spl }] = await Promise.all([
        supabase.from("categories").select("*"),
        supabase.from("accounts").select("*"),
        supabase.from("transactions").select("*").order("occurred_on"),
        supabase.from("transaction_splits").select("*"),
      ]);
      setCategories(cat || []);
      setAccounts(acc || []);
      setTxs(tx || []);
      setSplits(spl || []);
      if (acc && acc.length) setCurrency(acc[0].currency);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const splitTotals = useMemo(() => splitTotalsByTransaction(splits), [splits]);
  const excludedIds = useMemo(() => excludedAccountIds(accounts), [accounts]);
  const visibleTxs = useMemo(() => txs.filter((t) => !excludedIds.has(t.account_id)), [txs, excludedIds]);

  const range = useMemo(() => {
    const now = new Date();
    switch (period) {
      case "this_month":
        return { start: monthsAgo(0), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
      case "last_month":
        return { start: monthsAgo(1), end: new Date(now.getFullYear(), now.getMonth(), 0) };
      case "3m":
        return { start: monthsAgo(2), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
      case "6m":
        return { start: monthsAgo(5), end: new Date(now.getFullYear(), now.getMonth() + 1, 0) };
      case "year":
        return { start: new Date(now.getFullYear(), 0, 1), end: new Date(now.getFullYear(), 11, 31) };
    }
  }, [period]);

  const prevRange = useMemo(() => {
    const spanDays = (range.end.getTime() - range.start.getTime()) / 86400000;
    const prevEnd = new Date(range.start.getTime() - 86400000);
    const prevStart = new Date(prevEnd.getTime() - spanDays * 86400000);
    return { start: prevStart, end: prevEnd };
  }, [range]);

  const filtered = useMemo(
    () =>
      visibleTxs.filter(
        (t) =>
          t.currency === currency &&
          t.occurred_on >= fmtISO(range.start) &&
          t.occurred_on <= fmtISO(range.end)
      ),
    [visibleTxs, range, currency]
  );
  const prevFiltered = useMemo(
    () =>
      visibleTxs.filter(
        (t) =>
          t.currency === currency &&
          t.occurred_on >= fmtISO(prevRange.start) &&
          t.occurred_on <= fmtISO(prevRange.end)
      ),
    [visibleTxs, prevRange, currency]
  );

  const totalExpense = filtered
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + netAmount(t, splitTotals), 0);
  const totalIncome = filtered.filter((t) => t.type === "income").reduce((s, t) => s + Number(t.amount), 0);
  const prevExpense = prevFiltered
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + netAmount(t, splitTotals), 0);
  const delta = prevExpense > 0 ? Math.round(((totalExpense - prevExpense) / prevExpense) * 100) : null;

  const pieData = useMemo(() => {
    const map: Record<string, number> = {};
    for (const t of filtered) {
      if (t.type !== "expense" || !t.category_id) continue;
      map[t.category_id] = (map[t.category_id] || 0) + netAmount(t, splitTotals);
    }
    return Object.entries(map)
      .map(([id, value]) => ({ id, name: categories.find((c) => c.id === id)?.name || "Egyéb", value, color: categories.find((c) => c.id === id)?.color || "#64748B" }))
      .sort((a, b) => b.value - a.value);
  }, [filtered, categories, splitTotals]);

  const trendData = useMemo(() => {
    // last 6 months trend, expense vs income
    const months: { key: string; label: string; expense: number; income: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = monthsAgo(i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: new Intl.DateTimeFormat("hu-HU", { month: "short" }).format(d), expense: 0, income: 0 });
    }
    for (const t of visibleTxs) {
      if (t.currency !== currency) continue;
      const key = t.occurred_on.slice(0, 7);
      const m = months.find((mo) => mo.key === key);
      if (!m) continue;
      if (t.type === "expense") m.expense += netAmount(t, splitTotals);
      if (t.type === "income") m.income += Number(t.amount);
    }
    return months;
  }, [visibleTxs, currency, splitTotals]);

  const currencies = Array.from(new Set(accounts.map((a) => a.currency)));

  return (
    <main className="min-h-dvh px-5 pb-32 max-w-lg mx-auto">
      <TopBar title="Statisztika" />

      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-5 px-5">
        {(
          [
            ["this_month", "Ez a hónap"],
            ["last_month", "Előző hónap"],
            ["3m", "3 hónap"],
            ["6m", "6 hónap"],
            ["year", "Ez az év"],
          ] as [Period, string][]
        ).map(([val, label]) => (
          <button
            key={val}
            onClick={() => setPeriod(val)}
            className={`shrink-0 px-3 py-2 rounded-2xl text-xs font-medium transition-all ${
              period === val ? "bg-signal text-white" : "glass text-slate-500 dark:text-slate-400"
            }`}
          >
            {label}
          </button>
        ))}
        {currencies.length > 1 &&
          currencies.map((c) => (
            <button
              key={c}
              onClick={() => setCurrency(c)}
              className={`shrink-0 px-3 py-2 rounded-2xl text-xs font-medium transition-all ${
                currency === c ? "bg-slate-700 text-white dark:bg-white dark:text-slate-900" : "glass text-slate-500"
              }`}
            >
              {c}
            </button>
          ))}
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-20 text-sm">Betöltés…</div>
      ) : (
        <>
          {/* Summary */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="glass rounded-3xl p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Kiadás</p>
              <p className="font-mono tabular text-lg font-semibold text-coral">
                {formatShortMoney(totalExpense, currency)}
              </p>
              {delta !== null && (
                <p className={`text-xs mt-1 ${delta > 0 ? "text-coral" : "text-mint-dark"}`}>
                  {delta > 0 ? "+" : ""}
                  {delta}% az előző időszakhoz képest
                </p>
              )}
            </div>
            <div className="glass rounded-3xl p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-1">Bevétel</p>
              <p className="font-mono tabular text-lg font-semibold text-mint-dark">
                {formatShortMoney(totalIncome, currency)}
              </p>
              <p className="text-xs text-slate-400 mt-1">
                Egyenleg: {formatShortMoney(totalIncome - totalExpense, currency)}
              </p>
            </div>
          </div>

          {/* Category breakdown */}
          <div className="glass rounded-4xl p-5 mb-5">
            <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Kategóriák szerint</h2>
            {pieData.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Nincs adat ebben az időszakban.</p>
            ) : (
              <>
                <div className="h-52">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={55} outerRadius={80} paddingAngle={2}>
                        {pieData.map((entry, i) => (
                          <Cell key={i} fill={entry.color} stroke="none" />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number) => formatShortMoney(v, currency)}
                        contentStyle={{ borderRadius: 16, border: "none", fontSize: 12 }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="space-y-1.5 mt-2">
                  {pieData.slice(0, 6).map((c) => (
                    <div key={c.id} className="flex items-center gap-2 text-xs">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                      <span className="flex-1 text-slate-600 dark:text-slate-300 truncate">{c.name}</span>
                      <span className="font-mono tabular text-slate-500">{formatShortMoney(c.value, currency)}</span>
                      <span className="text-slate-400 w-10 text-right">
                        {totalExpense ? Math.round((c.value / totalExpense) * 100) : 0}%
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Trend */}
          <div className="glass rounded-4xl p-5 mb-5">
            <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">6 havi trend</h2>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(148,163,184,0.15)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip
                    formatter={(v: number) => formatShortMoney(v, currency)}
                    contentStyle={{ borderRadius: 16, border: "none", fontSize: 12 }}
                  />
                  <Bar dataKey="income" fill="#2FD6A8" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expense" fill="#FF6B6B" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}

      <BottomNav />
    </main>
  );
}
