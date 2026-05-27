-- รวมแถวซ้ำ (สินค้า + หน่วยเดียวกัน) ทั้ง 4 ใบจาก audit:slip-duplicates (production)
-- ไม่แตะเคสหลายหน่วย (ผักชี ถุง+กิโล ฯลฯ)
--
-- ขั้นตอน (Supabase):
--   แนะนำใช้ fix_merge_duplicate_transactions_batch_audit4_apply.sql
--   รันไฟล์นั้น กด Run แค่ 1 ครั้ง (ไม่มี BEGIN/COMMIT)
--
--   อย่ารัน BEGIN แล้ว COMMIT แยก 2 ครั้ง — มักไม่บันทึก (คนละ connection)

-- =============================================================================
-- ตรวจก่อนแก้ (อ่านอย่างเดียว — ไม่ต้อง BEGIN)
-- =============================================================================
WITH target_slips AS (
  SELECT *
  FROM (VALUES
    ('5301ef18-1579-48e4-be19-42b00c161898'::uuid, '2026-04-01', 'RM00138', 'กระเทียม', 'Bag / ถุง'),
    ('0a92af97-c75d-4803-89b8-4922eb878de8'::uuid, '2026-03-31', 'RM00138', 'กระเทียม', 'Bag / ถุง'),
    ('4b674bab-d1d1-49a0-a1fe-a34228e3878f'::uuid, '2026-02-20', 'RM00151', 'กวางตุ้ง', 'Box / กล่อง'),
    ('da135b49-4304-4ee3-8b4c-455399d3e580'::uuid, '2026-01-23', 'RM00135', 'แตงกวา', 'Piece / ชิ้น')
  ) AS v(slip_id, txn_date, item_code, item_label, main_unit)
)
SELECT
  v.txn_date,
  v.item_code,
  v.item_label,
  v.main_unit,
  t.no,
  t.qty,
  t.total_price,
  v.slip_id
FROM target_slips v
JOIN transactions t ON t.slip_id = v.slip_id
  AND t.item_code = v.item_code
  AND trim(t.main_unit) = trim(v.main_unit)
ORDER BY v.txn_date DESC, t.no;

-- =============================================================================
-- แก้ข้อมูล — ใช้ไฟล์ *_apply.sql แทนบล็อกนี้ (BEGIN/COMMIT ใน Supabase มักพัง)
-- =============================================================================

-- BEGIN;  -- อย่าใช้ใน Supabase แยกกับ COMMIT

WITH target_slips AS (
  SELECT unnest(ARRAY[
    '5301ef18-1579-48e4-be19-42b00c161898'::uuid, -- 2026-04-01 กระเทียม ถุง nos 3,6
    '0a92af97-c75d-4803-89b8-4922eb878de8'::uuid, -- 2026-03-31 กระเทียม ถุง nos 3,6
    '4b674bab-d1d1-49a0-a1fe-a34228e3878f'::uuid, -- 2026-02-20 กวางตุ้ง กล่อง nos 924,927
    'da135b49-4304-4ee3-8b4c-455399d3e580'::uuid  -- 2026-01-23 แตงกวา ชิ้น nos 491,503
  ]) AS id
),
groups AS (
  SELECT
    t.slip_id,
    t.item_code,
    trim(t.main_unit) AS main_unit_norm,
    MIN(t.no) AS keep_no,
    SUM(t.qty::numeric) AS merged_qty,
    SUM(t.total_price::numeric) AS merged_total,
    array_agg(t.no ORDER BY t.no) AS all_nos,
    COUNT(*) AS cnt
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
  s.supp_name,
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
  s.supp_name,
  d.no,
  d.item_code,
  d.main_unit,
  d.qty,
  d.total_price
FROM deleted d
JOIN intake_slips s ON s.id = d.slip_id
ORDER BY txn_date DESC, action, no;

-- ตรวจหลังแก้: ไม่ควรมีซ้ำในทั้ง 4 ใบ
-- SELECT s.txn_date, t.item_code, trim(t.main_unit), COUNT(*), array_agg(t.no ORDER BY t.no)
-- FROM transactions t
-- JOIN intake_slips s ON s.id = t.slip_id
-- WHERE t.slip_id IN (
--   '5301ef18-1579-48e4-be19-42b00c161898',
--   '0a92af97-c75d-4803-89b8-4922eb878de8',
--   '4b674bab-d1d1-49a0-a1fe-a34228e3878f',
--   'da135b49-4304-4ee3-8b4c-455399d3e580'
-- )
-- GROUP BY s.txn_date, t.item_code, trim(t.main_unit)
-- HAVING COUNT(*) > 1;

-- COMMIT;  -- อย่ารันแยก — ใช้ *_apply.sql แทน
