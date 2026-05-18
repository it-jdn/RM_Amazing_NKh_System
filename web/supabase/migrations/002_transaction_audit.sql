-- Audit: who saved each transaction batch row
alter table transactions
  add column if not exists saved_by_user_id uuid references app_users (id),
  add column if not exists saved_by_name text not null default '';

create index if not exists idx_txn_saved_at on transactions (saved_at desc);
