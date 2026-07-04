"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { createClient } from "@/lib/supabase/client";
import type {
  Account,
  Category,
  ItemRule,
  Person,
  ReceiptItem,
  Store,
  Transaction,
  TransactionSplit,
  TxType,
} from "@/lib/types";
import { Icon, X, Check, Plus, Trash2 } from "./Icon";
import { AmountInput } from "./AmountInput";
import { emptyReceiptDraft, type ReceiptDraft } from "@/lib/receiptDraft";
import { normalizeItemKey } from "@/lib/items";
import { dataUrlToBlob } from "@/lib/imageStitch";
import { formatShortMoney } from "@/lib/format";

// Külön chunkba kerül (OCR + kép-összefűzés csak akkor töltődik be, amikor tényleg megnyílik)
const ReceiptSheet = dynamic(() => import("./ReceiptSheet").then((m) => m.ReceiptSheet), { ssr: false });

interface SplitRow {
  person_id: string;
  amount: string;
}

export function TransactionSheet({
  accounts,
  categories,
  people,
  stores,
  itemRules,
  priorReceiptItems,
  defaultSplitPersonId,
  warnOnPriceChange,
  onCreateStore,
  editing,
  defaultDate,
  onClose,
  onSaved,
}: {
  accounts: Account[];
  categories: Category[];
  people: Person[];
  stores: Store[];
  itemRules: ItemRule[];
  priorReceiptItems: ReceiptItem[];
  defaultSplitPersonId: string | null;
  warnOnPriceChange: boolean;
  onCreateStore: (name: string) => Promise<Store | null>;
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
  const [splitRows, setSplitRows] = useState<SplitRow[]>([]);
  const [receiptDraft, setReceiptDraft] = useState<ReceiptDraft | null>(null);
  const [receiptSheetOpen, setReceiptSheetOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const account = accounts.find((a) => a.id === accountId);
  const currency = account?.currency || "HUF";
  const visibleCategories = categories.filter((c) => c.kind === (type === "income" ? "income" : "expense"));
  const hasReceiptItems = !!receiptDraft && receiptDraft.items.length > 0;
  const receiptSplitTotal = receiptDraft
    ? receiptDraft.items.reduce((s, it) => s + it.splitRows.reduce((s2, r) => s2 + (Number(r.amount) || 0), 0), 0)
    : 0;
  const splitTotal = splitRows.reduce((s, r) => s + (Number(r.amount) || 0), 0) + receiptSplitTotal;
  const ownShare = (Number(amount) || 0) - splitTotal;

  useEffect(() => {
    if (!categoryId && visibleCategories.length > 0) setCategoryId(visibleCategories[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

  useEffect(() => {
    if (!editing) return;
    (async () => {
      const { data } = await supabase.from("transaction_splits").select("*").eq("transaction_id", editing.id);
      setSplitRows(
        ((data as TransactionSplit[]) || []).map((s) => ({ person_id: s.person_id, amount: String(s.amount) }))
      );
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);

  useEffect(() => {
    if (!editing) return;
    (async () => {
      const { data: receipt } = await supabase
        .from("receipts")
        .select("*")
        .eq("transaction_id", editing.id)
        .maybeSingle();
      if (!receipt) return;
      const { data: items } = await supabase.from("receipt_items").select("*").eq("receipt_id", receipt.id);
      const itemIds = (items || []).map((i) => i.id);
      const { data: itemSplits } =
        itemIds.length > 0
          ? await supabase.from("receipt_item_splits").select("*").in("receipt_item_id", itemIds)
          : { data: [] as { receipt_item_id: string; person_id: string; amount: number }[] };
      setReceiptDraft({
        storeId: receipt.store_id || "",
        imageDataUrl: null,
        pdfFile: null,
        linkUrl: receipt.link_url || "",
        existingImagePath: receipt.image_path,
        existingPdfPath: receipt.pdf_path,
        items: (items || []).map((it) => ({
          raw_name: it.raw_name,
          display_name: it.display_name || "",
          category_id: it.category_id || "",
          quantity: String(it.quantity),
          total_price: String(it.total_price),
          splitRows: (itemSplits || [])
            .filter((s) => s.receipt_item_id === it.id)
            .map((s) => ({ person_id: s.person_id, amount: String(s.amount) })),
          saveAsRule: false,
          priceWarning: null,
        })),
      });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing?.id]);

  function addSplitRow() {
    if (people.length === 0) return;
    setSplitRows((rows) => [...rows, { person_id: people[0].id, amount: "" }]);
  }
  function updateSplitRow(index: number, patch: Partial<SplitRow>) {
    setSplitRows((rows) => rows.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }
  function removeSplitRow(index: number) {
    setSplitRows((rows) => rows.filter((_, i) => i !== index));
  }

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

    let transactionId = editing?.id;
    if (editing) {
      await supabase.from("transactions").update(payload).eq("id", editing.id);
    } else {
      const { data } = await supabase.from("transactions").insert(payload).select().single();
      transactionId = data?.id;
    }

    if (transactionId) {
      // Meglévő tétel szerkesztésekor a régi splitek/blokk törlendők az újrafelvitel előtt —
      // vadonatúj tételnél ez sosem lehet szükséges, feleslegesen lassítaná a mentést.
      if (editing) {
        await Promise.all([
          supabase.from("transaction_splits").delete().eq("transaction_id", transactionId),
          supabase.from("receipts").delete().eq("transaction_id", transactionId),
        ]);
      }

      const validRows = type === "expense" ? splitRows.filter((r) => r.person_id && Number(r.amount) > 0) : [];
      if (validRows.length > 0) {
        await supabase.from("transaction_splits").insert(
          validRows.map((r) => ({
            user_id: user.id,
            transaction_id: transactionId,
            person_id: r.person_id,
            amount: Number(r.amount),
          }))
        );
      }

      if (type === "expense" && receiptDraft) {
        let imagePath = receiptDraft.existingImagePath || null;
        if (receiptDraft.imageDataUrl) {
          const blob = await dataUrlToBlob(receiptDraft.imageDataUrl);
          const path = `${user.id}/${transactionId}-${Date.now()}.png`;
          const { error } = await supabase.storage
            .from("receipts")
            .upload(path, blob, { contentType: "image/png", upsert: true });
          if (!error) imagePath = path;
        }
        let pdfPath = receiptDraft.existingPdfPath || null;
        if (receiptDraft.pdfFile) {
          const path = `${user.id}/${transactionId}-${Date.now()}.pdf`;
          const { error } = await supabase.storage
            .from("receipts")
            .upload(path, receiptDraft.pdfFile, { contentType: "application/pdf", upsert: true });
          if (!error) pdfPath = path;
        }

        const shouldCreateReceipt =
          receiptDraft.items.length > 0 || imagePath || pdfPath || receiptDraft.linkUrl || receiptDraft.storeId;

        if (shouldCreateReceipt) {
          const { data: receiptRow } = await supabase
            .from("receipts")
            .insert({
              user_id: user.id,
              transaction_id: transactionId,
              store_id: receiptDraft.storeId || null,
              image_path: imagePath,
              pdf_path: pdfPath,
              link_url: receiptDraft.linkUrl || null,
              occurred_on: date,
            })
            .select()
            .single();

          if (receiptRow && receiptDraft.items.length > 0) {
            const itemsPayload = receiptDraft.items.map((it) => ({
              user_id: user.id,
              receipt_id: receiptRow.id,
              raw_name: it.raw_name || it.display_name || "Tétel",
              display_name: it.display_name || null,
              item_key: normalizeItemKey(it.raw_name || it.display_name || ""),
              category_id: it.category_id || null,
              quantity: Number(it.quantity) || 1,
              unit_price: Number(it.quantity) > 0 ? Number(it.total_price) / Number(it.quantity) : null,
              total_price: Number(it.total_price) || 0,
            }));
            const { data: insertedItems } = await supabase.from("receipt_items").insert(itemsPayload).select();

            if (insertedItems) {
              for (let i = 0; i < insertedItems.length; i++) {
                const draftItem = receiptDraft.items[i];
                const insertedItem = insertedItems[i];
                const validSplits = draftItem.splitRows.filter((r) => r.person_id && Number(r.amount) > 0);
                if (validSplits.length > 0) {
                  await supabase.from("receipt_item_splits").insert(
                    validSplits.map((r) => ({
                      user_id: user.id,
                      receipt_item_id: insertedItem.id,
                      person_id: r.person_id,
                      amount: Number(r.amount),
                    }))
                  );
                }
                if (draftItem.saveAsRule && insertedItem.item_key) {
                  const defaultPersonId = validSplits[0]?.person_id || null;
                  const defaultSplit =
                    validSplits.length === 0
                      ? "none"
                      : Math.abs(Number(validSplits[0].amount) - Number(draftItem.total_price)) < 1
                      ? "full"
                      : "half";
                  await supabase.from("item_rules").upsert(
                    {
                      user_id: user.id,
                      item_key: insertedItem.item_key,
                      display_name: draftItem.display_name || null,
                      category_id: draftItem.category_id || null,
                      default_person_id: defaultPersonId,
                      default_split: defaultSplit,
                    },
                    { onConflict: "user_id,item_key" }
                  );
                }
              }
            }
          }
        }
      }
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
          <AmountInput
            placeholder="0"
            value={amount}
            onChange={setAmount}
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

        {/* Blokk csatolása */}
        {type === "expense" && (
          <div className="mb-4">
            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Blokk</label>
            {receiptDraft ? (
              <div className="glass rounded-2xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-signal/10 flex items-center justify-center shrink-0">
                  <Icon name="receipt" className="w-4.5 h-4.5 text-signal" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">
                    {stores.find((s) => s.id === receiptDraft.storeId)?.name || "Blokk csatolva"}
                  </p>
                  <p className="text-xs text-slate-400">
                    {receiptDraft.items.length} tétel
                    {receiptDraft.items.length > 0 &&
                      ` · ${formatShortMoney(
                        receiptDraft.items.reduce((s, it) => s + (Number(it.total_price) || 0), 0),
                        currency
                      )}`}
                  </p>
                </div>
                <button
                  onClick={() => setReceiptSheetOpen(true)}
                  className="text-xs font-medium text-signal shrink-0"
                >
                  Szerkesztés
                </button>
                <button
                  onClick={() => setReceiptDraft(null)}
                  className="w-8 h-8 shrink-0 rounded-full bg-coral/10 text-coral flex items-center justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setReceiptSheetOpen(true)}
                className="w-full py-2.5 rounded-2xl border border-dashed border-slate-400/40 text-sm text-slate-500 flex items-center justify-center gap-1.5"
              >
                <Icon name="receipt" className="w-4 h-4" /> Blokk csatolása
              </button>
            )}
          </div>
        )}

        {/* Splits */}
        {type === "expense" && !hasReceiptItems && (
          <div className="mb-4">
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Megosztás</label>
              {people.length > 0 && (
                <button
                  onClick={addSplitRow}
                  className="text-xs font-medium text-signal flex items-center gap-1"
                >
                  <Plus className="w-3 h-3" /> Személy
                </button>
              )}
            </div>
            {people.length === 0 && splitRows.length === 0 ? (
              <p className="text-xs text-slate-400">Nincs még személy felvéve a Beállítások &gt; Személyek alatt.</p>
            ) : (
              <div className="space-y-2">
                {splitRows.map((row, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <select
                      value={row.person_id}
                      onChange={(e) => updateSplitRow(i, { person_id: e.target.value })}
                      className="flex-1 px-3 py-2 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm"
                    >
                      {people.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <AmountInput
                      placeholder="0"
                      value={row.amount}
                      onChange={(v) => updateSplitRow(i, { amount: v })}
                      className="w-24 px-3 py-2 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm font-mono tabular"
                    />
                    <button
                      onClick={() => removeSplitRow(i)}
                      className="w-8 h-8 shrink-0 rounded-full bg-coral/10 text-coral flex items-center justify-center"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {splitRows.length > 0 && (
              <p className={`text-xs mt-2 ${ownShare < 0 ? "text-coral" : "text-slate-400"}`}>
                Saját részed: {ownShare.toLocaleString("hu-HU")} {currency}
              </p>
            )}
          </div>
        )}

        {type === "expense" && hasReceiptItems && (
          <p className={`text-xs mb-4 -mt-2 ${ownShare < 0 ? "text-coral" : "text-slate-400"}`}>
            A megosztás a blokk tételeinél van beállítva. Saját részed: {ownShare.toLocaleString("hu-HU")} {currency}
          </p>
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

      {receiptSheetOpen && (
        <ReceiptSheet
          stores={stores}
          people={people}
          categories={categories}
          itemRules={itemRules}
          priorItems={priorReceiptItems}
          defaultSplitPersonId={defaultSplitPersonId}
          warnOnPriceChange={warnOnPriceChange}
          initialDraft={receiptDraft || emptyReceiptDraft()}
          onClose={() => setReceiptSheetOpen(false)}
          onCreateStore={onCreateStore}
          onSave={(draft) => {
            setReceiptDraft(draft);
            setReceiptSheetOpen(false);
          }}
        />
      )}
    </div>
  );
}
