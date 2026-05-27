-- ตรวจแถว transactions ซ้ำ (สินค้า+หน่วยเดียวกัน ในใบเดียวกัน)
-- รันใน Supabase → SQL Editor (อ่านอย่างเดียว — ไม่แก้ข้อมูล)

-- 1) สรุปทั้งระบบ: ใบที่มีแถวซ้ำ
SELECT
  s.id AS slip_id,
  s.txn_date,
  s.supp_code,
  s.supp_name,
  COUNT(*) AS txn_rows,
  COUNT(DISTINCT (t.item_code, trim(t.main_unit))) AS distinct_item_unit,
  COUNT(*) - COUNT(DISTINCT (t.item_code, trim(t.main_unit))) AS duplicate_extra_rows,
  SUM(t.total_price::numeric) AS slip_total
FROM intake_slips s
JOIN transactions t ON t.slip_id = s.id
GROUP BY s.id, s.txn_date, s.supp_code, s.supp_name
HAVING COUNT(*) > COUNT(DISTINCT (t.item_code, trim(t.main_unit)))
ORDER BY s.txn_date DESC, s.supp_name;

-- 2) รายละเอียดแถวซ้ำ (ทุกใบ)
SELECT
  s.txn_date,
  s.supp_name,
  s.id AS slip_id,
  t.item_code,
  t.item_name_th,
  trim(t.main_unit) AS main_unit,
  COUNT(*) AS row_count,
  SUM(t.qty::numeric) AS sum_qty,
  SUM(t.total_price::numeric) AS sum_total,
  array_agg(t.no ORDER BY t.no) AS txn_nos
FROM intake_slips s
JOIN transactions t ON t.slip_id = s.id
GROUP BY s.txn_date, s.supp_name, s.id, t.item_code, t.item_name_th, trim(t.main_unit)
HAVING COUNT(*) > 1
ORDER BY s.txn_date DESC, s.supp_name, t.item_code;

-- 3) ใบเฉพาะ: 26 พ.ค. 2026 ร้านมังวอน ใบที่ 1 (เก่าสุดของวัน)
WITH slip AS (
  SELECT id, txn_date, supp_code, supp_name, created_at
  FROM intake_slips
  WHERE txn_date = '2026-05-26'
    AND supp_name ILIKE '%มังวอน%'
  ORDER BY created_at ASC
  LIMIT 1
)
SELECT
  t.no,
  t.item_code,
  t.item_name_th,
  t.qty,
  t.main_unit,
  length(t.main_unit) AS unit_len,
  t.total_price,
  t.slip_id,
  t.saved_at
FROM transactions t
WHERE t.slip_id = (SELECT id FROM slip)
ORDER BY t.no;

-- 4) เฉพาะผักชี (RM00138) ในใบนั้น
WITH slip AS (
  SELECT id FROM intake_slips
  WHERE txn_date = '2026-05-26'
    AND supp_name ILIKE '%มังวอน%'
  ORDER BY created_at ASC
  LIMIT 1
)
SELECT *
FROM transactions
WHERE slip_id = (SELECT id FROM slip)
  AND item_code = 'RM00138'
ORDER BY no;

-- 5) ยอดรวมใบ vs ยอดที่ควรเป็น (หลังรวมซ้ำ)
WITH slip AS (
  SELECT id FROM intake_slips
  WHERE txn_date = '2026-05-26'
    AND supp_name ILIKE '%มังวอน%'
  ORDER BY created_at ASC
  LIMIT 1
),
raw AS (
  SELECT SUM(total_price::numeric) AS total FROM transactions WHERE slip_id = (SELECT id FROM slip)
),
dedup AS (
  SELECT SUM(sum_total) AS total
  FROM (
    SELECT SUM(total_price::numeric) AS sum_total
    FROM transactions
    WHERE slip_id = (SELECT id FROM slip)
    GROUP BY item_code, trim(main_unit)
  ) x
)
SELECT
  (SELECT total FROM raw) AS db_sum_all_rows,
  (SELECT total FROM dedup) AS sum_after_merge_duplicates,
  (SELECT total FROM raw) - (SELECT total FROM dedup) AS excess_from_duplicates;
