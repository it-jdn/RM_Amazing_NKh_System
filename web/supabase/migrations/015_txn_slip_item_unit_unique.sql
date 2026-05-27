-- ป้องกันแถวซ้ำในหนึ่งใบ (สินค้า + หน่วยเดียวกัน)
-- รันหลังแก้ข้อมูลซ้ำแล้ว (ดู manual-fixes/diagnose_duplicate_transactions.sql)

create unique index if not exists idx_txn_slip_item_unit_unique
  on transactions (slip_id, item_code, trim(main_unit))
  where slip_id is not null;
