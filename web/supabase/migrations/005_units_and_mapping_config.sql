-- Units master, per-shop mapping config, version/history tables

create table units (
  unit_code text primary key,
  display_name text not null,
  normalized_key text not null unique,
  usage_count_main integer not null default 0,
  usage_count_sub integer not null default 0,
  last_used_at timestamptz,
  source text not null default 'transaction',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create index idx_units_usage_main on units (usage_count_main desc);
create index idx_units_usage_sub on units (usage_count_sub desc);

create table unit_pair_hints (
  id bigint generated always as identity primary key,
  main_unit_code text not null references units (unit_code),
  sub_unit_code text not null references units (unit_code),
  convert_rate numeric(12, 4) not null default 1,
  use_count integer not null default 1,
  item_code text references items (item_code) on delete cascade,
  supp_code text references suppliers (supp_code) on delete cascade
);

create index idx_unit_pair_hints_lookup on unit_pair_hints (item_code, supp_code);
create index idx_unit_pair_hints_main on unit_pair_hints (main_unit_code);

-- Per-shop product config (units + prices)
alter table supplier_item_mapping
  add column if not exists main_unit_code text references units (unit_code),
  add column if not exists sub_unit_code text references units (unit_code),
  add column if not exists convert_rate numeric(12, 4),
  add column if not exists standard_unit_price numeric(14, 2),
  add column if not exists last_purchase_unit_price numeric(14, 2),
  add column if not exists last_purchase_at timestamptz,
  add column if not exists active boolean not null default true,
  add column if not exists updated_at timestamptz,
  add column if not exists updated_by text;

update supplier_item_mapping
set standard_unit_price = unit_price
where standard_unit_price is null;

-- Optional FK on items (keep legacy text columns)
alter table items
  add column if not exists main_unit_code text references units (unit_code),
  add column if not exists sub_unit_code text references units (unit_code);

create table mapping_price_history (
  id bigint generated always as identity primary key,
  supp_code text not null references suppliers (supp_code) on delete cascade,
  item_code text not null references items (item_code) on delete cascade,
  unit_price numeric(14, 2) not null,
  price_kind text not null default 'standard'
    check (price_kind in ('standard', 'last_purchase')),
  source text not null check (source in ('manual', 'intake')),
  txn_id bigint references transactions (id) on delete set null,
  recorded_at timestamptz not null default now(),
  recorded_by text
);

create index idx_mapping_price_hist_lookup
  on mapping_price_history (supp_code, item_code, recorded_at desc);

create table item_versions (
  id bigint generated always as identity primary key,
  item_code text not null references items (item_code) on delete cascade,
  version integer not null,
  item_name_th text not null,
  item_name_en text not null default '',
  item_name_kr text not null default '',
  main_unit text not null default '',
  sub_unit text not null default '',
  main_unit_code text,
  sub_unit_code text,
  convert_rate numeric(12, 4) not null default 1,
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  changed_by text,
  change_reason text,
  unique (item_code, version)
);

create table supplier_item_mapping_versions (
  id bigint generated always as identity primary key,
  supp_code text not null references suppliers (supp_code) on delete cascade,
  item_code text not null references items (item_code) on delete cascade,
  version integer not null,
  main_unit_code text,
  sub_unit_code text,
  main_unit text not null default '',
  sub_unit text not null default '',
  convert_rate numeric(12, 4) not null default 1,
  standard_unit_price numeric(14, 2) not null default 0,
  last_purchase_unit_price numeric(14, 2),
  valid_from timestamptz not null default now(),
  valid_to timestamptz,
  changed_by text,
  change_reason text,
  unique (supp_code, item_code, version)
);

alter table transactions
  add column if not exists standard_unit_price_at_save numeric(14, 2);

comment on column transactions.standard_unit_price_at_save is 'Standard list price at time of intake save';

alter table units enable row level security;
alter table unit_pair_hints enable row level security;
alter table mapping_price_history enable row level security;
alter table item_versions enable row level security;
alter table supplier_item_mapping_versions enable row level security;

create policy "deny_anon_units" on units for all to anon using (false);
create policy "deny_anon_unit_pair_hints" on unit_pair_hints for all to anon using (false);
create policy "deny_anon_mapping_price_history" on mapping_price_history for all to anon using (false);
create policy "deny_anon_item_versions" on item_versions for all to anon using (false);
create policy "deny_anon_mapping_versions" on supplier_item_mapping_versions for all to anon using (false);
