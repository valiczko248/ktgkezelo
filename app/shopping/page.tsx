"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category, Receipt, ReceiptItem, Store } from "@/lib/types";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Icon } from "@/components/Icon";
import { formatShortMoney } from "@/lib/format";

export default function ShoppingPage() {
  const supabase = createClient();
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [filterStore, setFilterStore] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  async function loadAll() {
    setLoading(true);
    const [{ data: it }, { data: rec }, { data: str }, { data: cat }] = await Promise.all([
      supabase.from("receipt_items").select("*"),
      supabase.from("receipts").select("*"),
      supabase.from("stores").select("*").eq("is_archived", false).order("created_at"),
      supabase.from("categories").select("*"),
    ]);
    setItems(it || []);
    setReceipts(rec || []);
    setStores(str || []);
    setCategories(cat || []);
    setLoading(false);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function receiptOf(id: string) {
    return receipts.find((r) => r.id === id);
  }
  function storeOf(id: string | null) {
    return id ? stores.find((s) => s.id === id) : undefined;
  }
  function categoryOf(id: string | null) {
    return id ? categories.find((c) => c.id === id) : undefined;
  }

  const filtered = useMemo(() => {
    return items.filter((it) => {
      const receipt = receiptOf(it.receipt_id);
      if (filterStore !== "all" && receipt?.store_id !== filterStore) return false;
      if (filterCategory !== "all" && it.category_id !== filterCategory) return false;
      return true;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, receipts, filterStore, filterCategory]);

  const grouped = useMemo(() => {
    const map: Record<string, ReceiptItem[]> = {};
    for (const it of filtered) {
      const date = receiptOf(it.receipt_id)?.occurred_on || "ismeretlen";
      map[date] = map[date] || [];
      map[date].push(it);
    }
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, receipts]);

  const categoryBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    for (const it of filtered) {
      const key = it.category_id || "none";
      map[key] = (map[key] || 0) + Number(it.total_price);
    }
    const total = Object.values(map).reduce((s, v) => s + v, 0);
    return Object.entries(map)
      .map(([id, amount]) => ({ category: id === "none" ? null : categoryOf(id), amount, pct: total ? (amount / total) * 100 : 0 }))
      .sort((a, b) => b.amount - a.amount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, categories]);

  const total = filtered.reduce((s, it) => s + Number(it.total_price), 0);

  return (
    <main className="min-h-dvh px-5 pb-32 max-w-lg mx-auto">
      <TopBar title="Bevásárlás" subtitle={`${filtered.length} tétel · ${formatShortMoney(total)}`} />

      <div className="flex gap-2 overflow-x-auto pb-1 mb-4 -mx-5 px-5">
        <select
          value={filterStore}
          onChange={(e) => setFilterStore(e.target.value)}
          className="shrink-0 px-3 py-2 rounded-2xl glass text-xs font-medium outline-none"
        >
          <option value="all">Minden bolt</option>
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        <select
          value={filterCategory}
          onChange={(e) => setFilterCategory(e.target.value)}
          className="shrink-0 px-3 py-2 rounded-2xl glass text-xs font-medium outline-none"
        >
          <option value="all">Minden kategória</option>
          {categories
            .filter((c) => c.kind === "expense")
            .map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
        </select>
      </div>

      {loading ? (
        <div className="text-center text-slate-400 py-20 text-sm">Betöltés…</div>
      ) : items.length === 0 ? (
        <p className="text-center text-sm text-slate-400 py-16">
          Még nincs blokk-tétel. Egy kiadás rögzítésekor csatolhatsz blokkot a "Blokk csatolása" gombbal.
        </p>
      ) : (
        <>
          {categoryBreakdown.length > 0 && (
            <div className="glass rounded-4xl p-5 mb-5">
              <h2 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-3">Kategóriák szerint</h2>
              <div className="space-y-2.5">
                {categoryBreakdown.slice(0, 8).map((c, i) => (
                  <div key={i}>
                    <div className="flex items-center gap-2 text-xs mb-1">
                      {c.category && <Icon name={c.category.icon} className="w-3.5 h-3.5" style={{ color: c.category.color }} />}
                      <span className="flex-1 text-slate-600 dark:text-slate-300 truncate">
                        {c.category?.name || "Egyéb"}
                      </span>
                      <span className="font-mono tabular text-slate-500">{formatShortMoney(c.amount)}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-slate-500/10 overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${c.pct}%`, backgroundColor: c.category?.color || "#64748B" }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="space-y-4">
            {grouped.map(([date, dayItems]) => (
              <div key={date}>
                <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-2 px-1">
                  {date !== "ismeretlen"
                    ? new Intl.DateTimeFormat("hu-HU", { weekday: "long", month: "long", day: "numeric" }).format(
                        new Date(date)
                      )
                    : "Ismeretlen dátum"}
                </p>
                <div className="glass rounded-4xl divide-y divide-slate-500/10 overflow-hidden">
                  {dayItems.map((it) => {
                    const receipt = receiptOf(it.receipt_id);
                    const cat = categoryOf(it.category_id);
                    const store = storeOf(receipt?.store_id || null);
                    return (
                      <div key={it.id} className="flex items-center gap-3 px-4 py-3">
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                          style={{ backgroundColor: `${cat?.color || "#64748B"}22` }}
                        >
                          <Icon name={cat?.icon || "tag"} className="w-4 h-4" style={{ color: cat?.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{it.display_name || it.raw_name}</p>
                          <p className="text-xs text-slate-400 truncate">
                            {store?.name || "—"}
                            {it.quantity !== 1 ? ` · ${it.quantity} db` : ""}
                          </p>
                        </div>
                        <p className="font-mono tabular text-sm font-semibold shrink-0 text-coral">
                          {formatShortMoney(it.total_price)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <BottomNav />
    </main>
  );
}
