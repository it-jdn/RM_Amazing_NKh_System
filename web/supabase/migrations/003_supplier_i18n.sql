-- Supplier names in 3 languages (supp_name = Thai primary, kept for compatibility)
alter table suppliers
  add column if not exists supp_name_en text not null default '',
  add column if not exists supp_name_kr text not null default '';
