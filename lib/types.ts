export type AccountType = "bank" | "cash" | "card" | "savings" | "other";
export type CategoryKind = "expense" | "income";
export type TxType = "expense" | "income" | "transfer";
export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

export interface Profile {
  id: string;
  display_name: string | null;
  base_currency: string;
  theme: "light" | "dark" | "system";
  created_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  currency: string;
  icon: string;
  color: string;
  initial_balance: number;
  is_archived: boolean;
  sort_order: number;
  created_at: string;
}

export interface Category {
  id: string;
  user_id: string | null;
  parent_id: string | null;
  name: string;
  kind: CategoryKind;
  icon: string;
  color: string;
  is_default: boolean;
  sort_order: number;
  created_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  to_account_id: string | null;
  category_id: string | null;
  type: TxType;
  amount: number;
  currency: string;
  occurred_on: string;
  note: string | null;
  recurring_id: string | null;
  created_at: string;
}

export interface DayNote {
  id: string;
  user_id: string;
  the_date: string;
  note: string;
  created_at: string;
}

export interface RecurringRule {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  type: "expense" | "income";
  amount: number;
  currency: string;
  name: string;
  frequency: Frequency;
  day_of_month: number | null;
  weekday: number | null;
  next_run_date: string;
  active: boolean;
  note: string | null;
  created_at: string;
}

export interface Budget {
  id: string;
  user_id: string;
  category_id: string;
  month: string;
  amount: number;
  currency: string;
  created_at: string;
}
