"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Category, ItemRule, Person, Receipt, ReceiptItem, Store } from "@/lib/types";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { Icon, Pencil, Check } from "@/components/Icon";
import { formatMoney, formatShortMoney } from "@/lib/format";

type Mode = "idorend" | "termekek";

export default function ShoppingPage() {
  const supabase = createClient();
  const [items, setItems] = useState<ReceiptItem[]>([]);
  const [receipts, setReceipts] = useState<Receipt[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [itemRules, setItemRules] = useState<ItemRule[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState<Mode>("idorend");

  const [filterStore, setFilterStore] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");

  async function loadAll() {
    setLoading(true);
    const [{ data: it }, { data: rec }, { data: str }, { data: cat }, { data: rules }, { data: ppl }] =
      await Promise.all([
        supabase.from("receipt_items").select("*"),
        supabase.from("receipts").select("*"),
        supabase.from("stores").select("*").eq("is_archived", false).order("created_at"),
        supabase.from("categories").select("*"),
        supabase.from("item_rules").select("*"),
        supabase.from("people").select("*").eq("is_archived", false).order("created_at"),
      ]);
    setItems(it || []);
    setReceipts(rec || []);
    setStores(str || []);
    setCategories(cat || []);
    setItemRules(rules || []);
    setPeople(ppl || []);
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
  function ruleOf(itemKey: string) {
    return itemRules.find((r) => r.item_key === itemKey);
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

  const products = useMemo(() => {
    const map: Record<
      string,
      { key: string; items: ReceiptItem[]; storeIds: Set<string> }
    > = {};
    for (const it of filtered) {
      const g = (map[it.item_key] ||= { key: it.item_key, items: [], storeIds: new Set() });
      g.items.push(it);
      const storeId = receiptOf(it.receipt_id)?.store_id;
      if (storeId) g.storeIds.add(storeId);
    }
    return Object.values(map)
      .map((g) => {
        const sorted = g.items.slice().sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        const rule = ruleOf(g.key);
        const name = rule?.display_name || sorted[0].display_name || sorted[0].raw_name;
        const total = g.items.reduce((s, it) => s + Number(it.total_price), 0);
        const avg = total / g.items.length;
        const category = categoryOf(rule?.category_id || sorted[0].category_id);
        const defaultPerson = rule?.default_person_id ? people.find((p) => p.id === rule.default_person_id) : undefined;
        return {
          key: g.key,
          name,
          count: g.items.length,
          lastPrice: Number(sorted[0].total_price),
          avgPrice: avg,
          total,
          category,
          storeNames: Array.from(g.storeIds)
            .map((id) => storeOf(id)?.name)
            .filter(Boolean),
          defaultPerson,
          defaultSplit: rule?.default_split,
        };
      })
      .sort((a, b) => b.total - a.total);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filtered, itemRules, people, categories, stores, receipts]);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  async function saveDisplayName(key: string) {
    const existing = ruleOf(key);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data } = await supabase
      .from("item_rules")
      .upsert(
        {
          user_id: user.id,
          item_key: key,
          display_name: editingName || null,
          category_id: existing?.category_id || null,
          default_person_id: existing?.default_person_id || null,
          default_split: existing?.default_split || "none",
        },
        { onConflict: "user_id,item_key" }
      )
      .select()
      .single();
    if (data) setItemRules((prev) => [...prev.filter((r) => r.item_key !== key), data]);
    setEditingKey(null);
  }

  const total = filtered.reduce((s, it) => s + Number(it.total_price), 0);

  return (
    <main className="min-h-dvh px-5 pb-32 max-w-lg mx-auto">
      <TopBar title="Bevásárlás" subtitle={`${filtered.length} tétel · ${formatShortMoney(total)}`} />

      <div className="flex gap-1 mb-4 p-1 rounded-2xl bg-slate-500/10 max-w-xs">
        <button
          onClick={() => setMode("idorend")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium ${
            mode === "idorend" ? "bg-white dark:bg-white/10 text-signal shadow-sm" : "text-slate-500"
          }`}
        >
          Időrend
        </button>
        <button
          onClick={() => setMode("termekek")}
          className={`flex-1 py-2 rounded-xl text-sm font-medium ${
            mode === "termekek" ? "bg-white dark:bg-white/10 text-signal shadow-sm" : "text-slate-500"
          }`}
        >
          Termékek
        </button>
      </div>

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

          {mode === "idorend" ? (
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
          ) : (
            <div className="glass rounded-4xl divide-y divide-slate-500/10 overflow-hidden">
              {products.map((p) => (
                <div key={p.key} className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
                      style={{ backgroundColor: `${p.category?.color || "#64748B"}22` }}
                    >
                      <Icon name={p.category?.icon || "tag"} className="w-4 h-4" style={{ color: p.category?.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      {editingKey === p.key ? (
                        <div className="flex items-center gap-1.5">
                          <input
                            value={editingName}
                            onChange={(e) => setEditingName(e.target.value)}
                            autoFocus
                            className="flex-1 px-2 py-1 rounded-lg bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm"
                          />
                          <button
                            onClick={() => saveDisplayName(p.key)}
                            className="w-7 h-7 shrink-0 rounded-full bg-signal/10 text-signal flex items-center justify-center"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingKey(p.key);
                            setEditingName(p.name);
                          }}
                          className="flex items-center gap-1.5 text-left"
                        >
                          <p className="text-sm font-medium truncate">{p.name}</p>
                          <Pencil className="w-3 h-3 text-slate-300 shrink-0" />
                        </button>
                      )}
                      <p className="text-xs text-slate-400 truncate">
                        {p.count}x · {p.storeNames.join(", ") || "ismeretlen bolt"}
                        {p.defaultPerson && p.defaultSplit !== "none"
                          ? ` · alapból ${p.defaultSplit === "half" ? "felesbe" : "teljesen"} @${p.defaultPerson.name}`
                          : ""}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono tabular text-sm font-semibold">{formatShortMoney(p.total)}</p>
                      <p className="text-[10px] text-slate-400">
                        utoljára {formatMoney(p.lastPrice)} · átlag {formatMoney(p.avgPrice)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              {products.length === 0 && (
                <p className="text-center text-sm text-slate-400 py-8">Nincs a szűrésnek megfelelő termék.</p>
              )}
            </div>
          )}
        </>
      )}

      <BottomNav />
    </main>
  );
}
