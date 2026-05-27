-- ลบแถวผักชี หน่วย กิโลกรัม (no 2057) — รันทีละบล็อกใน Supabase SQL Editor
-- แต่ละบล็อกกด Run แยกกัน (ไม่ใช้ BEGIN/COMMIT)

-- === บล็อก 1: ลบ (ต้องเห็น 1 แถวใน RETURNING: no 2057) ===
DELETE FROM transactions
WHERE no = 2057
  AND item_code = 'RM00138'
  AND trim(main_unit) = 'กิโลกรัม'
RETURNING no, item_code, qty, main_unit, total_price;

-- === บล็อก 2: ตรวจ (ต้องเหลือแถวเดียว ถุง no 2062, ยอดใบ 115400) ===
WITH slip AS (
  SELECT id FROM intake_slips
  WHERE txn_date = '2026-05-26'
    AND supp_name ILIKE '%มังวอน%'
  ORDER BY created_at ASC
  LIMIT 1
)
SELECT
  t.no,
  t.qty,
  t.main_unit,
  t.total_price
FROM transactions t
WHERE t.slip_id = (SELECT id FROM slip)
  AND t.item_code = 'RM00138'
ORDER BY t.no;

SELECT SUM(total_price::numeric) AS slip_total
FROM transactions t
WHERE t.slip_id = (
  SELECT id FROM intake_slips
  WHERE txn_date = '2026-05-26'
    AND supp_name ILIKE '%มังวอน%'
  ORDER BY created_at ASC
  LIMIT 1
);
