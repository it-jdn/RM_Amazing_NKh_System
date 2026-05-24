-- Run after appending historical transactions (slip_id may be null on new rows).
-- Safe to re-run: only processes transactions where slip_id is null.

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

-- Align sequence with max transaction no (run after import)
select setval(
  'transaction_no_seq',
  coalesce((select max(no) from transactions), 1)
);
