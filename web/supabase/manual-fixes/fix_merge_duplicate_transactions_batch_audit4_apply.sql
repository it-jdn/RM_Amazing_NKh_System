-- รวมแถวซ้ำ 4 ใบ — รันครั้งเดียวใน Supabase SQL Editor (กด Run แค่ 1 ครั้ง)
--
-- สำคัญ: อย่าใช้ BEGIN + COMMIT แยก 2 ครั้ง — Supabase มักใช้คนละ connection
--        ทำให้เห็นผล 8 แถว แต่ข้อมูลไม่บันทึก
--
-- หลังรัน: ใช้ query ตรวจท้ายไฟล์ — ต้องได้ 0 แถว

WITH target_slips AS (
  SELECT unnest(ARRAY[
    '5301ef18-1579-48e4-be19-42b00c161898'::uuid,
    '0a92af97-c75d-4803-89b8-4922eb878de8'::uuid,
    '4b674bab-d1d1-49a0-a1fe-a34228e3878f'::uuid,
    'da135b49-4304-4ee3-8b4c-455399d3e580'::uuid
  ]) AS id
),
groups AS (
  SELECT
    t.slip_id,
    t.item_code,
    trim(t.main_unit) AS main_unit_norm,
    MIN(t.no) AS keep_no,
    SUM(t.qty::numeric) AS merged_qty,
    SUM(t.total_price::numeric) AS merged_total
  FROM transactions t
  WHERE t.slip_id IN (SELECT id FROM target_slips)
  GROUP BY t.slip_id, t.item_code, trim(t.main_unit)
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
  WHERE t.slip_id = g.slip_id
    AND t.no = g.keep_no
  RETURNING t.slip_id, t.no, t.item_code, t.main_unit, t.qty, t.total_price
),
deleted AS (
  DELETE FROM transactions t
  USING groups g
  WHERE t.slip_id = g.slip_id
    AND t.item_code = g.item_code
    AND trim(t.main_unit) = g.main_unit_norm
    AND t.no <> g.keep_no
  RETURNING t.slip_id, t.no, t.item_code, t.main_unit, t.qty, t.total_price
)
SELECT
  'kept_updated' AS action,
  u.slip_id,
  s.txn_date,
  u.no,
  u.item_code,
  u.main_unit,
  u.qty,
  u.total_price
FROM updated u
JOIN intake_slips s ON s.id = u.slip_id
UNION ALL
SELECT
  'deleted_dup' AS action,
  d.slip_id,
  s.txn_date,
  d.no,
  d.item_code,
  d.main_unit,
  d.qty,
  d.total_price
FROM deleted d
JOIN intake_slips s ON s.id = d.slip_id
ORDER BY txn_date DESC, action, no;
