-- =============================================================================
-- ตรวจวันที่รับสินค้าที่บันทึกเป็นปี พ.ศ. ในคอลัมน์ date (เช่น 2569-05-29 แทน 2026-05-29)
-- รันใน Supabase → SQL Editor (อ่านอย่างเดียว)
-- =============================================================================

-- เกณฑ์: ปีในคอลัมน์ date >= 2400 ถือว่าเป็น พ.ศ. (ธุรกิจร้านอาหารใช้ ค.ศ. 20xx)
-- แปลง: ลบ 543 ปี → 2569 กลายเป็น 2026

select
  (select count(*) from transactions where extract(year from txn_date) >= 2400) as txn_rows_be_year,
  (select count(*) from intake_slips where extract(year from txn_date) >= 2400) as slip_rows_be_year,
  (select count(distinct txn_date) from transactions where extract(year from txn_date) >= 2400) as distinct_be_txn_dates;

-- ตัวอย่างแถว transactions (สูงสุด 30 แถว)
select
  id,
  no,
  txn_date,
  (txn_date - interval '543 years')::date as txn_date_ce,
  supp_code,
  supp_name,
  item_code,
  saved_at
from transactions
where extract(year from txn_date) >= 2400
order by txn_date desc, no
limit 30;

-- ตัวอย่างใบรับ (intake_slips)
select
  id,
  txn_date,
  (txn_date - interval '543 years')::date as txn_date_ce,
  supp_code,
  supp_name,
  created_at,
  updated_at
from intake_slips
where extract(year from txn_date) >= 2400
order by txn_date desc, created_at
limit 30;

-- ใบที่ txn_date ไม่ตรงกับรายการในใบ (หลังแปลงควรเป็น 0)
select
  s.id as slip_id,
  s.txn_date as slip_date,
  t.txn_date as line_date,
  count(*) as lines
from intake_slips s
join transactions t on t.slip_id = s.id
where extract(year from s.txn_date) >= 2400
   or extract(year from t.txn_date) >= 2400
group by s.id, s.txn_date, t.txn_date
having s.txn_date is distinct from t.txn_date
limit 20;

-- หลังแปลง CE แล้ว อาจมีหลายใบร้านเดียวกันวันเดียวกัน (ตรวจก่อน merge แยก)
select
  (txn_date - interval '543 years')::date as ce_date,
  supp_code,
  count(*) as slip_count
from intake_slips
where extract(year from txn_date) >= 2400
group by 1, 2
having count(*) > 1
order by 1 desc, 3 desc;
