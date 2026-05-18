# RM Amazing Nongkhai — Inventory System

ระบบบันทึกการรับวัตถุดิบ (Raw Material Intake) สำหรับร้านอาหารไทย **Amazing Nongkhai** — สกุลเงิน ₩ (KRW), timezone **Asia/Bangkok**

แอปที่ใช้งานจริงอยู่ใน [`web/`](web/) (Next.js + Supabase + Vercel)  
ไฟล์ระบบเดิมเก็บไว้ใน [`Backup/`](Backup/) เพื่ออ้างอิงเท่านั้น

รายละเอียด setup / deploy ฝั่งแอป: [`web/README.md`](web/README.md)

---

## โครงสร้างโปรเจกต์

```
RM_Amazing_NKh_System/
├── web/                                              # แอปหลัก (พัฒนา · รัน · deploy ที่นี่)
│   ├── public/
│   │   └── amazing-nkh-logo.png
│   ├── src/
│   │   ├── app/
│   │   │   ├── (app)/                                # หน้าหลังล็อกอิน
│   │   │   │   ├── receiving/                        # รับสินค้า (หน้าหลัก)
│   │   │   │   ├── intake/                           # redirect → /receiving
│   │   │   │   ├── history/                          # ประวัติรับสินค้า
│   │   │   │   ├── report/                           # รายงานต้นทุน
│   │   │   │   ├── profile/                          # โปรไฟล์ผู้ใช้
│   │   │   │   ├── admin/                            # การตั้งค่า (admin / manager)
│   │   │   │   │   ├── shops/                        # ร้านค้า
│   │   │   │   │   ├── units/                        # หน่วยสินค้า (admin)
│   │   │   │   │   ├── items/                        # สินค้า + หน่วยซื้อเข้ามาตรฐาน
│   │   │   │   │   ├── products/                     # ผูกสินค้ากับร้าน + หน่วย/ราคาต่อร้าน
│   │   │   │   │   ├── users/                        # ผู้ใช้ (admin)
│   │   │   │   │   ├── link/                         # redirect → /admin/products
│   │   │   │   │   ├── prices/                       # redirect → /admin/products
│   │   │   │   │   ├── layout.tsx                    # AdminSubNav + chrome
│   │   │   │   │   └── page.tsx                      # redirect ไป shops
│   │   │   │   └── layout.tsx
│   │   │   ├── login/                                # ล็อกอิน PIN + สลับภาษา
│   │   │   ├── api/                                  # REST API (แทน Google Apps Script)
│   │   │   │   ├── auth/login|logout/
│   │   │   │   ├── data/initial/
│   │   │   │   ├── suppliers/                        # CRUD + reorder + check
│   │   │   │   ├── items/                            # catalog + [code] + purchase-standards
│   │   │   │   ├── products/setup/                   # ผูกร้าน + หน่วยซื้อเข้าต่อร้าน
│   │   │   │   ├── units/                            # หน่วยมาตรฐาน + pairs
│   │   │   │   ├── mapping/price/
│   │   │   │   ├── transactions/                     # GET/POST + replace + batch + slip-meta
│   │   │   │   ├── reports/                          # + price-history
│   │   │   │   ├── users/                            # + me
│   │   │   │   └── admin/units/rebuild/
│   │   │   ├── page.tsx                              # redirect ตาม role
│   │   │   ├── layout.tsx
│   │   │   └── globals.css                           # UI ทั้งแอป + admin mobile
│   │   ├── components/
│   │   │   ├── pages/                                # หน้าหลักต่อ route
│   │   │   │   ├── IntakeView.tsx                    # /receiving
│   │   │   │   ├── HistoryView.tsx
│   │   │   │   ├── ReportView.tsx, ReportPriceCompare.tsx
│   │   │   │   ├── ProfileView.tsx
│   │   │   │   └── admin/                            # Admin*Panel ต่อเมนูตั้งค่า
│   │   │   │       ├── AdminItemsPanel.tsx
│   │   │   │       ├── AdminProductsPanel.tsx        # ผูกสินค้ากับร้าน
│   │   │   │       ├── AdminShopsPanel.tsx
│   │   │   │       ├── AdminUnitsPanel.tsx
│   │   │   │       ├── AdminUsersPanel.tsx
│   │   │   │       ├── AdminLinkPanel.tsx            # (legacy UI — route redirect)
│   │   │   │       └── admin-shared.tsx
│   │   │   ├── intake/                               # หน่วยซื้อเข้า, slip, modals, สรุปรายวัน
│   │   │   │   ├── IntakeDayOverview.tsx
│   │   │   │   ├── IntakePurchaseUnitSelect.tsx
│   │   │   │   ├── IntakeSlipNote*.tsx, IntakeSaveConfirmModal.tsx
│   │   │   │   └── …
│   │   │   ├── operator/                             # มือถือ: การ์ด, sticky bar, picker
│   │   │   ├── reports/                              # ตัวกรอง/ตาราง/KPI รายงาน
│   │   │   │   ├── ReportFilters.tsx
│   │   │   │   ├── ReportKpiGrid.tsx, ReportTableSection.tsx
│   │   │   │   └── ReportHeatmap.tsx
│   │   │   ├── admin/
│   │   │   │   ├── AdminCatalogFilter.tsx            # กรองร้าน + ค้นหา (+ ยังไม่ผูกร้าน)
│   │   │   │   ├── AdminItemsCatalogTableUi.tsx      # sort header + chips ร้าน
│   │   │   │   ├── AdminSideForm.tsx
│   │   │   │   ├── AdminItemShopUnitsEditor.tsx
│   │   │   │   ├── AdminItemStandardUnitsEditor.tsx
│   │   │   │   ├── AdminUnsavedChangesProvider.tsx
│   │   │   │   ├── AdminSubNav.tsx, AdminLayoutChrome.tsx
│   │   │   │   └── …
│   │   │   ├── nav/                                  # AppMobileMenu, NavUserMenu, settings
│   │   │   ├── ui/                                   # AppDateField
│   │   │   ├── icons/AppIcons.tsx
│   │   │   ├── AppNav.tsx
│   │   │   ├── LocaleSwitcher.tsx
│   │   │   └── Toast.tsx
│   │   ├── context/
│   │   │   ├── AppDataContext.tsx                    # suppliers, items, mapping, standards
│   │   │   └── LocaleContext.tsx                     # TH / EN / KR
│   │   ├── hooks/
│   │   │   ├── useDrawerNav.ts
│   │   │   ├── useCompactAdminLayout.ts              # ≤960px: bottom sheet ฟอร์ม admin
│   │   │   ├── useDropdownTransition.ts
│   │   │   └── useModalLayer.ts
│   │   ├── lib/
│   │   │   ├── auth/                                 # session, paths, intake permissions
│   │   │   ├── i18n/                                 # messages, ชื่อสินค้า/ร้าน/หน่วย
│   │   │   ├── domain/
│   │   │   │   ├── transactions.ts, purchase-units.ts
│   │   │   │   ├── intake-slip.ts, intake-day-overview.ts
│   │   │   │   ├── item-filter.ts, item-linked-shops.ts
│   │   │   │   └── supplier-sort.ts, units.ts
│   │   │   ├── admin/
│   │   │   │   ├── items-catalog-list.ts             # filter/sort รายการสินค้า (items + products)
│   │   │   │   ├── item-standard-units-config.ts
│   │   │   │   └── item-shop-units-config.ts
│   │   │   ├── reports/                              # aggregate, period, date-range, export-excel
│   │   │   ├── catalog/item-categories.ts
│   │   │   ├── services/data.ts, units.ts, …
│   │   │   ├── users/                                # PIN, display-name, db
│   │   │   ├── db/                                   # postgres-error, schema-support
│   │   │   ├── navigation/admin-nav.ts
│   │   │   ├── supabase/admin.ts
│   │   │   ├── api/client.ts, response.ts, success.ts
│   │   │   ├── types.ts
│   │   │   └── utils/
│   │   └── middleware.ts                             # PIN session + role guard
│   ├── scripts/
│   │   ├── seed-pins.ts, import-from-csv.ts, import-transactions.ts
│   │   ├── build-units-from-transactions.ts
│   │   ├── deploy-phase1-setup.ts, verify-supabase.ts
│   │   ├── apply-migrations.ts, print-vercel-env.ts
│   │   ├── load-deploy-env.ts, reset-user-pins.ts
│   │   ├── fix-gramma-unit.mjs
│   │   └── item-category-mapping.csv
│   ├── supabase/migrations/                          # 001–012 (ดูตารางด้านล่าง)
│   ├── .env.example, .env.production.example
│   ├── .env.local                                  # ค่าจริง (ไม่ commit)
│   ├── package.json
│   ├── vercel.json
│   └── README.md
│
├── Backup/                                           # ระบบเดิม + ข้อมูลต้นทาง (ไม่ใช้ runtime)
│   ├── index.html
│   ├── code.gs
│   └── DB File/
│       ├── Ex Data/                                  # CSV สำหรับ npm run import:csv
│       └── RM Amazing Nongkhai - DB.xlsx             # สำหรับ import:transactions
│
└── README.md                                         # ไฟล์นี้
```

> **สำคัญ:** `package.json` อยู่ใน `web/` — รันคำสั่ง `npm` จากโฟลเดอร์ `web` เสมอ (ไม่ใช่โฟลเดอร์ราก)

---

## โฟลเดอร์ที่ใช้งาน vs เก็บอ้างอิง

| โฟลเดอร์ | สถานะ |
|----------|--------|
| [`web/`](web/) | แอปปัจจุบัน — พัฒนา, รัน, deploy |
| [`Backup/`](Backup/) | GAS + Sheet/CSV/Excel ต้นทาง — **ไม่ deploy** |

---

## ฟีเจอร์หลัก

| หน้า | Path | บทบาท |
|------|------|--------|
| รับสินค้า | `/receiving` (`/intake` redirect) | operator, admin, manager |
| ประวัติรับสินค้า | `/history` | operator, admin, manager |
| รายงาน | `/report` | manager, admin |
| โปรไฟล์ | `/profile` | ทุก role |
| ตั้งค่า — ร้านค้า | `/admin/shops` | admin, manager |
| ตั้งค่า — หน่วยสินค้า | `/admin/units` | admin |
| ตั้งค่า — สินค้า | `/admin/items` | admin, manager |
| ตั้งค่า — ผูกสินค้ากับร้าน | `/admin/products` (`/admin/link`, `/admin/prices` redirect) | admin, manager |
| ตั้งค่า — ผู้ใช้ | `/admin/users` | admin |

- ล็อกอิน **PIN** ที่ `/login`
- หลังล็อกอิน: **operator** → `/receiving`, **admin/manager** → `/history`
- รายการสินค้าใน **สินค้า** และ **ผูกสินค้ากับร้าน**: กรองตามร้าน (รวม **ยังไม่ผูกร้าน**), ค้นหา, sort คอลัมน์ (รหัส · ชื่อ · หมวด · ร้านที่ผูก · หน่วย)
- ภาษา UI: **ไทย / English / 한국어**
- ชื่อสินค้า ร้านค้า และหน่วยแสดงตามภาษาที่เลือก (fallback ชื่อไทย)

### หน่วยซื้อเข้า (หลายแบบต่อสินค้า)

| ชั้น | ตั้งที่ | ใช้ทำอะไร |
|------|--------|-----------|
| **มาตรฐานสินค้า** | `/admin/items` → หน่วยซื้อเข้ามาตรฐาน | กำหนดแพ็ค→ฟอง (30), ฟอง→ฟอง (1) ฯลฯ — ไม่มีราคา |
| **เปิดใช้ต่อร้าน** | `/admin/products` | เลือกมาตรฐานที่ร้านใช้ + ราคามาตรฐาน + หน่วยเริ่มต้น |
| **รับสินค้า** | `/receiving` | dropdown เลือกหน่วยซื้อเข้า (ถ้ามีมากกว่า 1 แบบ); สรุปร้านที่มี draft วันนั้นก่อนเลือกร้าน |

ตัวอย่างไข่ไก่: แถว 1 **แพ็ค → ฟอง (30)** เป็นหน่วยเริ่มต้น, แถว 2 **ฟอง → ฟอง (1)** สำหรับซื้อเป็นฟองเดี่ยว

### หน้ารับสินค้า (`/receiving`)

- มือถือ: ภาพรวมร้านในวันที่เลือก (บันทึกแล้ว / draft ค้าง) ก่อนเข้ารายการสินค้า
- เลือก **วันที่รับ** + **ร้านค้า** แล้วกรอกจำนวน / ราคารวมต่อรายการ
- สินค้าที่มีหลายหน่วยซื้อเข้า → เลือกหน่วยก่อนกรอกจำนวน
- มือถือ: การ์ดต่อสินค้า + แถบบันทึกติดล่าง; จอใหญ่: ตาราง
- หมายเหตุใบเสร็จ (slip note) แบบไอคอน + modal
- แก้ไขรายการวันเดิมของร้านเดิม → บันทึกทับ (replace)
- ลบทั้งวัน (operator ย้อนหลังไม่เกิน 7 วัน)

---

## ฐานข้อมูล (Supabase)

รัน migration **ตามลำดับเลข** ใน **SQL Editor** แล้ว **Reload schema** (Settings → API) ถ้า PostgREST ยังไม่เห็นตารางใหม่

| ไฟล์ | เนื้อหาหลัก |
|------|----------------|
| [`001_init.sql`](web/supabase/migrations/001_init.sql) | schema หลัก |
| [`002_transaction_audit.sql`](web/supabase/migrations/002_transaction_audit.sql) | `saved_by_*` บน transactions |
| [`002_seed_pins.sql`](web/supabase/migrations/002_seed_pins.sql) | seed PIN (ถ้าใช้ SQL แทน script) |
| [`003_supplier_i18n.sql`](web/supabase/migrations/003_supplier_i18n.sql) | ชื่อร้าน EN/KR |
| [`004_app_users_profile.sql`](web/supabase/migrations/004_app_users_profile.sql) | โปรไฟล์ผู้ใช้ |
| [`005_units_and_mapping_config.sql`](web/supabase/migrations/005_units_and_mapping_config.sql) | ตาราง `units`, mapping versions |
| [`006_units_i18n.sql`](web/supabase/migrations/006_units_i18n.sql) | ชื่อหน่วย 3 ภาษา |
| [`007_supplier_sort_order.sql`](web/supabase/migrations/007_supplier_sort_order.sql) | เรียงลำดับร้าน |
| [`008_fix_gramma_unit.sql`](web/supabase/migrations/008_fix_gramma_unit.sql) | แก้หน่วยกรัม |
| [`009_rename_operator_role_label.sql`](web/supabase/migrations/009_rename_operator_role_label.sql) | ป้าย role |
| [`010_item_categories.sql`](web/supabase/migrations/010_item_categories.sql) | หมวดหมู่ + `items.category_code` |
| [`011_supplier_item_purchase_units.sql`](web/supabase/migrations/011_supplier_item_purchase_units.sql) | หน่วยซื้อเข้าต่อร้าน + ราคา |
| [`012_item_purchase_units.sql`](web/supabase/migrations/012_item_purchase_units.sql) | หน่วยซื้อเข้ามาตรฐานต่อสินค้า |

| ตาราง | คำอธิบาย |
|--------|----------|
| `suppliers` | ร้านค้า |
| `items` | สินค้า — ชื่อ TH/EN/KR, หน่วยหลัก/ย่อย, หมวดหมู่ |
| `units` | หน่วยมาตรฐานในระบบ |
| `item_categories` | หมวดหมู่รายงาน (PROT, PROD, SEA, PANTRY, BEV) |
| `item_purchase_units` | หน่วยซื้อเข้ามาตรฐานต่อสินค้า (PK: item + main unit) |
| `supplier_item_purchase_units` | หน่วยที่ร้านเปิดใช้ + ราคามาตรฐาน |
| `supplier_item_mapping` | mapping หลักต่อร้าน (ซิงค์จากหน่วย default) |
| `transactions` | บันทึกรับของ |
| `app_users` | PIN (bcrypt) + บทบาท |

---

## เริ่มใช้งาน

### 1. Supabase + env

1. สร้างโปรเจกต์ที่ [supabase.com](https://supabase.com)
2. รัน migration `001` → `012` ตามลำดับ (ข้าม `002_seed_pins` ได้ถ้าใช้ `npm run seed:pins`)
3. คัดลอก `web/.env.example` → `web/.env.local`

| ตัวแปร | หาได้จาก |
|--------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable / anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret / service_role key |
| `SESSION_SECRET` | `openssl rand -base64 32` |

### 2. ติดตั้งและรัน (ต้องอยู่ใน `web/`)

```bash
cd web
npm install
npm run seed:pins          # operator 1111 · admin 2222 · manager 3333
npm run import:csv         # จาก Backup/DB File/Ex Data/
npm run dev
```

เปิด **http://localhost:3000**

| ปัญหา | แก้ |
|--------|-----|
| `ERR_CONNECTION_REFUSED` | ยังไม่รัน `npm run dev` หรือรันจากโฟลเดอร์ราก — ใช้ `cd web` ก่อน |
| `ENOENT package.json` | รัน `npm` จาก `web/` ไม่ใช่ `RM_Amazing_NKh_System/` |

**รีสตาร์ท dev server:** `Ctrl+C` แล้ว `npm run dev` อีกครั้ง (หลังแก้ `.env.local` ต้องรีสตาร์ท)

### 3. นำเข้าประวัติจาก Excel (ครั้งเดียว)

```bash
cd web
npm run import:transactions -- --dry-run
npm run import:transactions
```

ต้นทาง: `Backup/DB File/RM Amazing Nongkhai - DB.xlsx`

---

## คำสั่งที่ใช้บ่อย

```bash
cd web
npm run dev              # พัฒนา → http://localhost:3000
npm run build            # ตรวจ build ก่อน deploy
npm run start            # รัน production local
npm run seed:pins
npm run import:csv
npm run import:transactions
npm run build:units      # สร้างหน่วยจากประวัติ transaction
npm run deploy:verify    # ตรวจ Supabase ก่อน deploy (ใช้กับ DEPLOY_ENV=production)
npm run deploy:setup     # seed + import ครั้งแรกบน production
```

---

## Deploy (Vercel) — Production Phase 1

รายละเอียดครบ: [`web/README.md`](web/README.md) ส่วน **Deploy to Vercel**

```bash
cd web
cp .env.production.example .env.production.local   # ใส่ Supabase production + SESSION_SECRET ใหม่
DEPLOY_ENV=production npm run deploy:verify
DEPLOY_ENV=production npm run deploy:setup         # โปรเจกต์ Supabase ว่างเท่านั้น
DEPLOY_ENV=production npm run deploy:print-vercel-env   # คัดลอกไป Vercel
```

Git (จาก root repo): `git remote add origin …` → `git push -u origin main`  
Vercel: Import repo → **Root Directory `web`** → ใส่ env → Deploy

---

## ระบบเดิม (`Backup/`)

| ไฟล์ | บทบาท |
|------|--------|
| [`Backup/code.gs`](Backup/code.gs) | Backend Google Apps Script |
| [`Backup/index.html`](Backup/index.html) | Frontend เดิม |
| [`Backup/DB File/`](Backup/DB%20File/) | Export Sheet + CSV + Excel |

Logic หลักถูกย้ายไป:

- [`web/src/lib/services/data.ts`](web/src/lib/services/data.ts) — Supabase data layer
- [`web/src/lib/domain/transactions.ts`](web/src/lib/domain/transactions.ts) — รวมรายการ, ราคา, แปลงหน่วย
- [`web/src/lib/domain/purchase-units.ts`](web/src/lib/domain/purchase-units.ts) — ตัวเลือกหน่วยตอนรับของ
- [`web/src/lib/reports/aggregate.ts`](web/src/lib/reports/aggregate.ts) — สรุปรายงานต้นทุน
- [`web/src/lib/admin/items-catalog-list.ts`](web/src/lib/admin/items-catalog-list.ts) — กรอง/เรียงรายการสินค้าใน admin

---

## API หลัก (หลังล็อกอิน)

| Method | Path | หมายเหตุ |
|--------|------|----------|
| GET | `/api/data/initial` | suppliers, items, mapping, purchase units, standards |
| GET/POST | `/api/transactions` | ดึง/บันทึกรายการ |
| POST | `/api/transactions/replace` | ทับรายการวัน+ร้าน |
| DELETE | `/api/transactions/batch` | ลบทั้งวัน+ร้าน |
| PATCH | `/api/items/[code]` | แก้สินค้า |
| PATCH | `/api/items/[code]/purchase-standards` | หน่วยซื้อเข้ามาตรฐาน |
| POST | `/api/products/setup` | ผูกร้าน + หน่วย/ราคาต่อร้าน |
| GET/PATCH | `/api/units` | หน่วยมาตรฐาน |
| GET | `/api/reports` | รายงาน (filter หมวดหมู่ได้) |
