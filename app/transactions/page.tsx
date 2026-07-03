"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Account, Category, Transaction } from "@/lib/types";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { TransactionSheet } from "@/components/TransactionSheet";
import { Icon, Plus } from "@/components/Icon";
import { formatShortMoney } from "@/lib/format";

export default function TransactionsPage() {
  const supabase = createClient();
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);

  const [filterAccount, setFilterAccount] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterType, setFilterType] = useState<string>("all");
  const [search, setSearch] = useState("");

  async function loadAll() {
    setLoading(true);
    const [{ data: acc }, { data: cat }, { data: tx }] = await Promise.all([
      supabase.from("accounts").select("*").order("sort_order"),
      supabase.from("categories").select("*").order("sort_order"),
      supabase.from("transactions").select("*").order("occurred_on", { ascending: false }),
    ]);
    setAccounts(acc || []);
    setCategories(cat || []);
    setTxs(tx || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return txs.filter((t) => {
      if (filterAccount !== "all" && t.account_id !== filterAccount) return false;
      if (filterCategory !== "all" && t.category_id !== filterCategory) return false;
      if (filterType !== "all" && t.type !== filterType) return false;
      if (search && !(t.note || "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [txs, filterAccount, filterCategory, filterType, search]);

  const grouped = useMemo(() => {
    const map: Record<string, Transaction[]> = {};
    for (const t of filtered) {
      map[t.occurred_on] = map[t.occurred_on] || [];
      map[t.occurred_on].push(t);
    }
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

  function categoryOf(id: string | null) {
    return categories.find((c) => c.id === id);
  }
  function accountOf(id: string) {
    return accounts.find((a) => a.id === id);
  }

  return (
    <main className="min-h-dvh px-5 pb-32 max-w-lg mx-auto">
      <TopBar title="Tételek" subtitle={`${filtered.length} tranzakció`} />

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Keresés jegyzetben…"
        className="w-full px-4 py-2.5 rounded-2xl glass border-0 outline-none text-sm mb-3 placeholder:text-slate-400"
      />

      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-5 px-5">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="shrink-0 px-3 py-2 rounded-2xl glass text-xs font-medium outline-none"
        >
          <option value="all">Minden típus</option>
          <option value="expense">Kiadás</option>
          <option value="income">Bevétel</option>
          <option value="transfer">Átvezetés</option>
        </select>
        <select
          value={filterAccount}
          onChange={(e) => setFilterAccount(e.target.value)}
          className="shrink-0 px-3 py-2 rounded-2xl glass text-xs font-medium outline-none"
        >
          <option value="all">Minden fiók</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name}
            </option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="shrink-0 px-3 py-2 rounded-2xl glass text-xs font-medium outline-none"
        >
          <option value="all">Minden kategória</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-20 text-sm">Betöltés…</div>
      ) : grouped.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-16">Nincs a szűrésnek megfelelő tétel.</p>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, items]) => (
            <div key={date}>
              <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 px-1">
                {new Intl.DateTimeFormat("hu-HU", { weekday: "long", month: "long", day: "numeric" }).format(
                  new Date(date)
                )}
              </p>
              <div className="glass rounded-4xl divide-y divide-slate-500/10 overflow-hidden">
                {items.map((t) => {
                  const cat = categoryOf(t.category_id);
                  const acc = accountOf(t.account_id);
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        setEditing(t);
                        setSheetOpen(true);
                      }}
                      className="w-full flex items-center gap-3 px-4 py-3 text-left active:bg-slate-500/5"
                    >
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                        style={{
                          backgroundColor: t.type === "transfer" ? "#0A84FF22" : `${cat?.color || "#64748B"}22`,
                        }}
                      >
                        <Icon name={t.type === "transfer" ? "arrow-left-right" : cat?.icon || "tag"} className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {t.type === "transfer" ? "Átvezetés" : cat?.name || "Egyéb"}
                        </p>
                        <p className="text-xs text-slate-400 truncate">
                          {acc?.name}
                          {t.note ? ` · ${t.note}` : ""}
                        </p>
                      </div>
                      <p
                        className={`font-mono tabular text-sm font-semibold shrink-0 ${
                          t.type === "income" ? "text-mint-dark" : t.type === "expense" ? "text-coral" : "text-signal"
                        }`}
                      >
                        {t.type === "expense" ? "−" : t.type === "income" ? "+" : ""}
                        {formatShortMoney(t.amount, t.currency)}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <button
        onClick={() => {
          setEditing(null);
          setSheetOpen(true);
        }}
        className="fixed bottom-24 right-5 w-14 h-14 rounded-full bg-signal text-white flex items-center justify-center shadow-glow-signal active:scale-90 transition-transform z-30"
      >
        <Plus className="w-6 h-6" />
      </button>

      {sheetOpen && (
        <TransactionSheet
          accounts={accounts}
          categories={categories}
          editing={editing}
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
