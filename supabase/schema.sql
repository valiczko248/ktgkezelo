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

create policy "profiles_select_own" on profiles
  for select using (auth.uid() = id);
create policy "profiles_insert_own" on profiles
  for insert with check (auth.uid() = id);
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
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

alter table accounts enable row level security;

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
create policy "categories_select" on categories
  for select using (user_id is null or auth.uid() = user_id);
create policy "categories_insert_own" on categories
  for insert with check (auth.uid() = user_id);
create policy "categories_update_own" on categories
  for update using (auth.uid() = user_id);
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

create policy "day_notes_all_own" on day_notes
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ---------- RECURRING RULES (automatikus levonások / bevételek) ----------
create table if not exists recurring_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null references accounts(id) on delete cascade,
  category_id uuid references categories(id) on delete set null,
  type text not null default 'expense', -- expense | income
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

create policy "recurring_all_own" on recurring_rules
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

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

create policy "budgets_all_own" on budgets
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- =====================================================================
-- ALAP KATEGÓRIÁK FELTÖLTÉSE (globálisak, minden usernek látszanak)
-- =====================================================================
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
on conflict do nothing;
