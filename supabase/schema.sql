-- =====================================================================
-- KÖLTSÉGKÖVETŐ – Adatbázis séma Supabase-hez
-- Futtasd le a Supabase projektedben: Dashboard > SQL Editor > New query
-- =====================================================================

-- ---------- PROFILES ----------
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  base_currency text not null default 'HUF',
  theme text not null default 'system', -- 'light' | 'dark' | 'system'
  created_at timestamptz not null default now()
);

alter table profiles enable row level security;

drop policy if exists "profiles_select_own" on profiles;
create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles_insert_own" on profiles;
create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);
drop policy if exists "profiles_update_own" on profiles;
create policy "profiles_update_own" on profiles
  for update using (auth.uid() = id);

-- Automatikusan létrehoz egy profilt regisztrációkor
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- ACCOUNTS (fiókok: Revolut, OTP, készpénz, stb.) ----------
create table if not exists accounts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  type text not null default 'other', -- bank | cash | card | savings | other
  currency text not null default 'HUF',
  icon text not null default 'wallet',
  color text not null default '#0A84FF',
  initial_balance numeric(14,2) not null default 0,
  is_archived boolean not null default false,
  include_in_stats boolean not null default true,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table accounts enable row level security;
-- Ha az accounts tábla már korábban létrejött (a "create table if not exists" ilyenkor nem
-- csinál semmit), ez az ALTER pótolja az új oszlopot a meglévő táblán is.
alter table accounts add column if not exists include_in_stats boolean not null default true;

drop policy if exists "accounts_all_own" on accounts;
create policy "accounts_all_own" on accounts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- CATEGORIES (alap + egyedi kategóriák) ----------
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade, -- null = globális alap kategória
  parent_id uuid references categories(id) on delete set null,
  name text not null,
  kind text not null default 'expense', -- expense | income
  icon text not null default 'tag',
  color text not null default '#64748B',
  is_default boolean not null default false,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table categories enable row level security;

-- Bárki (bejelentkezett user) látja a saját + a globális alap kategóriákat
drop policy if exists "categories_select" on categories;
create policy "categories_select" on categories
  for select using (user_id is null or auth.uid() = user_id);
drop policy if exists "categories_insert_own" on categories;
create policy "categories_insert_own" on categories
  for insert with check (auth.uid() = user_id);
drop policy if exists "categories_update_own" on categories;
create policy "categories_update_own" on categories
  for update using (auth.uid() = user_id);
drop policy if exists "categories_delete_own" on categories;
create policy "categories_delete_own" on categories
  for delete using (auth.uid() = user_id);

-- ---------- TRANSACTIONS (kiadás / bevétel / átvezetés) ----------
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  to_account_id uuid references accounts(id) on delete set null, -- csak transfer esetén
  category_id uuid references categories(id) on delete set null,
  type text not null default 'expense', -- expense | income | transfer
  amount numeric(14,2) not null,
  currency text not null default 'HUF',
  occurred_on date not null default current_date,
  note text,
  recurring_id uuid, -- ha automatikus levonásból jött
  created_at timestamptz not null default now()
);

alter table transactions enable row level security;

drop policy if exists "transactions_all_own" on transactions;
create policy "transactions_all_own" on transactions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_transactions_user_date on transactions(user_id, occurred_on desc);
create index if not exists idx_transactions_account on transactions(account_id);
create index if not exists idx_transactions_category on transactions(category_id);

-- ---------- DAY NOTES (jegyzet egy adott naptári naphoz) ----------
create table if not exists day_notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  the_date date not null,
  note text not null,
  created_at timestamptz not null default now(),
  unique (user_id, the_date)
);

alter table day_notes enable row level security;

drop policy if exists "day_notes_all_own" on day_notes;
create policy "day_notes_all_own" on day_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- RECURRING RULES (automatikus levonások / bevételek / átvezetések) ----------
create table if not exists recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  to_account_id uuid references accounts(id) on delete set null, -- csak transfer esetén
  category_id uuid references categories(id) on delete set null,
  type text not null default 'expense', -- expense | income | transfer
  amount numeric(14,2) not null,
  currency text not null default 'HUF',
  name text not null,
  frequency text not null default 'monthly', -- daily | weekly | monthly | yearly
  day_of_month int, -- monthly esetén (1-28)
  weekday int, -- weekly esetén (0=vasárnap)
  next_run_date date not null,
  active boolean not null default true,
  note text,
  created_at timestamptz not null default now()
);

alter table recurring_rules enable row level security;
-- Pótlás, ha a tábla már korábban létrejött, mielőtt az átvezetés-típus bekerült volna.
alter table recurring_rules add column if not exists to_account_id uuid references accounts(id) on delete set null;

drop policy if exists "recurring_all_own" on recurring_rules;
create policy "recurring_all_own" on recurring_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- LOANS (áruhitel automatikus törlesztéssel) ----------
create table if not exists loans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  name text not null,
  principal numeric(14,2) not null,
  remaining_balance numeric(14,2) not null,
  monthly_payment numeric(14,2) not null,
  next_run_date date not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table loans enable row level security;

drop policy if exists "loans_all_own" on loans;
create policy "loans_all_own" on loans
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- GOALS (megtakarítási célok) ----------
create table if not exists goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid references accounts(id) on delete set null,
  name text not null,
  target_amount numeric(14,2) not null,
  icon text not null default 'piggy-bank',
  color text not null default '#2FD6A8',
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table goals enable row level security;

drop policy if exists "goals_all_own" on goals;
create policy "goals_all_own" on goals
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- PEOPLE (akikkel megosztod a költéseket) ----------
create table if not exists people (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  color text not null default '#7C6AE0',
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table people enable row level security;

drop policy if exists "people_all_own" on people;
create policy "people_all_own" on people
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- TRANSACTION_SPLITS (mennyi jut egy tranzakcióból egy adott személyre) ----------
create table if not exists transaction_splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid not null references transactions(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  amount numeric(14,2) not null,
  settled_amount numeric(14,2) not null default 0,
  settled_at timestamptz,
  note text,
  created_at timestamptz not null default now()
);

alter table transaction_splits enable row level security;

drop policy if exists "transaction_splits_all_own" on transaction_splits;
create policy "transaction_splits_all_own" on transaction_splits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_transaction_splits_transaction on transaction_splits(transaction_id);
create index if not exists idx_transaction_splits_person on transaction_splits(person_id);

-- ---------- BUDGETS (havi büdzsé kategóriánként) ----------
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category_id uuid not null references categories(id) on delete cascade,
  month date not null, -- mindig a hónap első napja
  amount numeric(14,2) not null,
  currency text not null default 'HUF',
  created_at timestamptz not null default now(),
  unique (user_id, category_id, month)
);

alter table budgets enable row level security;

drop policy if exists "budgets_all_own" on budgets;
create policy "budgets_all_own" on budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- PROFILES bővítés: alapértelmezett megosztási partner + árváltozás-figyelmeztetés ----------
alter table profiles add column if not exists default_split_person_id uuid references people(id) on delete set null;
alter table profiles add column if not exists warn_on_price_change boolean not null default true;

-- ---------- STORES (Lidl, Aldi, Tesco, stb.) ----------
create table if not exists stores (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  icon text not null default 'shopping-cart',
  color text not null default '#64748B',
  is_archived boolean not null default false,
  created_at timestamptz not null default now()
);

alter table stores enable row level security;

drop policy if exists "stores_all_own" on stores;
create policy "stores_all_own" on stores
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- RECEIPTS (blokkok) ----------
create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  transaction_id uuid references transactions(id) on delete cascade,
  store_id uuid references stores(id) on delete set null,
  image_path text,
  pdf_path text,
  link_url text,
  occurred_on date not null default current_date,
  created_at timestamptz not null default now()
);

alter table receipts enable row level security;

drop policy if exists "receipts_all_own" on receipts;
create policy "receipts_all_own" on receipts
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_receipts_transaction on receipts(transaction_id);

-- ---------- RECEIPT_ITEMS (blokk-tételek) ----------
create table if not exists receipt_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  receipt_id uuid not null references receipts(id) on delete cascade,
  raw_name text not null,
  display_name text,
  item_key text not null,
  category_id uuid references categories(id) on delete set null,
  quantity numeric(10,3) not null default 1,
  unit_price numeric(14,2),
  total_price numeric(14,2) not null,
  created_at timestamptz not null default now()
);

alter table receipt_items enable row level security;

drop policy if exists "receipt_items_all_own" on receipt_items;
create policy "receipt_items_all_own" on receipt_items
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_receipt_items_receipt on receipt_items(receipt_id);
create index if not exists idx_receipt_items_item_key on receipt_items(user_id, item_key);

-- ---------- RECEIPT_ITEM_SPLITS (tétel-szintű megosztás személyekkel) ----------
create table if not exists receipt_item_splits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  receipt_item_id uuid not null references receipt_items(id) on delete cascade,
  person_id uuid not null references people(id) on delete cascade,
  amount numeric(14,2) not null,
  settled_amount numeric(14,2) not null default 0,
  settled_at timestamptz,
  created_at timestamptz not null default now()
);

alter table receipt_item_splits enable row level security;

drop policy if exists "receipt_item_splits_all_own" on receipt_item_splits;
create policy "receipt_item_splits_all_own" on receipt_item_splits
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists idx_receipt_item_splits_item on receipt_item_splits(receipt_item_id);
create index if not exists idx_receipt_item_splits_person on receipt_item_splits(person_id);

-- ---------- ITEM_RULES (ismert tétel -> alapértelmezett kategória/személy/megosztás/saját név) ----------
create table if not exists item_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  item_key text not null,
  display_name text,
  category_id uuid references categories(id) on delete set null,
  default_person_id uuid references people(id) on delete set null,
  default_split text not null default 'none', -- 'none' | 'half' | 'full'
  created_at timestamptz not null default now(),
  unique (user_id, item_key)
);

alter table item_rules enable row level security;
-- Pótlás, ha az item_rules tábla már korábban létrejött, mielőtt a saját név mező bekerült volna.
alter table item_rules add column if not exists display_name text;

drop policy if exists "item_rules_all_own" on item_rules;
create policy "item_rules_all_own" on item_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- STORAGE: "receipts" bucket a blokk-képekhez/PDF-ekhez ----------
-- Az objektum elérési útnak `${user_id}/...` prefixűnek kell lennie, ezt a kliens kód biztosítja.
insert into storage.buckets (id, name, public)
values ('receipts', 'receipts', false)
on conflict (id) do nothing;

drop policy if exists "receipts_storage_select_own" on storage.objects;
create policy "receipts_storage_select_own" on storage.objects
  for select using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "receipts_storage_insert_own" on storage.objects;
create policy "receipts_storage_insert_own" on storage.objects
  for insert with check (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "receipts_storage_update_own" on storage.objects;
create policy "receipts_storage_update_own" on storage.objects
  for update using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "receipts_storage_delete_own" on storage.objects;
create policy "receipts_storage_delete_own" on storage.objects
  for delete using (bucket_id = 'receipts' and (storage.foldername(name))[1] = auth.uid()::text);

-- =====================================================================
-- ALAP KATEGÓRIÁK FELTÖLTÉSE (globálisak, minden usernek látszanak)
-- =====================================================================
-- Egyedi index, hogy a script többször is biztonságosan lefuttatható legyen
-- anélkül, hogy duplikálná az alap kategóriákat.
create unique index if not exists idx_categories_default_unique
  on categories (name, kind) where user_id is null;

insert into categories (user_id, name, kind, icon, color, is_default, sort_order) values
  (null, 'Élelmiszer', 'expense', 'shopping-cart', '#2FD6A8', true, 1),
  (null, 'Vendéglátás', 'expense', 'utensils', '#FFB020', true, 2),
  (null, 'Közlekedés', 'expense', 'car', '#0A84FF', true, 3),
  (null, 'Lakhatás', 'expense', 'home', '#7C6AE0', true, 4),
  (null, 'Rezsi', 'expense', 'zap', '#FF6B6B', true, 5),
  (null, 'Egészség', 'expense', 'heart-pulse', '#FF6B6B', true, 6),
  (null, 'Szórakozás', 'expense', 'popcorn', '#0A84FF', true, 7),
  (null, 'Ruházat', 'expense', 'shirt', '#7C6AE0', true, 8),
  (null, 'Utazás', 'expense', 'plane', '#2FD6A8', true, 9),
  (null, 'Oktatás', 'expense', 'graduation-cap', '#FFB020', true, 10),
  (null, 'Előfizetések', 'expense', 'repeat', '#64748B', true, 11),
  (null, 'Egyéb kiadás', 'expense', 'more-horizontal', '#64748B', true, 12),
  (null, 'Fizetés', 'income', 'banknote', '#2FD6A8', true, 13),
  (null, 'Vállalkozás', 'income', 'briefcase', '#2FD6A8', true, 14),
  (null, 'Ajándék', 'income', 'gift', '#2FD6A8', true, 15),
  (null, 'Egyéb bevétel', 'income', 'plus-circle', '#2FD6A8', true, 16)
on conflict (name, kind) where user_id is null do nothing;
