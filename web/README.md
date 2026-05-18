# Amazing Nongkhai — Inventory System (Web)

Next.js + Supabase migration of the Google Apps Script inventory intake system.

> โครงสร้าง repo ทั้งหมดและ migration ครบชุด: [`../README.md`](../README.md)

## Setup

1. Create a [Supabase](https://supabase.com) project (region: Northeast Asia recommended).
2. Run SQL migrations **`001` through `012`** in order from [`supabase/migrations/`](supabase/migrations/) (see root README for the list).
3. Copy `.env.example` to `.env.local` and fill in credentials from **Project Settings → API**:

| Variable | Source |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Data API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key (`sb_publishable_...`) or Legacy anon |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key (`sb_secret_...`) or Legacy service_role |
| `SESSION_SECRET` | `openssl rand -base64 32` |

```bash
cp .env.example .env.local
```

4. Install and seed (run from this `web/` directory):

```bash
npm install
npm run seed:pins
npm run import:csv
```

นำเข้าประวัติรับของจาก Excel ระบบเดิม (แถบ **Transactions**):

```bash
npm run import:transactions -- --dry-run
npm run import:transactions
```

ไฟล์ต้นทาง: `../Backup/DB File/RM Amazing Nongkhai - DB.xlsx`

Default PINs (change after first deploy):

| Role     | PIN  |
|----------|------|
| operator | 1111 |
| admin    | 2222 |
| manager  | 3333 |

5. Run locally:

```bash
npm run dev
```

Open **http://localhost:3000**

If you see `ERR_CONNECTION_REFUSED`, ensure `npm run dev` is running from **`web/`** (not the repo root).

## Deploy to Vercel (Production Phase 1)

### 1. Supabase production

1. สร้างโปรเจกต์ Supabase ใหม่ (แยกจาก dev) → รัน migration `001`–`012` ใน SQL Editor  
   หรือใส่ `DATABASE_URL` แล้วรัน `DEPLOY_ENV=production npm run db:migrate`
2. คัดลอก `web/.env.production.example` → `web/.env.production.local` แล้วใส่ keys + `SESSION_SECRET` ใหม่ (`openssl rand -base64 32`)
3. เติมข้อมูลครั้งแรก:

```bash
cd web
DEPLOY_ENV=production npm run deploy:verify    # ตรวจตาราง
DEPLOY_ENV=production npm run deploy:setup     # seed + import CSV (โปรเจกต์ว่าง)
# หรือแยกทีละคำสั่ง: seed:pins, import:csv, import:transactions
```

### 2. GitHub

จาก root repo (`RM_Amazing_NKh_System/`):

```bash
git remote add origin https://github.com/YOUR_ORG/RM_Amazing_NKh_System.git
git push -u origin main
```

### 3. Vercel

1. [vercel.com/new](https://vercel.com/new) → Import repo → **Root Directory: `web`**
2. Environment Variables (Production) — คัดลอกจากเครื่องคุณ:

```bash
cd web && DEPLOY_ENV=production npm run deploy:print-vercel-env
```

   ใส่ใน Vercel: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `TZ=Asia/Bangkok`
3. Deploy → แจก URL `https://….vercel.app`

### 4. หลัง deploy

- เปลี่ยน PIN เริ่มต้น (1111/2222/3333) ที่ `/admin/users`
- ทดสอบ `/login` → `/intake` → บันทึก → `/history` → `/report` (manager)

## Project structure

```
src/
├── app/
│   ├── (app)/
│   │   ├── intake/              # รับสินค้า
│   │   ├── history/
│   │   ├── report/
│   │   ├── profile/
│   │   └── admin/
│   │       ├── shops/           # ร้านค้า
│   │       ├── units/           # หน่วยสินค้า
│   │       ├── items/           # สินค้า + หน่วยมาตรฐาน
│   │       ├── products/        # ผูกร้าน + หน่วย/ราคา
│   │       └── users/
│   ├── login/
│   └── api/                     # REST (แทน code.gs)
├── components/
│   ├── pages/                   # IntakeView, Admin*Panel, ...
│   ├── intake/                  # หน่วยซื้อเข้า, slip note
│   ├── operator/                # UI มือถือ
│   └── admin/                   # editors หน่วยมาตรฐาน/ร้าน
├── context/                     # AppData, Locale
├── lib/
│   ├── services/data.ts         # Supabase layer
│   ├── domain/                  # transactions, purchase-units, ...
│   ├── admin/                   # standard/shop unit row config
│   └── db/                      # errors, schema detection
├── middleware.ts
scripts/                         # seed, import, build-units
supabase/migrations/             # 001 … 012
```

Legacy files and CSVs: [`../Backup/`](../Backup/).

## Operator mobile test checklist

ทดสอบด้วย Chrome DevTools (iPhone) หรือมือถือจริง หลัง `npm run dev`:

1. Login เป็น **operator** (PIN `1111`) → ไป `/intake`
2. เลือกวันที่ + ร้าน → การ์ดสินค้า (จอเล็ก)
3. สินค้าหลายหน่วยซื้อเข้า → เลือกหน่วยใน dropdown
4. กรอก qty + ราคารวม → บันทึก
5. แท็บล่าง **ประวัติ** → เปิดรายละเอียดวัน+ร้าน
6. Login **admin** → `/admin/items` ตั้งหน่วยมาตรฐาน, `/admin/products` เปิดใช้ต่อร้าน
