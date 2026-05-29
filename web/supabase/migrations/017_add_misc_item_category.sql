-- หมวด "ของใช้อื่นๆ" สำหรับสินค้าที่ไม่อยู่ใน 5 หมวด COGS หลัก

insert into item_categories (category_code, name_th, name_en, name_kr, sort_order)
values ('MISC', 'ของใช้อื่นๆ', 'Other Supplies', '기타 용품', 6)
on conflict (category_code) do update set
  name_th = excluded.name_th,
  name_en = excluded.name_en,
  name_kr = excluded.name_kr,
  sort_order = excluded.sort_order;
