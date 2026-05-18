-- Amazing Nongkhai — Raw Material System
-- Run in Supabase SQL Editor or via supabase CLI

create type app_role as enum ('operator', 'admin', 'manager');

create table suppliers (
  supp_code text primary key,
  supp_name text not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table items (
  item_code text primary key,
  item_name_th text not null,
  item_name_en text not null default '',
  item_name_kr text not null default '',
  main_unit text not null,
  sub_unit text not null,
  convert_rate numeric(12, 4) not null default 1,
  created_at timestamptz not null default now()
);

create table supplier_item_mapping (
  supp_code text not null references suppliers (supp_code) on delete cascade,
  item_code text not null references items (item_code) on delete cascade,
  unit_price numeric(14, 2) not null default 0,
  primary key (supp_code, item_code)
);

create sequence transaction_no_seq start 1;

create table transactions (
  id bigint generated always as identity primary key,
  no bigint not null default nextval('transaction_no_seq'),
  txn_date date not null,
  supp_code text not null references suppliers (supp_code),
  supp_name text not null,
  item_code text not null references items (item_code),
  item_name_th text not null,
  qty numeric(14, 4) not null,
  main_unit text,
  convert_rate numeric(12, 4),
  sub_unit text,
  total_sub numeric(14, 4),
  unit_price numeric(14, 2),
  total_price numeric(14, 2) not null,
  note text not null default '',
  saved_at timestamptz not null default now()
);

create index idx_txn_date on transactions (txn_date);
create index idx_txn_supp_date on transactions (txn_date, supp_code);
create index idx_txn_item on transactions (item_code);

create table app_users (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  pin_hash text not null,
  role app_role not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- RLS: deny direct client access (API uses service role)
alter table suppliers enable row level security;
alter table items enable row level security;
alter table supplier_item_mapping enable row level security;
alter table transactions enable row level security;
alter table app_users enable row level security;

create policy "deny_anon_suppliers" on suppliers for all to anon using (false);
create policy "deny_anon_items" on items for all to anon using (false);
create policy "deny_anon_mapping" on supplier_item_mapping for all to anon using (false);
create policy "deny_anon_transactions" on transactions for all to anon using (false);
create policy "deny_anon_app_users" on app_users for all to anon using (false);
