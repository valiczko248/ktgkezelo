"use client";

import { useMemo, useRef, useState } from "react";
import type { Category, ItemRule, Person, ReceiptItem, Store } from "@/lib/types";
import { normalizeItemKey } from "@/lib/items";
import { parseReceiptLines, recognizeReceiptText } from "@/lib/ocr";
import { fileToDataUrl, normalizeImage, stitchImagesVertically } from "@/lib/imageStitch";
import { type ItemDraft, type ItemSplitDraft, type ReceiptDraft, emptyItemDraft } from "@/lib/receiptDraft";
import { Icon, X, Check, Plus, Trash2 } from "./Icon";
import { AmountInput } from "./AmountInput";

export type { ItemDraft, ItemSplitDraft, ReceiptDraft } from "@/lib/receiptDraft";
export { emptyReceiptDraft } from "@/lib/receiptDraft";

const emptyItem = emptyItemDraft;

export function ReceiptSheet({
  stores,
  people,
  categories,
  itemRules,
  priorItems,
  defaultSplitPersonId,
  warnOnPriceChange,
  transactionAmount,
  initialDraft,
  onClose,
  onSave,
  onCreateStore,
}: {
  stores: Store[];
  people: Person[];
  categories: Category[];
  itemRules: ItemRule[];
  priorItems: ReceiptItem[];
  defaultSplitPersonId: string | null;
  warnOnPriceChange: boolean;
  transactionAmount: number;
  initialDraft: ReceiptDraft | null;
  onClose: () => void;
  onSave: (draft: ReceiptDraft) => void;
  onCreateStore: (name: string) => Promise<Store | null>;
}) {
  const [mode, setMode] = useState<"photo" | "pdf" | "link">("photo");
  const [storeId, setStoreId] = useState(initialDraft?.storeId || "");
  const [photos, setPhotos] = useState<string[]>(initialDraft?.imageDataUrl ? [initialDraft.imageDataUrl] : []);
  const [pdfFile, setPdfFile] = useState<File | null>(initialDraft?.pdfFile || null);
  const [linkUrl, setLinkUrl] = useState(initialDraft?.linkUrl || "");
  const [items, setItems] = useState<ItemDraft[]>(initialDraft?.items || []);
  const [ocrRunning, setOcrRunning] = useState(false);
  const [newStoreName, setNewStoreName] = useState("");
  const expenseCategories = categories.filter((c) => c.kind === "expense");

  const photoInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const lastPriceByKey = useMemo(() => {
    const map: Record<string, number> = {};
    // legrégebbitől a legújabbig soroljuk be, hogy a legutolsó ár maradjon a mapben
    const sorted = priorItems.slice().sort((a, b) => (a.created_at < b.created_at ? -1 : 1));
    for (const it of sorted) map[it.item_key] = Number(it.total_price);
    return map;
  }, [priorItems]);

  async function addPhoto(file: File) {
    const dataUrl = await fileToDataUrl(file);
    setPhotos((p) => [...p, dataUrl]);
  }

  function removePhoto(i: number) {
    setPhotos((p) => p.filter((_, idx) => idx !== i));
  }

  async function runOcr() {
    if (photos.length === 0) return;
    setOcrRunning(true);
    try {
      const stitched = photos.length > 1 ? await stitchImagesVertically(photos) : await normalizeImage(photos[0]);
      setPhotos([stitched]);
      const text = await recognizeReceiptText(stitched);
      const lines = parseReceiptLines(text).filter((l) => l.guessedPrice !== null);
      const newItems = lines.map((l) => applyItemDefaults({ ...emptyItem(), raw_name: l.guessedName, total_price: String(l.guessedPrice) }));
      setItems((prev) => [...prev, ...newItems]);
    } catch {
      // OCR sikertelen - a user manuálisan is felviheti a tételeket
    } finally {
      setOcrRunning(false);
    }
  }

  function applyItemDefaults(item: ItemDraft): ItemDraft {
    const key = normalizeItemKey(item.raw_name);
    if (!key) return item;
    const rule = itemRules.find((r) => r.item_key === key);
    let next = { ...item };
    if (rule) {
      if (!next.display_name && rule.display_name) next.display_name = rule.display_name;
      if (!next.category_id && rule.category_id) next.category_id = rule.category_id;
      if (next.splitRows.length === 0 && rule.default_split !== "none" && rule.default_person_id) {
        const amount = Number(next.total_price) || 0;
        const share = rule.default_split === "half" ? amount / 2 : amount;
        next.splitRows = [{ person_id: rule.default_person_id, amount: share ? String(share) : "" }];
      }
    }
    const lastPrice = lastPriceByKey[key];
    if (warnOnPriceChange && lastPrice !== undefined && Number(next.total_price) > 0 && lastPrice !== Number(next.total_price)) {
      next.priceWarning = `Ez a tétel már szerepelt ${lastPrice.toLocaleString("hu-HU")} Ft-ért, most ${Number(next.total_price).toLocaleString("hu-HU")} Ft.`;
    } else {
      next.priceWarning = null;
    }
    return next;
  }

  function addManualItem() {
    setItems((prev) => [...prev, emptyItem()]);
  }

  function updateItem(index: number, patch: Partial<ItemDraft>) {
    setItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const merged = { ...item, ...patch };
        if (patch.raw_name !== undefined || patch.total_price !== undefined) {
          return applyItemDefaults(merged);
        }
        return merged;
      })
    );
  }

  function removeItem(index: number) {
    setItems((prev) => prev.filter((_, i) => i !== index));
  }

  function toggleHalfSplit(index: number, checked: boolean) {
    const item = items[index];
    if (!checked) {
      updateItem(index, { splitRows: [] });
      return;
    }
    const personId = defaultSplitPersonId || people[0]?.id;
    if (!personId) return;
    const amount = (Number(item.total_price) || 0) / 2;
    updateItem(index, { splitRows: [{ person_id: personId, amount: amount ? String(amount) : "" }] });
  }

  function addSplitRow(index: number) {
    if (people.length === 0) return;
    const item = items[index];
    updateItem(index, { splitRows: [...item.splitRows, { person_id: people[0].id, amount: "" }] });
  }

  function updateSplitRow(itemIndex: number, splitIndex: number, patch: Partial<ItemSplitDraft>) {
    const item = items[itemIndex];
    const splitRows = item.splitRows.map((r, i) => (i === splitIndex ? { ...r, ...patch } : r));
    updateItem(itemIndex, { splitRows });
  }

  function removeSplitRow(itemIndex: number, splitIndex: number) {
    const item = items[itemIndex];
    updateItem(itemIndex, { splitRows: item.splitRows.filter((_, i) => i !== splitIndex) });
  }

  async function createStore() {
    if (!newStoreName.trim()) return;
    const store = await onCreateStore(newStoreName.trim());
    if (store) setStoreId(store.id);
    setNewStoreName("");
  }

  function handleDone() {
    onSave({
      storeId,
      imageDataUrl: mode === "photo" ? photos[0] || null : null,
      pdfFile: mode === "pdf" ? pdfFile : null,
      linkUrl: mode === "link" ? linkUrl : "",
      items,
      existingImagePath: mode === "photo" && !photos[0] ? initialDraft?.existingImagePath || null : null,
      existingPdfPath: mode === "pdf" && !pdfFile ? initialDraft?.existingPdfPath || null : null,
    });
  }

  const itemsTotal = items.reduce((s, it) => s + (Number(it.total_price) || 0), 0);
  const rawMismatch = itemsTotal - transactionAmount;
  const amountMismatch = Math.abs(rawMismatch) >= 1 ? rawMismatch : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-lg glass-strong rounded-t-4xl sm:rounded-4xl p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] max-h-[92dvh] overflow-y-auto animate-fade-up">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-semibold text-lg">Blokk csatolása</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full glass flex items-center justify-center">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Bolt */}
        <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">Bolt</label>
        <div className="flex gap-2 overflow-x-auto pb-1 mb-2">
          {stores.map((s) => (
            <button
              key={s.id}
              onClick={() => setStoreId(s.id)}
              className={`shrink-0 px-3 py-2 rounded-2xl text-xs font-medium border flex items-center gap-1.5 ${
                storeId === s.id ? "border-signal bg-signal/10 text-signal" : "border-white/60 dark:border-white/10 glass"
              }`}
            >
              <Icon name={s.icon} className="w-3.5 h-3.5" /> {s.name}
            </button>
          ))}
        </div>
        <div className="flex gap-2 mb-4">
          <input
            value={newStoreName}
            onChange={(e) => setNewStoreName(e.target.value)}
            placeholder="+ Új bolt neve"
            className="flex-1 px-3 py-2 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-xs"
          />
          <button onClick={createStore} className="px-3 py-2 rounded-2xl bg-signal/10 text-signal text-xs font-medium">
            Hozzáad
          </button>
        </div>

        {/* Bevitel módja */}
        <div className="flex gap-1 mb-4 p-1 rounded-2xl bg-slate-500/10">
          {(
            [
              ["photo", "Fotó", "camera"],
              ["pdf", "PDF", "file-text"],
              ["link", "Link", "link"],
            ] as [typeof mode, string, string][]
          ).map(([m, label, icon]) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`flex-1 py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-1 ${
                mode === m ? "bg-white dark:bg-white/10 text-signal shadow-sm" : "text-slate-500"
              }`}
            >
              <Icon name={icon} className="w-3.5 h-3.5" /> {label}
            </button>
          ))}
        </div>

        {mode === "photo" && (
          <div className="mb-4">
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (file) await addPhoto(file);
                e.target.value = "";
              }}
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={async (e) => {
                const files = Array.from(e.target.files || []);
                for (const file of files) await addPhoto(file);
                e.target.value = "";
              }}
            />
            <div className="flex gap-2 overflow-x-auto pb-1 mb-2">
              {photos.map((p, i) => (
                <div key={i} className="relative shrink-0">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p} alt="blokk" className="w-16 h-20 object-cover rounded-xl border border-white/60 dark:border-white/10" />
                  <button
                    onClick={() => removePhoto(i)}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-coral text-white flex items-center justify-center"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => photoInputRef.current?.click()}
                className="shrink-0 w-16 h-20 rounded-xl border border-dashed border-slate-400/40 flex flex-col items-center justify-center gap-1 text-slate-400"
              >
                <Icon name="camera" className="w-5 h-5" />
                <span className="text-[10px]">Fotó</span>
              </button>
              <button
                onClick={() => galleryInputRef.current?.click()}
                className="shrink-0 w-16 h-20 rounded-xl border border-dashed border-slate-400/40 flex flex-col items-center justify-center gap-1 text-slate-400"
              >
                <Icon name="image" className="w-5 h-5" />
                <span className="text-[10px]">Galéria</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-400 mb-2">
              Ha a blokk hosszú, fotózd le több részletben (egymás alatti szakaszok) — a program egy képpé fűzi.
            </p>
            <button
              onClick={runOcr}
              disabled={photos.length === 0 || ocrRunning}
              className="w-full py-2.5 rounded-2xl bg-signal/10 text-signal text-sm font-medium disabled:opacity-40"
            >
              {ocrRunning ? "Felismerés folyamatban…" : "Tételek felismerése (OCR)"}
            </button>
          </div>
        )}

        {mode === "pdf" && (
          <div className="mb-4">
            <input
              ref={pdfInputRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => setPdfFile(e.target.files?.[0] || null)}
            />
            <button
              onClick={() => pdfInputRef.current?.click()}
              className="w-full py-6 rounded-2xl border border-dashed border-slate-400/40 flex flex-col items-center justify-center gap-1.5 text-slate-400"
            >
              <Icon name="file-text" className="w-5 h-5" />
              <span className="text-xs">{pdfFile ? pdfFile.name : "PDF kiválasztása"}</span>
            </button>
          </div>
        )}

        {mode === "link" && (
          <div className="mb-4">
            <input
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder="https://…"
              className="w-full px-4 py-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm"
            />
          </div>
        )}

        {/* Tételek */}
        <div className="flex items-center justify-between mb-2">
          <label className="text-xs font-medium text-slate-500 dark:text-slate-400">Tételek</label>
          <span className="text-xs text-slate-400 font-mono tabular">
            Összesen: {itemsTotal.toLocaleString("hu-HU")} Ft
          </span>
        </div>

        {items.length > 0 && amountMismatch !== null && (
          <p className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mb-3 -mt-1">
            <Icon name="alert-triangle" className="w-3.5 h-3.5 shrink-0" />
            A tételek összege {Math.abs(amountMismatch).toLocaleString("hu-HU")} Ft-tal{" "}
            {amountMismatch > 0 ? "több, mint" : "kevesebb, mint"} a tranzakció összege ({transactionAmount.toLocaleString("hu-HU")} Ft).
          </p>
        )}

        <div className="space-y-3 mb-3">
          {items.map((item, i) => (
            <div key={i} className="glass rounded-3xl p-3">
              <div className="flex items-start gap-2 mb-2">
                <div className="flex-1 space-y-1.5">
                  <input
                    value={item.raw_name}
                    onChange={(e) => updateItem(i, { raw_name: e.target.value })}
                    placeholder="Ahogy a blokkon szerepel"
                    className="w-full px-3 py-1.5 rounded-xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm"
                  />
                  <input
                    value={item.display_name}
                    onChange={(e) => updateItem(i, { display_name: e.target.value })}
                    placeholder="Saját elnevezés (opcionális)"
                    className="w-full px-3 py-1.5 rounded-xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-xs"
                  />
                </div>
                <AmountInput
                  value={item.total_price}
                  onChange={(v) => updateItem(i, { total_price: v })}
                  placeholder="Ár"
                  className="w-20 px-2 py-1.5 rounded-xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm font-mono tabular"
                />
                <button
                  onClick={() => removeItem(i)}
                  className="w-8 h-8 shrink-0 rounded-full bg-coral/10 text-coral flex items-center justify-center"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {item.priceWarning && (
                <p className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 mb-2">
                  <Icon name="alert-triangle" className="w-3.5 h-3.5 shrink-0" /> {item.priceWarning}
                </p>
              )}

              <div className="flex gap-1.5 overflow-x-auto pb-1 mb-2">
                {expenseCategories.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => updateItem(i, { category_id: c.id })}
                    className={`shrink-0 px-2.5 py-1.5 rounded-xl text-[11px] font-medium border flex items-center gap-1 ${
                      item.category_id === c.id
                        ? "border-signal bg-signal/10 text-signal"
                        : "border-white/60 dark:border-white/10 glass"
                    }`}
                  >
                    <Icon name={c.icon} className="w-3 h-3" /> {c.name}
                  </button>
                ))}
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mb-1.5">
                <input
                  type="checkbox"
                  checked={item.splitRows.length > 0}
                  onChange={(e) => toggleHalfSplit(i, e.target.checked)}
                />
                Felesbe
              </label>

              {item.splitRows.length > 0 && (
                <div className="space-y-1.5 mb-2">
                  {item.splitRows.map((row, si) => (
                    <div key={si} className="flex items-center gap-1.5">
                      <select
                        value={row.person_id}
                        onChange={(e) => updateSplitRow(i, si, { person_id: e.target.value })}
                        className="flex-1 px-2 py-1.5 rounded-xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-xs"
                      >
                        {people.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                      </select>
                      <AmountInput
                        value={row.amount}
                        onChange={(v) => updateSplitRow(i, si, { amount: v })}
                        className="w-16 px-2 py-1.5 rounded-xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-xs font-mono tabular"
                      />
                      <button
                        onClick={() => removeSplitRow(i, si)}
                        className="w-6 h-6 shrink-0 rounded-full bg-coral/10 text-coral flex items-center justify-center"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => addSplitRow(i)} className="text-[11px] text-signal flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Még egy személy
                  </button>
                </div>
              )}

              <label className="flex items-center gap-2 text-[11px] text-slate-400">
                <input
                  type="checkbox"
                  checked={item.saveAsRule}
                  onChange={(e) => updateItem(i, { saveAsRule: e.target.checked })}
                />
                Mentsd el alapértelmezettként ennél a tételnél
              </label>
            </div>
          ))}
        </div>

        <button
          onClick={addManualItem}
          className="w-full py-2.5 rounded-2xl border border-dashed border-slate-400/40 text-sm text-slate-500 flex items-center justify-center gap-1.5 mb-5"
        >
          <Plus className="w-4 h-4" /> Tétel hozzáadása kézzel
        </button>

        <button
          onClick={handleDone}
          className="w-full py-3 rounded-2xl bg-signal text-white font-medium text-sm flex items-center justify-center gap-2 shadow-glow-signal active:scale-[0.98] transition-transform"
        >
          <Check className="w-4 h-4" /> Kész
        </button>
      </div>
    </div>
  );
}

