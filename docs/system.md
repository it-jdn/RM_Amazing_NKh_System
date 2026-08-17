# โครงสร้างระบบและ Business Logic

เอกสารนี้เป็นแหล่งอ้างอิงหลักก่อนพัฒนาระบบต่อ — สอดคล้องกับโค้ดใน [`web/`](../web/) ณ ช่วงอัปเดตนี้  
ภาพรวม repo / setup / deploy ยังอยู่ที่ [`README.md`](../README.md)

**แอป:** Next.js (`web/`) · Supabase PostgreSQL · Vercel  
**โดเมนธุรกิจ:** บันทึกการรับวัตถุดิบร้านอาหารไทย Amazing Nongkhai (เกาหลี)  
**สกุลเงิน:** ₩ (KRW)  
**วันที่ธุรกิจ (`txn_date`):** ปฏิทิน **Asia/Bangkok**  
**เวลาที่แสดงบนหน้าจอ (`saved_at` / `created_at` / `updated_at`):** timezone ของเครื่องผู้ดู

---

## 1. บทบาทและสิทธิ์

| Role | ล็อกอิน | หน้าหลักหลังล็อกอิน | รับสินค้า / ประวัติ | รายงาน | Admin ร้าน·สินค้า·ผูก | หน่วย / ผู้ใช้ |
|------|---------|----------------------|---------------------|--------|----------------------|----------------|
| **operator** | PIN + เลือกบทบาท | `/receiving` | ได้ | ไม่มีเมนู (API 403) | ไม่ได้ | ไม่ได้ |
| **manager** | PIN + เลือกบทบาท | `/receiving` | ได้ | ได้ | ได้ (แก้สินค้าได้ ไม่เปลี่ยนรหัส / ไม่ลบ) | ไม่ได้ |
| **admin** | PIN + เลือกบทบาท | `/receiving` | ได้ | ได้ | ได้เต็ม | ได้ |

- Session: cookie `rm_session` (JWT, httpOnly, 24 ชม.) — [`web/src/lib/auth/session.ts`](../web/src/lib/auth/session.ts)
- หน้าแรกทุก role: `getHomePath()` → `/receiving` — [`web/src/lib/auth/paths.ts`](../web/src/lib/auth/paths.ts)
- PIN ต้องไม่ซ้ำในบทบาทเดียวกัน (หลายคนใช้ PIN เดียวกันใน role เดียวกัน → 403)
- กั้นหน้า: [`web/src/middleware.ts`](../web/src/middleware.ts) + `roleCanAccess` / `roleCanAccessApi`

### แก้ / ลบใบรับสินค้า

| การกระทำ | admin / manager | operator |
|----------|-----------------|----------|
| แก้ใบ | ทุกใบ | เฉพาะใบที่ตนเป็นผู้สร้าง หรือใบ legacy ที่ไม่มี `createdByUserId` |
| ลบใบ | ทุกวันที่ | เฉพาะใบตนเอง **และ** วันที่อยู่ใน 7 วันย้อนหลังตามเวลาไทย |

โค้ด: [`intake-slip-permissions.ts`](../web/src/lib/auth/intake-slip-permissions.ts), [`intake-permissions.ts`](../web/src/lib/auth/intake-permissions.ts) (`OPERATOR_DELETE_DAYS = 7`)

---

## 2. โมเดลข้อมูลหลัก

```
suppliers ──┐
            ├── supplier_item_mapping          (mapping หลักต่อร้าน + ราคา default)
            ├── supplier_item_purchase_units   (หน่วยที่ร้านเปิดใช้ + ราคา)
items ──────┤
            └── item_purchase_units            (หน่วยมาตรฐานของสินค้า — ไม่มีราคา)
units
item_categories
intake_slips ── transactions.slip_id           (หลายใบต่อวันต่อร้าน)
app_users
mapping_price_history                          (ประวัติราคา mapping)
```

| ตาราง | ความหมายทางธุรกิจ |
|--------|-------------------|
| `suppliers` | ร้านค้า / ซัพพลายเออร์ (ชื่อ 3 ภาษา, ลำดับ, เปิด-ปิด, เลขทะเบียนธุรกิจถ้ามี) |
| `items` | สินค้า (ชื่ออย่างน้อย 1 ภาษา, หมวด, หน่วยหลัก/ย่อยสำรอง) |
| `units` | คลังหน่วยมาตรฐาน (ชื่อ 3 ภาษา) |
| `item_categories` | PROT · PROD · SEA · PANTRY · BEV · **MISC** |
| `item_purchase_units` | แพ็กหน่วยซื้อเข้ามาตรฐานต่อสินค้า (เช่น แพ็ค→ฟอง ×30) |
| `supplier_item_purchase_units` | หน่วยที่ร้านนั้นรับได้ + ราคามาตรฐาน + หน่วยเริ่มต้นตอนรับ |
| `supplier_item_mapping` | แถวหลักร้าน×สินค้า (ซิงค์จากหน่วย default) |
| `intake_slips` | หัวใบรับ (วันที่ธุรกิจ, ร้าน, หมายเหตุ, ผู้สร้าง/ผู้แก้) |
| `transactions` | บรรทัดรับของ — `qty` เป็นหน่วยซื้อเข้า, `total_price` คือเงินที่จ่ายจริง |
| `app_users` | PIN (bcrypt) + บทบาท |

**กฎบรรทัดในใบ:** unique `(slip_id, item_code, trim(main_unit))` เมื่อมี `slip_id` (migration **015**) — สินค้าเดียวกันหลายหน่วยในใบเดียวกันได้ แต่หน่วยเดียวกันซ้ำไม่ได้

---

## 3. วันที่และเวลา

| ชนิดข้อมูล | ใช้ทำอะไร | โซนเวลา |
|------------|-----------|---------|
| `txn_date` (date) | วันที่รับสินค้า, กรองประวัติ/รายงาน, สิทธิ์ลบ 7 วัน | **Bangkok** (`todayBangkokISO`) |
| `saved_at` / `created_at` / `updated_at` | ใครบันทึกเมื่อไร | เก็บเป็น timestamptz (+07:00 ตอนบันทึก) **แสดงตามเครื่องผู้ดู** (`formatAppDateTime` + `userDisplayTimeZone`) |
| ปีที่แสดง | ปฏิทิน | **ค.ศ. (CE)** — ไม่ใช้ พ.ศ. บน UI |
| ปี พ.ศ. ใน DB เก่า | `txn_date` ปี ≥ 2400 | แปลง −543 (runtime `normalizeTxnDateISO` + migration **016**) |

VPN ไม่เปลี่ยน timezone ของเบราว์เซอร์ — ทดสอบเกาหลีต้องตั้ง OS/browser เป็น `Asia/Seoul`

---

## 4. หน่วยซื้อเข้า (3 ชั้น)

| ชั้น | ตั้งที่ | มีราคา? | ใช้ทำอะไร |
|------|--------|---------|-----------|
| 1. มาตรฐานสินค้า | `/admin/items` | ไม่มี | กำหนดคู่หน่วย + อัตราแปลง (หลายแถวได้ **ตั้งแต่ตอนเพิ่มสินค้า**) |
| 2. เปิดใช้ต่อร้าน | `/admin/products` (แผงผูกร้าน) | มี | เลือกว่ามาตรฐานไหนร้านนี้รับได้ + ราคา + หน่วยเริ่มต้น |
| 3. ตอนรับของ | `/receiving` | ใช้ราคาอ้างอิงจากชั้น 2 | dropdown/สลับหน่วยถ้ามีมากกว่า 1 |

ตอนรับของ ตัวเลือกมาจาก `purchaseUnitsForItem()` — มาตรฐานสินค้า ∩ หน่วยที่ร้านเปิดใช้ ถ้าไม่มี fallback เป็น mapping

**การแสดงชื่อหน่วยบนฟอร์มรับสินค้า:** ดึงจาก catalog `units` ตาม locale (`intake-display-units.ts`) ไม่ใช้ข้อความ snapshot ภาษาไทยใน mapping โดยตรง

---

## 5. หน้ารับสินค้า `/receiving`

คอมโพเนนต์หลัก: [`IntakeView.tsx`](../web/src/components/pages/IntakeView.tsx)

### ภาพรวมรายวัน (ยังไม่เลือกร้าน)

- `IntakeDayOverview` — สลิปวันนี้ จัดกลุ่มตามร้าน
- เรียงร้าน/ใบตาม **กิจกรรมล่าสุด** (`groupSlipsByShop` / `slipLastActivityAt`)
- เลขใบในร้านยังเป็นลำดับเก่า→ใหม่ (ใบที่ 1, 2, …)

### เมื่อเลือกร้าน

- หลายใบต่อวันต่อร้าน (`intake_slips`)
- แท็บสลับใบ (`IntakeShopSlips`) + ใบใหม่
- กรอกจำนวน + ราคารวมเฉพาะรายการที่ซื้อ — แถวว่างไม่ถูกบันทึก
- สินค้าเดียวกันหลายหน่วยในใบเดียวกันได้ (คนละ `intakeRowKey`)
- หมายเหตุทั้งใบ (`slip note`)
- **หลังบันทึกสำเร็จ:** กลับภาพรวมรายวัน (ไม่ค้างที่ใบใหม่)
- ออกจากหน้าขณะฟอร์มสกปรก → `IntakeUnsavedNavigateModal` / `useGuardedNavigation`

### UX ตามจอ

| จอ | พฤติกรรม |
|----|----------|
| มือถือ ≤768px | การ์ดสินค้า + sticky บันทึก · operator มีแท็บล่าง รับของ/ประวัติ |
| แท็บเล็ต ≤1024px | การ์ด + drawer nav · ไม่มีตาราง desktop |
| Desktop ≥1025px | ตาราง sticky header |

เปลี่ยนภาษา: Hamburger / nav เท่านั้น (ไม่ซ้ำบนแถบวันที่–ร้าน)

### บันทึก

`POST /api/transactions` → `saveIntakeSlip`:

- ไม่มี `slipId` → สร้างใบใหม่
- มี `slipId` → อัปเดตหัวใบ ลบบรรทัดเดิมของใบนั้น แล้วใส่ใหม่ (`replaced: true`)

`unit_price` ที่เก็บ = `total_price / qty` ต่อหน่วยซื้อเข้า (ไม่แปลงเป็นหน่วยย่อย)

---

## 6. หน้าประวัติ `/history`

- รายการเป็น **กลุ่มวัน+ร้าน** ไม่ใช่ต่อใบ — หลายใบในวันเดียวกันรวมแถวเดียว เปิดแล้วค่อยแท็บใบ
- ค่าเริ่มต้นช่วงวันที่: เดือนนี้ (Bangkok)
- แก้จำนวน/มูลค่าใน `HistorySlipDetail` ตามสิทธิ์แก้ใบ
- ใบที่มี `slip_id`: `POST /api/transactions` พร้อม `slipId`
- ข้อมูลเก่าไม่มี slip: `POST /api/transactions/replace` (ทับทั้งวัน+ร้าน) — ถ้าวันนั้นมีหลายใบแล้ว API คืน 400 ให้แก้ทีละใบ
- พิมพ์ PDF: HTML print (`print-history-slip-document.ts`)
- ลบ: `DeleteIntakeBatchButton` (API บังคับสิทธิ์เจ้าของ+หน้าต่าง 7 วัน)

---

## 7. หน้ารายงาน (manager / admin)

| Path | หน้า | เนื้อหา |
|------|------|---------|
| `/report` | สรุปต้นทุน (`ReportView`) | KPI, กราฟ, ตารางหมวด/สินค้า/รายละเอียด, Excel, พิมพ์ |
| `/report/item-price` | เทียบราคา (`ReportItemPriceView`) | เลือกสินค้า → กราฟราคาต่อหน่วยจากประวัติรับของ |

Nav: [`report-nav.ts`](../web/src/lib/navigation/report-nav.ts)

### สูตรต้นทุน (สำคัญ)

- **มูลค่า = ผลรวม `total_price` ที่บันทึกจริง** ไม่ใช่ จำนวน × ราคามาตรฐาน
- **จำนวนในรายงาน = `qty` ตามหน่วยซื้อเข้า** — **ไม่แปลง** pack → หน่วยย่อย
- หมวดสินค้ามาจาก catalog ปัจจุบัน (สินค้าไม่มีหมวด / หมวดผิด → นับเป็น **PANTRY**)
- กรองวันที่บน `txn_date` (วันที่รับ) ไม่ใช่เวลาบันทึก

### `/report` ที่แสดงจริง

- KPI: ต้นทุนรวม · เฉลี่ยต่อวันที่มีการรับ · จำนวนสินค้าที่ไม่ซ้ำ
- กราฟ: ยอดรายวัน, สะสม, ตามร้าน, Top 10 ตามมูลค่า
- ตาราง: ตามหมวด / ตามสินค้า / รายละเอียด — แบ่งหน้าฝั่ง client 50 / 100 / ทั้งหมด เมื่อเกิน 50 แถว
- Excel หมวดและสินค้า: ส่งออกครบจาก aggregate
- Excel รายละเอียด: จำกัดตาม API **สูงสุด 200 แถว** (`pageSize` ถูก clamp 10–200)

### คำนวณแล้วแต่ยังไม่โชว์ใน UI

heatmap, กราฟโดนัทหมวด, cumulative รายสินค้า, เปรียบเทียบช่วงก่อนหน้า, ส่วนต่างราคารายเดือน, Top 10 ตามจำนวน

### `/report/item-price`

- แหล่งความจริง: **ราคา/หน่วยจริงจากใบรับ** (`transactions.unit_price` = ราคารวม ÷ จำนวน) — **ไม่ใช้ราคามาตรฐาน**
- แสดง**กราฟเดียว**ของ **5 สินค้าที่รับเข้าล่าสุด** ในช่วงที่กรอง
- ผู้ใช้กด **ทั้งหมด** หรือเลือกบางสินค้าให้แสดงบนกราฟ
- แต่ละเส้น = ราคา/หน่วยของสินค้า (ใช้หน่วยซื้อเข้าที่พบบ่อยสุดของสินค้านั้น)
- ตารางด้านล่างตามสินค้าที่เลือกไว้
- คนกรอกใบรับ **ไม่เปลี่ยน** — ยังกรอกจำนวน + ราคารวมเหมือนเดิม

### โมเดลราคา (ทิศทาง)

| ประเภท | สถานะ |
|--------|--------|
| ราคา/หน่วยจริงจากใบรับ | **แหล่งหลัก** ของรายงานราคาและต้นทุน |
| ราคามาตรฐานที่ตั้งตอนผูกร้าน | ไม่ใช้ในรายงานแนวโน้มราคา (ช่องใน admin อาจยังมีเพื่อข้อมูลเดิม แต่ไม่เป็นตัวตั้งต้นรายงาน) |
| ราคาอ้างอิงบนฟอร์มรับของ | ไม่กระทบการกรอก — ยังกรอกจำนวน+ราคารวม |

---

## 8. Admin

### สินค้า `/admin/items`

- เพิ่มสินค้า: กำหนด **หลายหน่วยมาตรฐานได้ก่อนบันทึก** (`AdminItemStandardUnitsEditor`)
- ชื่อ: อย่างน้อยหนึ่งภาษา (TH / EN / KR) — ไม่บังคับไทยอย่างเดียว
- หมวดบังคับเลือก (รวม **MISC ของใช้อื่นๆ**)
- หลังบันทึกสินค้าใหม่: ปิดฟอร์ม → เปิดแผง **ผูกร้าน** + ปุ่มโซ่สถานะกดค้าง + เลื่อนไปแถวใหม่
- ลบ (admin): ปุ่มถังขยะแดงในรายการ → confirm → **ห้ามลบถ้ายังผูกร้าน** หรือมีประวัติรับสินค้า
- แก้รหัสสินค้า: admin เท่านั้น (อัปเดต FK)

### ผูกสินค้ากับร้าน `/admin/products`

- เลือกร้าน + หน่วยมาตรฐานที่รับได้ + ราคา + หน่วยเริ่มต้นตอน intake
- `/admin/link` และ `/admin/prices` redirect มาที่นี่

### ร้าน `/admin/shops` · หน่วย `/admin/units` (admin) · ผู้ใช้ `/admin/users` (admin)

---

## 9. i18n

- UI: ไทย / English / 한국어 — `localStorage` key `rm_locale`
- ชื่อสินค้า ร้าน หน่วย หมวด: ตาม locale แล้ว fallback (EN: en→th→kr, KR: kr→en→th, TH: th→en→kr)
- ข้อความ toast จาก API บางส่วนยังเป็นภาษาไทยจากเซิร์ฟเวอร์

---

## 10. API ที่เกี่ยวกับธุรกิจ

| Method | Path | บทบาท | หน้าที่ |
|--------|------|--------|---------|
| GET | `/api/data/initial` | ล็อกอินแล้ว | catalog สำหรับ intake/admin |
| GET/POST | `/api/transactions` | ล็อกอินแล้ว | อ่าน / บันทึกใบ (`slipId`, `slipNote`) |
| POST | `/api/transactions/replace` | ล็อกอินแล้ว | ทับวัน+ร้านแบบ legacy (ห้ามถ้ามีหลายใบ) |
| DELETE | `/api/transactions/batch` | ตามสิทธิ์ลบ | ลบใบหรือทั้งวัน+ร้าน |
| GET | `/api/transactions/slips` | ล็อกอินแล้ว | รายการใบ (+ `canEdit`) |
| GET/PATCH/DELETE | `/api/transactions/slips/[id]` | ตามสิทธิ์ | เมตา / ลบใบ |
| GET | `/api/reports` | manager, admin | สรุปต้นทุน + แถวรายละเอียด (pageSize ≤ 200) |
| GET | `/api/reports/price-history` | manager, admin | จุดราคา mapping + จุดรับของ |
| POST | `/api/items/catalog` | admin, manager | เพิ่มสินค้าในคลัง |
| PATCH | `/api/items/[code]` | admin, manager | แก้สินค้า (รหัส = admin) |
| DELETE | `/api/items/[code]` | admin | ลบถ้าไม่มี mapping และไม่มี txn |
| PATCH | `/api/items/[code]/purchase-standards` | admin, manager | หน่วยมาตรฐาน |
| POST | `/api/products/setup` | admin, manager | ผูกร้าน + หน่วย/ราคา |
| POST | `/api/items` | operator+ | quick-add สินค้าตอนรับของ |

---

## 11. Migration ที่ต้องมีครบ

รันตามเลขใน SQL Editor หรือ `DEPLOY_ENV=production npm run db:migrate`

| ไฟล์ | เนื้อหา |
|------|---------|
| 001 | schema หลัก |
| 002_transaction_audit | audit บน transactions |
| 002_seed_pins | seed PIN (ทางเลือก — ใช้ `npm run seed:pins` ก็ได้) |
| 003–009 | i18n ร้าน/หน่วย, โปรไฟล์, ลำดับร้าน, แก้กรัม, ป้าย role |
| 010 | หมวดสินค้า (5 หมวด COGS แรก) |
| 011–012 | หน่วยซื้อเข้าต่อร้าน / มาตรฐานสินค้า |
| 013 | `intake_slips` + `transactions.slip_id` |
| 014 | เลขทะเบียนธุรกิจร้าน |
| **015** | unique บรรทัดใบ (สินค้า+หน่วย) |
| **016** | แปลง `txn_date` พ.ศ. → ค.ศ. |
| **017** | หมวด **MISC** ของใช้อื่นๆ |

SQL แก้ข้อมูลครั้งคราวอยู่ที่ `web/supabase/manual-fixes/` — ไม่รันอัตโนมัติ

---

## 12. แผนที่ไฟล์สำคัญ

| เรื่อง | ไฟล์ |
|--------|------|
| รับสินค้า UI | `web/src/components/pages/IntakeView.tsx` |
| สรุปรายวัน | `web/src/lib/domain/intake-day-overview.ts` |
| หน่วยตอนรับ | `web/src/lib/domain/purchase-units.ts`, `intake-display-units.ts` |
| บันทึกใบ | `web/src/lib/services/intake-slips.ts` |
| คำนวณแถว txn | `web/src/lib/domain/transactions.ts` |
| ประวัติ | `web/src/components/pages/HistoryView.tsx`, `history-list-groups.ts`, `history-slip-edit.ts` |
| รายงานสรุป | `web/src/components/pages/ReportView.tsx`, `lib/reports/aggregate.ts` |
| รายงานราคา | `web/src/components/pages/ReportItemPriceView.tsx`, `ReportPriceCompare.tsx` |
| จัดกลุ่มแนวโน้มราคา | `web/src/lib/reports/price-trend.ts` |
| Data layer | `web/src/lib/services/data.ts` |
| วันที่/เวลา | `web/src/lib/utils/format.ts` |
| สิทธิ์ | `web/src/lib/auth/session.ts`, `intake-slip-permissions.ts` |

---

## 13. ข้อควรรู้ตอนพัฒนารอบถัดไป

1. อย่าแปลงจำนวนในรายงานเป็นหน่วยย่อยโดยไม่ตกลงสูตรใหม่ — ตอนนี้ qty เป็นหน่วยซื้อเข้า
2. รายละเอียดรายงานเกิน 200 แถวจะไม่ครบในตาราง/Excel จนกว่าจะยก cap ที่ `getReportData`
3. `/report/item-price` ยังไม่อยู่ใน `ROLE_PAGES` แบบ prefix — เมนูซ่อนจาก operator แต่ URL ตรงอาจเปิดหน้าได้ (API ยัง 403)
4. ปุ่มลบใบฝั่ง UI เช็ควันที่ 7 วัน แต่เจ้าของใบบังคับที่ API
5. เอกสาร [`README.md`](../README.md) / [`web/README.md`](../web/README.md) ต้องให้สอดคล้องกับไฟล์นี้เมื่อเปลี่ยน landing, หมวด, หรือรายงาน
