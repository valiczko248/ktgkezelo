import type { Receipt, ReceiptItem, ReceiptItemSplit, Transaction, TransactionSplit } from "./types";

export function splitTotalsByTransaction(splits: TransactionSplit[]): Record<string, number> {
  const map: Record<string, number> = {};
  for (const s of splits) {
    map[s.transaction_id] = (map[s.transaction_id] || 0) + Number(s.amount);
  }
  return map;
}

// Tétel-szintű (blokk) megosztások összesítése tranzakció-szintre: item -> receipt -> transaction_id
export function receiptItemSplitTotalsByTransaction(
  receiptItems: ReceiptItem[],
  itemSplits: ReceiptItemSplit[],
  receipts: Receipt[]
): Record<string, number> {
  const receiptTxById: Record<string, string> = {};
  for (const r of receipts) {
    if (r.transaction_id) receiptTxById[r.id] = r.transaction_id;
  }
  const txByItemId: Record<string, string> = {};
  for (const item of receiptItems) {
    const txId = receiptTxById[item.receipt_id];
    if (txId) txByItemId[item.id] = txId;
  }
  const map: Record<string, number> = {};
  for (const s of itemSplits) {
    const txId = txByItemId[s.receipt_item_id];
    if (!txId) continue;
    map[txId] = (map[txId] || 0) + Number(s.amount);
  }
  return map;
}

export function combineSplitTotals(...maps: Record<string, number>[]): Record<string, number> {
  const combined: Record<string, number> = {};
  for (const map of maps) {
    for (const [txId, amount] of Object.entries(map)) {
      combined[txId] = (combined[txId] || 0) + amount;
    }
  }
  return combined;
}

export function netAmount(tx: Transaction, splitTotals: Record<string, number>): number {
  return Number(tx.amount) - (splitTotals[tx.id] || 0);
}

export function openAmount(split: TransactionSplit | ReceiptItemSplit): number {
  return Number(split.amount) - Number(split.settled_amount);
}
