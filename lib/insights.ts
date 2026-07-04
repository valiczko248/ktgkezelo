import type { Budget, Category, Receipt, ReceiptItem, Store, Transaction } from "./types";
import { netAmount } from "./splits";

export interface Insight {
  id: string;
  text: string;
}

const MIN_ABS_DIFF = 3000; // ne riasszon apró, pár száz/ezer forintos ingadozásra
const OVERSPEND_RATIO = 1.3; // +30%

export function categoryOverspendInsights(
  txsThisMonth: Transaction[],
  txsLastMonth: Transaction[],
  categories: Category[],
  splitTotals: Record<string, number>
): Insight[] {
  const thisMonth: Record<string, number> = {};
  const lastMonth: Record<string, number> = {};
  for (const t of txsThisMonth) {
    if (t.type !== "expense" || !t.category_id) continue;
    thisMonth[t.category_id] = (thisMonth[t.category_id] || 0) + netAmount(t, splitTotals);
  }
  for (const t of txsLastMonth) {
    if (t.type !== "expense" || !t.category_id) continue;
    lastMonth[t.category_id] = (lastMonth[t.category_id] || 0) + netAmount(t, splitTotals);
  }

  const insights: Insight[] = [];
  for (const [catId, current] of Object.entries(thisMonth)) {
    const prev = lastMonth[catId] || 0;
    if (prev <= 0) continue;
    const diff = current - prev;
    if (diff < MIN_ABS_DIFF) continue;
    if (current / prev < OVERSPEND_RATIO) continue;
    const category = categories.find((c) => c.id === catId);
    const pct = Math.round((current / prev - 1) * 100);
    insights.push({
      id: `category-${catId}`,
      text: `Túl sokat költöttél ${category?.name || "erre a kategóriára"} a múlt hónaphoz képest (+${pct}%).`,
    });
  }
  return insights;
}

export function storeOverspendInsights(
  itemsThisMonth: ReceiptItem[],
  itemsLastMonth: ReceiptItem[],
  receipts: Receipt[],
  stores: Store[]
): Insight[] {
  function storeIdOf(item: ReceiptItem): string | null {
    return receipts.find((r) => r.id === item.receipt_id)?.store_id || null;
  }

  const thisMonth: Record<string, number> = {};
  const lastMonth: Record<string, number> = {};
  for (const it of itemsThisMonth) {
    const storeId = storeIdOf(it);
    if (!storeId) continue;
    thisMonth[storeId] = (thisMonth[storeId] || 0) + Number(it.total_price);
  }
  for (const it of itemsLastMonth) {
    const storeId = storeIdOf(it);
    if (!storeId) continue;
    lastMonth[storeId] = (lastMonth[storeId] || 0) + Number(it.total_price);
  }

  const insights: Insight[] = [];
  for (const [storeId, current] of Object.entries(thisMonth)) {
    const prev = lastMonth[storeId] || 0;
    if (prev <= 0) continue;
    const diff = current - prev;
    if (diff < MIN_ABS_DIFF) continue;
    if (current / prev < OVERSPEND_RATIO) continue;
    const store = stores.find((s) => s.id === storeId);
    const pct = Math.round((current / prev - 1) * 100);
    insights.push({
      id: `store-${storeId}`,
      text: `Többet költöttél ${store?.name || "ebben a boltban"}, mint a múlt hónapban (+${pct}%).`,
    });
  }
  return insights;
}

export function budgetPaceInsights(
  spentByCategory: Record<string, number>,
  budgets: Budget[],
  categories: Category[],
  now: Date
): Insight[] {
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthProgress = dayOfMonth / daysInMonth;

  const insights: Insight[] = [];
  for (const b of budgets) {
    const spent = spentByCategory[b.category_id] || 0;
    const target = Number(b.amount);
    if (target <= 0) continue;
    const spentRatio = spent / target;
    if (spentRatio <= 0.4) continue;
    if (spentRatio - monthProgress <= 0.25) continue;
    const category = categories.find((c) => c.id === b.category_id);
    insights.push({
      id: `budget-${b.category_id}`,
      text: `A hónap ${Math.round(monthProgress * 100)}%-ánál tartasz, de ${
        category?.name || "egy kategória"
      } büdzséd ${Math.round(spentRatio * 100)}%-át már elköltötted.`,
    });
  }
  return insights;
}
