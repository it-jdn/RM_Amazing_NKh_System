-- =============================================================================
-- แปลง txn_date จากปี พ.ศ. → ค.ศ. ในข้อมูลรับสินค้า (transactions + intake_slips)
-- ตัวอย่าง: 2569-05-29 → 2026-05-29 (ลบ 543 ปี)
--
-- ขั้นตอน:
--   1) รัน diagnose_buddhist_era_txn_dates.sql ก่อน
--   2) รันบล็อก PREVIEW ด้านล่าง (SELECT) ตรวจผล
--   3) รันบล็อก APPLY ทั้งก้อนในรอบเดียว (BEGIN…COMMIT) — อย่าแยก COMMIT
-- =============================================================================

-- --- PREVIEW (ไม่แก้ข้อมูล) ---
select 'transactions' as tbl, txn_date, (txn_date - interval '543 years')::date as ce_date, count(*) as rows
from transactions
where extract(year from txn_date) >= 2400
group by 1, 2, 3
union all
select 'intake_slips', txn_date, (txn_date - interval '543 years')::date, count(*)
from intake_slips
where extract(year from txn_date) >= 2400
group by 1, 2, 3
order by tbl, txn_date;

-- --- APPLY (แก้จริง — รันทั้งบล็อกนี้ครั้งเดียว) ---
begin;

update transactions
set txn_date = (txn_date - interval '543 years')::date
where extract(year from txn_date) >= 2400;

update intake_slips
set txn_date = (txn_date - interval '543 years')::date
where extract(year from txn_date) >= 2400;

-- ตรวจหลังอัปเดต (ควรเหลือ 0 แถวที่ปี >= 2400)
select
  (select count(*) from transactions where extract(year from txn_date) >= 2400) as txn_remaining_be,
  (select count(*) from intake_slips where extract(year from txn_date) >= 2400) as slips_remaining_be;

-- ถ้าตัวเลข remaining = 0 และข้อมูลตรงใจ:
commit;
-- ถ้าไม่ตรงใจ ให้ใช้ rollback; แทน commit;
