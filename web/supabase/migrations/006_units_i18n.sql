-- Unit names in 3 languages (display_name = Thai primary, kept for compatibility)
alter table units
  add column if not exists unit_name_th text,
  add column if not exists unit_name_en text not null default '',
  add column if not exists unit_name_kr text not null default '';

update units
set unit_name_th = coalesce(nullif(trim(unit_name_th), ''), display_name)
where unit_name_th is null or trim(unit_name_th) = '';

alter table units
  alter column unit_name_th set not null;

update units
set display_name = unit_name_th
where display_name is distinct from unit_name_th;
