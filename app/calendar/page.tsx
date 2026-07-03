"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Account, Category, DayNote, Transaction } from "@/lib/types";
import { TopBar } from "@/components/TopBar";
import { BottomNav } from "@/components/BottomNav";
import { TransactionSheet } from "@/components/TransactionSheet";
import { Icon, ChevronLeft, ChevronRight, X, Plus } from "@/components/Icon";
import { formatMoney, formatShortMoney } from "@/lib/format";

function fmtISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function CalendarPage() {
  const supabase = createClient();
  const [cursor, setCursor] = useState(new Date());
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [dayNotes, setDayNotes] = useState<DayNote[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [noteDraft, setNoteDraft] = useState("");

  const monthStart = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);

  async function loadAll() {
    const [{ data: acc }, { data: cat }, { data: tx }, { data: notes }] = await Promise.all([
      supabase.from("accounts").select("*"),
      supabase.from("categories").select("*"),
      supabase
        .from("transactions")
        .select("*")
        .gte("occurred_on", fmtISO(monthStart))
        .lte("occurred_on", fmtISO(monthEnd)),
      supabase
        .from("day_notes")
        .select("*")
        .gte("the_date", fmtISO(monthStart))
        .lte("the_date", fmtISO(monthEnd)),
    ]);
    setAccounts(acc || []);
    setCategories(cat || []);
    setTxs(tx || []);
    setDayNotes(notes || []);
  }

  useEffect(() => {
    loadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cursor]);

  const dayTotals = useMemo(() => {
    const map: Record<string, { expense: number; income: number; currency: string }> = {};
    for (const t of txs) {
      if (t.type === "transfer") continue;
      if (!map[t.occurred_on]) map[t.occurred_on] = { expense: 0, income: 0, currency: t.currency };
      if (t.type === "expense") map[t.occurred_on].expense += Number(t.amount);
      if (t.type === "income") map[t.occurred_on].income += Number(t.amount);
    }
    return map;
  }, [txs]);

  const maxExpense = Math.max(1, ...Object.values(dayTotals).map((d) => d.expense));

  const weeks = useMemo(() => {
    const firstWeekday = (monthStart.getDay() + 6) % 7; // hétfő=0
    const daysInMonth = monthEnd.getDate();
    const cells: (Date | null)[] = Array(firstWeekday).fill(null);
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));
    while (cells.length % 7 !== 0) cells.push(null);
    const rows: (Date | null)[][] = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return rows;
  }, [cursor]);

  const selectedTxs = selectedDate ? txs.filter((t) => t.occurred_on === selectedDate) : [];
  const selectedNote = selectedDate ? dayNotes.find((n) => n.the_date === selectedDate) : null;

  useEffect(() => {
    setNoteDraft(selectedNote?.note || "");
  }, [selectedDate, selectedNote?.note]);

  async function saveNote() {
    if (!selectedDate) return;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    if (!noteDraft.trim()) {
      if (selectedNote) await supabase.from("day_notes").delete().eq("id", selectedNote.id);
    } else if (selectedNote) {
      await supabase.from("day_notes").update({ note: noteDraft }).eq("id", selectedNote.id);
    } else {
      await supabase.from("day_notes").insert({ user_id: user.id, the_date: selectedDate, note: noteDraft });
    }
    loadAll();
  }

  function categoryOf(id: string | null) {
    return categories.find((c) => c.id === id);
  }

  return (
    <main className="min-h-dvh px-5 pb-32 max-w-lg mx-auto">
      <TopBar title="Naptár" />

      <div className="glass rounded-4xl p-4 mb-5">
        <div className="flex items-center justify-between mb-4 px-1">
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
            className="w-8 h-8 rounded-full flex items-center justify-center active:bg-slate-500/10"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <p className="font-display font-medium capitalize">
            {new Intl.DateTimeFormat("hu-HU", { month: "long", year: "numeric" }).format(cursor)}
          </p>
          <button
            onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
            className="w-8 h-8 rounded-full flex items-center justify-center active:bg-slate-500/10"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="grid grid-cols-7 gap-1 mb-1">
          {["H", "K", "Sze", "Cs", "P", "Szo", "V"].map((d) => (
            <div key={d} className="text-center text-[10px] font-medium text-slate-400 py-1">
              {d}
            </div>
          ))}
        </div>

        {weeks.map((row, i) => (
          <div key={i} className="grid grid-cols-7 gap-1 mb-1">
            {row.map((date, j) => {
              if (!date) return <div key={j} />;
              const iso = fmtISO(date);
              const totals = dayTotals[iso];
              const hasNote = dayNotes.some((n) => n.the_date === iso);
              const intensity = totals ? Math.min(1, totals.expense / maxExpense) : 0;
              const isToday = fmtISO(new Date()) === iso;
              return (
                <button
                  key={j}
                  onClick={() => setSelectedDate(iso)}
                  className={`relative aspect-square rounded-xl flex flex-col items-center justify-center transition-all ${
                    isToday ? "ring-1 ring-signal" : ""
                  }`}
                  style={{
                    backgroundColor: totals?.expense
                      ? `rgba(255, 107, 107, ${0.08 + intensity * 0.32})`
                      : "rgba(148,163,184,0.06)",
                  }}
                >
                  <span className="text-xs font-medium">{date.getDate()}</span>
                  {totals?.expense > 0 && (
                    <span className="text-[8px] font-mono tabular text-coral leading-none mt-0.5">
                      {formatShortMoney(totals.expense, totals.currency).replace(/\s?(HUF|EUR|USD)$/, "")}
                    </span>
                  )}
                  {hasNote && <span className="absolute top-1 right-1 w-1.5 h-1.5 rounded-full bg-signal" />}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-4 px-1 text-xs text-slate-400 mb-2">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-coral/40" /> Kiadás intenzitása
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-signal" /> Van jegyzet
        </span>
      </div>

      {selectedDate && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-sm" onClick={() => setSelectedDate(null)} />
          <div className="relative w-full sm:max-w-md glass-strong rounded-t-4xl sm:rounded-4xl p-5 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] max-h-[85dvh] overflow-y-auto animate-fade-up">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display font-semibold text-lg">
                {new Intl.DateTimeFormat("hu-HU", { weekday: "long", month: "long", day: "numeric" }).format(
                  new Date(selectedDate)
                )}
              </h2>
              <button
                onClick={() => setSelectedDate(null)}
                className="w-8 h-8 rounded-full glass flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-2 mb-4">
              {selectedTxs.length === 0 && (
                <p className="text-sm text-slate-400 text-center py-4">Nincs tétel ezen a napon.</p>
              )}
              {selectedTxs.map((t) => {
                const cat = categoryOf(t.category_id);
                return (
                  <button
                    key={t.id}
                    onClick={() => {
                      setEditing(t);
                      setSheetOpen(true);
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl glass text-left"
                  >
                    <Icon name={t.type === "transfer" ? "arrow-left-right" : cat?.icon || "tag"} className="w-4 h-4" />
                    <span className="flex-1 text-sm">{t.type === "transfer" ? "Átvezetés" : cat?.name}</span>
                    <span
                      className={`font-mono tabular text-sm font-semibold ${
                        t.type === "income" ? "text-mint-dark" : t.type === "expense" ? "text-coral" : "text-signal"
                      }`}
                    >
                      {formatShortMoney(t.amount, t.currency)}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              onClick={() => {
                setEditing(null);
                setSheetOpen(true);
              }}
              className="w-full mb-4 py-2.5 rounded-2xl border border-dashed border-slate-400/40 text-sm text-slate-500 flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Tétel hozzáadása ehhez a naphoz
            </button>

            <label className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5 block">
              Napi jegyzet
            </label>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              onBlur={saveNote}
              placeholder="Pl. Bevásárlás a hónap végi nagybevásárláshoz"
              rows={3}
              className="w-full px-4 py-2.5 rounded-2xl bg-white/70 dark:bg-white/5 border border-white/60 dark:border-white/10 outline-none text-sm resize-none placeholder:text-slate-400"
            />
          </div>
        </div>
      )}

      {sheetOpen && (
        <TransactionSheet
          accounts={accounts}
          categories={categories}
          editing={editing}
          defaultDate={selectedDate || undefined}
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
