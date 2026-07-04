import type { SupabaseClient } from "@supabase/supabase-js";
import type { Account, Frequency, Loan, RecurringRule } from "./types";

function nextRecurringDate(from: string, freq: Frequency): string {
  const d = new Date(from);
  if (freq === "daily") d.setDate(d.getDate() + 1);
  if (freq === "weekly") d.setDate(d.getDate() + 7);
  if (freq === "monthly") d.setMonth(d.getMonth() + 1);
  if (freq === "yearly") d.setFullYear(d.getFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

function nextMonth(from: string): string {
  const d = new Date(from);
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

// Lefuttatja az esedékes ismétlődő tételeket (kiadás/bevétel/átvezetés) — kliens oldali "cron".
export async function processDueRecurring(supabase: SupabaseClient, userId: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase
    .from("recurring_rules")
    .select("*")
    .eq("active", true)
    .lte("next_run_date", today);
  const rules = (data as RecurringRule[]) || [];

  for (const r of rules) {
    let runDate = r.next_run_date;
    while (runDate <= today) {
      await supabase.from("transactions").insert({
        user_id: userId,
        account_id: r.account_id,
        to_account_id: r.type === "transfer" ? r.to_account_id : null,
        category_id: r.type === "transfer" ? null : r.category_id,
        type: r.type,
        amount: r.amount,
        currency: r.currency,
        occurred_on: runDate,
        note: r.note || r.name,
        recurring_id: r.id,
      });
      runDate = nextRecurringDate(runDate, r.frequency);
    }
    await supabase.from("recurring_rules").update({ next_run_date: runDate }).eq("id", r.id);
  }
}

// Lefuttatja az esedékes hitel-törlesztéseket, csökkentve a fennmaradó összeget.
export async function processDueLoans(supabase: SupabaseClient, userId: string, accounts: Account[]): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const { data } = await supabase.from("loans").select("*").eq("active", true).lte("next_run_date", today);
  const loans = (data as Loan[]) || [];

  for (const l of loans) {
    let runDate = l.next_run_date;
    let remaining = Number(l.remaining_balance);
    const account = accounts.find((a) => a.id === l.account_id);
    while (runDate <= today && remaining > 0) {
      const payment = Math.min(Number(l.monthly_payment), remaining);
      await supabase.from("transactions").insert({
        user_id: userId,
        account_id: l.account_id,
        category_id: l.category_id,
        type: "expense",
        amount: payment,
        currency: account?.currency || "HUF",
        occurred_on: runDate,
        note: `${l.name} törlesztés`,
      });
      remaining -= payment;
      runDate = nextMonth(runDate);
    }
    await supabase
      .from("loans")
      .update({ remaining_balance: remaining, next_run_date: runDate, active: remaining > 0 })
      .eq("id", l.id);
  }
}
