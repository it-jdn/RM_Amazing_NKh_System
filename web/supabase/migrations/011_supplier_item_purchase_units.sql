-- หน่วยซื้อเข้าที่เลือกได้ต่อสินค้า+ร้าน (ตั้งค่าโดย admin/manager)

create table supplier_item_purchase_units (
  supp_code text not null references suppliers (supp_code) on delete cascade,
  item_code text not null references items (item_code) on delete cascade,
  main_unit_code text not null references units (unit_code),
  sub_unit_code text not null references units (unit_code),
  convert_rate numeric(12, 4) not null default 1,
  standard_unit_price numeric(14, 2) not null default 0,
  is_default boolean not null default false,
  sort_order smallint not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz,
  primary key (supp_code, item_code, main_unit_code)
);

create index idx_sipu_lookup on supplier_item_purchase_units (supp_code, item_code);

-- ย้ายข้อมูลเดิมจาก mapping มาเป็นตัวเลือกแรก (default)
insert into supplier_item_purchase_units (
  supp_code,
  item_code,
  main_unit_code,
  sub_unit_code,
  convert_rate,
  standard_unit_price,
  is_default,
  sort_order
)
select
  m.supp_code,
  m.item_code,
  m.main_unit_code,
  m.sub_unit_code,
  coalesce(m.convert_rate, 1),
  coalesce(m.standard_unit_price, m.unit_price, 0),
  true,
  0
from supplier_item_mapping m
where m.main_unit_code is not null
  and m.sub_unit_code is not null
  and m.active is distinct from false
on conflict (supp_code, item_code, main_unit_code) do nothing;
