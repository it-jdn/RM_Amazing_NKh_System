-- One-off: ตั้งเวลาบันทึกใบรับสินค้าเป็นเวลาไทย 14:30 น. (ตัวอย่าง: ร้านผัก ตลาดมังวอน วันที่ 2026-05-20 ใบที่ 1 = ใบเก่าสุดของวันนั้น)
--
-- รันใน Supabase → SQL Editor หลังตรวจว่าแถวที่โดนเลือกตรงกับใบที่ต้องการ
-- ถ้ามีหลายใบในวันเดียวกัน สคริปต์นี้เลือกเฉพาะ 1 ใบ: เรียงตาม created_at จากเก่าไปใหม่ (ใบที่ 1 ในหน้าจอ)

BEGIN;

WITH slip_to_fix AS (
  SELECT id
  FROM intake_slips
  WHERE txn_date = '2026-05-20'
    AND supp_name ILIKE '%มังวอน%'
  ORDER BY created_at ASC
  LIMIT 1
),
upd_slip AS (
  UPDATE intake_slips s
  SET
    created_at = timestamptz '2026-05-20 14:30:00+07',
    updated_at = timestamptz '2026-05-20 14:30:00+07'
  FROM slip_to_fix t
  WHERE s.id = t.id
  RETURNING s.id
)
UPDATE transactions x
SET saved_at = timestamptz '2026-05-20 14:30:00+07'
FROM upd_slip u
WHERE x.slip_id = u.id;

-- ตรวจสอบก่อน COMMIT ว่าถูกใบ
-- SELECT id, txn_date, supp_name, created_at, updated_at FROM intake_slips WHERE txn_date = '2026-05-20' AND supp_name ILIKE '%มังวอน%';

COMMIT;
