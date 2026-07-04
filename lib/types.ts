export type AccountType = "bank" | "cash" | "card" | "savings" | "other";
export type CategoryKind = "expense" | "income";
export type TxType = "expense" | "income" | "transfer";
export type Frequency = "daily" | "weekly" | "monthly" | "yearly";

export interface Profile {
  id: string;
  display_name: string | null;
  base_currency: string;
  theme: "light" | "dark" | "system";
  default_split_person_id: string | null;
  warn_on_price_change: boolean;
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
  include_in_stats: boolean;
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
  to_account_id: string | null;
  category_id: string | null;
  type: "expense" | "income" | "transfer";
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

export interface Person {
  id: string;
  user_id: string;
  name: string;
  color: string;
  is_archived: boolean;
  created_at: string;
}

export interface TransactionSplit {
  id: string;
  user_id: string;
  transaction_id: string;
  person_id: string;
  amount: number;
  settled_amount: number;
  settled_at: string | null;
  note: string | null;
  created_at: string;
}

export interface Store {
  id: string;
  user_id: string;
  name: string;
  icon: string;
  color: string;
  is_archived: boolean;
  created_at: string;
}

export interface Receipt {
  id: string;
  user_id: string;
  transaction_id: string | null;
  store_id: string | null;
  image_path: string | null;
  pdf_path: string | null;
  link_url: string | null;
  occurred_on: string;
  created_at: string;
}

export interface ReceiptItem {
  id: string;
  user_id: string;
  receipt_id: string;
  raw_name: string;
  display_name: string | null;
  item_key: string;
  category_id: string | null;
  quantity: number;
  unit_price: number | null;
  total_price: number;
  created_at: string;
}

export type DefaultSplitMode = "none" | "half" | "full";

export interface ReceiptItemSplit {
  id: string;
  user_id: string;
  receipt_item_id: string;
  person_id: string;
  amount: number;
  settled_amount: number;
  settled_at: string | null;
  created_at: string;
}

export interface ItemRule {
  id: string;
  user_id: string;
  item_key: string;
  display_name: string | null;
  category_id: string | null;
  default_person_id: string | null;
  default_split: DefaultSplitMode;
  created_at: string;
}

export interface Loan {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  name: string;
  principal: number;
  remaining_balance: number;
  monthly_payment: number;
  next_run_date: string;
  active: boolean;
  created_at: string;
}

export interface Goal {
  id: string;
  user_id: string;
  account_id: string | null;
  name: string;
  target_amount: number;
  icon: string;
  color: string;
  is_archived: boolean;
  created_at: string;
}
