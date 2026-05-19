-- Multiple intake slips per shop per day; slip-level audit timestamps

create table intake_slips (
  id uuid primary key default gen_random_uuid(),
  txn_date date not null,
  supp_code text not null references suppliers (supp_code),
  supp_name text not null default '',
  slip_note text not null default '',
  created_at timestamptz not null default now(),
  created_by_user_id uuid references app_users (id) on delete set null,
  created_by_name text not null default '',
  updated_at timestamptz not null default now(),
  updated_by_user_id uuid references app_users (id) on delete set null,
  updated_by_name text not null default ''
);

create index idx_intake_slips_date on intake_slips (txn_date desc);
create index idx_intake_slips_date_supp on intake_slips (txn_date, supp_code);
create index idx_intake_slips_created_at on intake_slips (created_at desc);

alter table transactions
  add column if not exists slip_id uuid references intake_slips (id) on delete cascade;

create index if not exists idx_txn_slip_id on transactions (slip_id);

-- Backfill: one slip per distinct (date, shop, saved_at batch)
insert into intake_slips (
  txn_date,
  supp_code,
  supp_name,
  slip_note,
  created_at,
  created_by_user_id,
  created_by_name,
  updated_at,
  updated_by_user_id,
  updated_by_name
)
select
  g.txn_date,
  g.supp_code,
  coalesce(g.supp_name, ''),
  coalesce(g.slip_note, ''),
  g.saved_at,
  g.saved_by_user_id,
  coalesce(g.saved_by_name, ''),
  g.saved_at,
  g.saved_by_user_id,
  coalesce(g.saved_by_name, '')
from (
  select
    t.txn_date,
    t.supp_code,
    max(t.supp_name) as supp_name,
    (
      select nullif(trim(x.note), '')
      from transactions x
      where x.txn_date = t.txn_date
        and x.supp_code = t.supp_code
        and x.saved_at = t.saved_at
        and nullif(trim(x.note), '') is not null
      limit 1
    ) as slip_note,
    t.saved_at,
    max(t.saved_by_user_id::text)::uuid as saved_by_user_id,
    max(t.saved_by_name) as saved_by_name
  from transactions t
  where t.slip_id is null
  group by t.txn_date, t.supp_code, t.saved_at
) g;

update transactions t
set slip_id = s.id
from intake_slips s
where t.slip_id is null
  and t.txn_date = s.txn_date
  and t.supp_code = s.supp_code
  and t.saved_at = s.created_at;

alter table intake_slips enable row level security;
create policy "deny_anon_intake_slips" on intake_slips for all to anon using (false);
