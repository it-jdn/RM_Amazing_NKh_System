-- รวมแถว transactions ซ้ำในใบเดียว (item_code + trim(main_unit) เหมือนกัน)
-- ใช้เมื่อ diagnose Query 2 พบ row_count > 1 สำหรับหน่วยเดียวกัน
-- ไม่ใช้กับเคสผักชี (หลายหน่วย: ถุง+กิโล) — ใช้ลบแถวหน่วยที่ไม่ใช้แทน
--
-- ขั้นตอน:
--   1) รัน diagnose_duplicate_transactions.sql ก่อน
--   2) แก้ค่า slip_id ด้านล่างให้ตรงใบที่ต้องการ
--   3) รัน BEGIN … ตรวจผล … COMMIT (หรือ ROLLBACK)

-- >>> ใส่ slip_id จากผล diagnose (หรือใช้ CTE มังวอน 26 พ.ค. ใบที่ 1)
-- \set slip_id '00000000-0000-0000-0000-000000000000'

BEGIN;

-- ตัวอย่าง: ระบุ slip_id ตรงใบ (จาก audit หรือ diagnose)
-- แก้ txn_date / เงื่อนไขร้าน ให้ตรงใบที่ต้องการ
WITH target_slip AS (
  SELECT id
  FROM intake_slips
  WHERE txn_date = '2026-04-01'
    AND supp_name ILIKE '%มังวอน%'
  ORDER BY created_at ASC
  LIMIT 1
),
groups AS (
  SELECT
    t.item_code,
    trim(t.main_unit) AS main_unit_norm,
    MIN(t.no) AS keep_no,
    SUM(t.qty::numeric) AS merged_qty,
    SUM(t.total_price::numeric) AS merged_total,
    array_agg(t.no ORDER BY t.no) AS all_nos,
    COUNT(*) AS cnt
  FROM transactions t
  WHERE t.slip_id = (SELECT id FROM target_slip)
  GROUP BY t.item_code, trim(t.main_unit)
  HAVING COUNT(*) > 1
),
updated AS (
  UPDATE transactions t
  SET
    qty = g.merged_qty,
    total_price = g.merged_total,
    unit_price = CASE
      WHEN g.merged_qty > 0 THEN round((g.merged_total / g.merged_qty)::numeric, 2)
      ELSE t.unit_price
    END,
    total_sub = round((g.merged_qty * t.convert_rate::numeric)::numeric, 2)
  FROM groups g
  WHERE t.slip_id = (SELECT id FROM target_slip)
    AND t.no = g.keep_no
  RETURNING t.no, t.item_code, t.main_unit, t.qty, t.total_price
),
deleted AS (
  DELETE FROM transactions t
  USING groups g
  WHERE t.slip_id = (SELECT id FROM target_slip)
    AND t.item_code = g.item_code
    AND trim(t.main_unit) = g.main_unit_norm
    AND t.no <> g.keep_no
  RETURNING t.no, t.item_code, t.main_unit, t.qty, t.total_price
)
SELECT 'kept_updated' AS action, u.no, u.item_code, u.main_unit, u.qty, u.total_price
FROM updated u
UNION ALL
SELECT 'deleted_dup' AS action, d.no, d.item_code, d.main_unit, d.qty, d.total_price
FROM deleted d;

-- ตรวจก่อน COMMIT:
-- SELECT item_code, trim(main_unit), COUNT(*), SUM(total_price::numeric)
-- FROM transactions WHERE slip_id = (SELECT id FROM target_slip)
-- GROUP BY 1, 2 HAVING COUNT(*) > 1;

-- COMMIT;
-- ROLLBACK;
