-- One-time: convert txn_date stored with Buddhist calendar year (พ.ศ.) to CE (ค.ศ.)
-- Safe on empty DB (0 rows updated). Idempotent: rows already in CE are unchanged.

update transactions
set txn_date = (txn_date - interval '543 years')::date
where extract(year from txn_date) >= 2400;

update intake_slips
set txn_date = (txn_date - interval '543 years')::date
where extract(year from txn_date) >= 2400;
