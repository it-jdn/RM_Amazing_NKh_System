-- User profile fields (first/last name, email)
alter table app_users
  add column if not exists first_name text,
  add column if not exists last_name text not null default '',
  add column if not exists email text not null default '',
  add column if not exists updated_at timestamptz not null default now();

update app_users
set
  first_name = coalesce(nullif(trim(first_name), ''), trim(display_name)),
  last_name = coalesce(nullif(trim(last_name), ''), '')
where first_name is null or trim(first_name) = '';

alter table app_users alter column first_name set not null;

create unique index if not exists app_users_email_lower_unique
  on app_users (lower(trim(email)))
  where trim(email) <> '';
