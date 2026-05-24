# สำรองข้อมูลและนำเข้าประวัติรับสินค้าย้อนหลัง

คู่มือนี้สอดคล้องกับแผน **Production → Staging ทดสอบ → Production** — ไม่ restore staging ทับ production ใช้ **append** เท่านั้น

## สรุปขั้นตอน

| ลำดับ | งาน | คำสั่ง / ไฟล์ |
|------|-----|----------------|
| 1 | สำรองโค้ด + DB + ไฟล์ Excel | `./scripts/backup-before-import.sh` + `pg_dump` / Supabase backup |
| 2 | Staging: โปรเจกต์ใหม่ + migration + restore prod | ด้านล่าง § Staging |
| 3 | dry-run นำเข้า | `DEPLOY_ENV=staging npm run import:transactions -- --dry-run --append --file=...` |
| 4 | append นำเข้า | `--append` (มี dedupe อัตโนมัติ) |
| 5 | ใบรับ + เลข no | `npm run import:post` |
| 6 | UAT บน staging | `/history`, `/report` |
| 7 | Production | backup รอบสอง → ชุดคำสั่งเดียวกับ staging |

---

## 1 — สำรอง Production

### 1.1 Git tag

```bash
cd /path/to/RM_Amazing_NKh_System
./scripts/backup-before-import.sh
# หรือระบุชื่อ tag
./scripts/backup-before-import.sh pre-historical-import-2026-05-21
git push origin pre-historical-import-2026-05-21
```

บันทึก commit hash ที่ deploy บน Vercel อยู่

### 1.2 Supabase / pg_dump

**ช่องทาง A:** Supabase Dashboard → Database → Backups (restore ไปโปรเจกต์ใหม่เป็น staging ได้)

**ช่องทาง B:** `pg_dump` (เก็บนอก repo)

```bash
pg_dump "$DATABASE_URL" \
  --format=custom \
  --file=backup_prod_YYYYMMDD.dump
```

`DATABASE_URL` จาก Project Settings → Database → Connection string (session/direct)

### 1.3 Snapshot จำนวนแถว (ใน repo)

```bash
cd web
DEPLOY_ENV=production npm run export:db -- --out=../Backup/snapshots
```

ได้ไฟล์ `Backup/snapshots/snapshot_production_YYYYMMDD.json` ใช้เปรียบเทียบก่อน/หลังนำเข้า

### 1.4 ไฟล์ Excel ชุดใหม่

เก็บนอก repo หรือใน `Backup/imports/YYYY-MM-DD/` — **อย่า commit** ถ้ามีข้อมูลจริง

---

## 2 — Staging

1. สร้างโปรเจกต์ Supabase ใหม่ (region เดียวกับ production)
2. คัดลอก `web/.env.staging.example` → `web/.env.staging.local` (ไม่ commit)
3. รัน migration:

```bash
cd web
DEPLOY_ENV=staging npm run db:migrate
```

4. โหลดข้อมูล production:
   - จาก Supabase restore → ข้าม `pg_restore`
   - จาก `.dump`: `pg_restore --dbname="$STAGING_DATABASE_URL" --clean --if-exists backup_prod_YYYYMMDD.dump`

5. ตรวจ:

```bash
DEPLOY_ENV=staging npm run deploy:verify
DEPLOY_ENV=staging npm run export:db -- --out=../Backup/snapshots
```

จำนวน `transactions` / `intake_slips` ควรใกล้ production

---

## 3 — เตรียมไฟล์ export

แถบ Excel ค่าเริ่มต้น: `Transactions` (เปลี่ยนด้วย `--sheet=`)

| ฟิลด์ | คอลัมน์ที่รองรับ |
|--------|------------------|
| วันที่ | `date` |
| ร้าน | `suppCode`, `suppName` |
| สินค้า | `itemCode`, `itemNameTH` / `itemName` |
| จำนวน/ราคา | `qty`, `mainUnit`, `subUnit`, `convertRate`, `totalSub`, `unitPrice`, `totalPrice` |
| หมายเหตุ | `note` |
| เวลาบันทึก | `savedAt` |
| ผู้บันทึก | `savedByName`, `saved_by_name`, `savedBy`, `operatorName` |
| เลขแถว | `no` |

Checklist:

- รหัสร้าน/สินค้าตรง master บน staging (หลังโคลน prod)
- แถว `qty` และ `totalPrice` เป็น 0 จะถูกข้าม
- ช่วงวันที่ทับข้อมูลเดิม → ใช้ `--append` + dedupe (ค่าเริ่มต้นเมื่อ append)

---

## 4 — นำเข้าบน Staging

```bash
cd web

# รายงาน FK / ซ้ำ / ช่วงวันที่ — ไม่ insert
DEPLOY_ENV=staging npm run import:transactions -- \
  --dry-run --append \
  --file="/absolute/path/to/new-export.xlsx"

# นำเข้าจริง
DEPLOY_ENV=staging npm run import:transactions -- \
  --append \
  --file="/absolute/path/to/new-export.xlsx"

# ใบรับ + sync transaction_no_seq (ต้องมี DATABASE_URL ใน .env.staging.local)
DEPLOY_ENV=staging npm run import:post
```

ทางเลือก: วาง SQL จาก `web/supabase/manual-fixes/backfill_intake_slips_after_import.sql` ใน SQL Editor

### พารามิเตอร์สคริปต์

| Flag | ความหมาย |
|------|-----------|
| `--dry-run` | สรุป only |
| `--append` | อนุญาตเมื่อมี transactions อยู่แล้ว |
| `--dedupe` | ข้ามแถวที่ key ซ้ำกับ DB (เปิดอัตโนมัติเมื่อ `--append`) |
| `--no-dedupe` | insert ทุกแถวที่ผ่าน FK |
| `--file=PATH` | ไฟล์ Excel |
| `--sheet=NAME` | ชื่อแถบ (default: `Transactions`) |

Dedupe key: `(txn_date, supp_code, item_code, saved_at, total_price, qty)`

### UAT

- `/history` — ช่วงวันที่ที่นำเข้า, หลายใบต่อวัน
- `/report` — ต้นทุนตามช่วง
- เปรียบเทียบยอดกับ Excel (สุ่ม 3–5 วัน)
- `DEPLOY_ENV=staging npm run export:db` เปรียบ snapshot ก่อน/หลัง

---

## 5 — Production (หลัง staging ผ่าน)

1. สำรอง production **อีกครั้ง** (วันที่ต่างจากรอบแรก)
2. ใช้ **ไฟล์และ flags เดียวกับ staging**
3. รัน:

```bash
cd web
DEPLOY_ENV=production npm run deploy:verify
DEPLOY_ENV=production npm run export:db -- --out=../Backup/snapshots

DEPLOY_ENV=production npm run import:transactions -- \
  --dry-run --append --file="/path/to/same-export.xlsx"

DEPLOY_ENV=production npm run import:transactions -- \
  --append --file="/path/to/same-export.xlsx"

DEPLOY_ENV=production npm run import:post
```

4. ตรวจ UI production + snapshot จำนวนแถว

**ห้าม** `pg_restore` staging ทับ production

---

## ความเสี่ยง

| ความเสี่ยง | การป้องกัน |
|-----------|------------|
| รหัสสินค้าไม่ตรง DB | `--dry-run` + รายงาน skip FK |
| ข้อมูลซ้ำ | `--append` + dedupe (default) |
| เลข `no` ชน | `import:post` → `setval` |
| ใบรับไม่ขึ้น UI | `import:post` backfill `slip_id` |
| ทับ production | append เท่านั้น ไม่ restore staging |

---

## ไฟล์ใน repo ที่เกี่ยวข้อง

| ไฟล์ | 用途 |
|------|------|
| `web/scripts/import-transactions.ts` | นำเข้า Excel |
| `web/scripts/post-import-transactions.ts` | backfill + setval |
| `web/scripts/export-db-snapshot.ts` | snapshot จำนวนแถว |
| `web/supabase/manual-fixes/backfill_intake_slips_after_import.sql` | SQL สำรอง |
| `web/.env.staging.example` | ตัวอย่าง env staging |
| `scripts/backup-before-import.sh` | git tag + คำแนะนำ backup |
