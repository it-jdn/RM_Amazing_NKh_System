-- หน่วยซื้อเข้ามาตรฐานระดับสินค้า (ตั้งในเมนูสินค้า)
-- ร้านเลือกใช้มาตรฐานเหล่านี้ + ราคา ใน supplier_item_purchase_units

create table item_purchase_units (
  item_code text not null references items (item_code) on delete cascade,
  main_unit_code text not null references units (unit_code),
  sub_unit_code text not null references units (unit_code),
  convert_rate numeric(12, 4) not null default 1,
  is_default boolean not null default false,
  sort_order smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  primary key (item_code, main_unit_code)
);

create index idx_ipu_item on item_purchase_units (item_code);

-- จากแถวหลักของ items
insert into item_purchase_units (
  item_code,
  main_unit_code,
  sub_unit_code,
  convert_rate,
  is_default,
  sort_order
)
select
  i.item_code,
  i.main_unit_code,
  i.sub_unit_code,
  coalesce(i.convert_rate, 1),
  true,
  0
from items i
where i.main_unit_code is not null
  and i.sub_unit_code is not null
on conflict (item_code, main_unit_code) do nothing;

-- รวมมาตรฐานที่เคยตั้งต่อร้าน (ไม่ซ้ำ main ต่อสินค้า)
insert into item_purchase_units (
  item_code,
  main_unit_code,
  sub_unit_code,
  convert_rate,
  is_default,
  sort_order
)
select distinct on (p.item_code, p.main_unit_code)
  p.item_code,
  p.main_unit_code,
  p.sub_unit_code,
  p.convert_rate,
  false,
  p.sort_order
from supplier_item_purchase_units p
where p.active is distinct from false
order by p.item_code, p.main_unit_code, p.sort_order
on conflict (item_code, main_unit_code) do nothing;
