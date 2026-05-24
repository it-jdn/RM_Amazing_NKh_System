-- Optional Saudi business registration number for suppliers
alter table suppliers
  add column if not exists supp_business_reg_no text not null default '';
