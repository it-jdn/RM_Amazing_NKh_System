import type { Locale } from "@/lib/i18n/types";

const MO_TH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
const MO_FULL_TH = [
  "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
  "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
];
const MO_EN = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MO_FULL_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const MO_KR = ["1월", "2월", "3월", "4월", "5월", "6월", "7월", "8월", "9월", "10월", "11월", "12월"];

const DOW_TH = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const DOW_TH_FULL = ["อาทิตย์", "จันทร์", "อังคาร", "พุธ", "พฤหัส", "ศุกร์", "เสาร์"];
const DOW_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const DOW_KR = ["일", "월", "화", "수", "목", "금", "토"];

/** @deprecated use getAppDayOfWeekShort(day, "th") */
export const _dow = DOW_TH_FULL;

export function parseISODateLocal(dateStr: string): Date | null {
  if (!dateStr) return null;
  const d = new Date(String(dateStr).substring(0, 10) + "T12:00:00");
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Standard app date: day + short month + year (ค.ศ. / CE — e.g. 17 พ.ค. 2026) */
export function formatAppDate(dateStr: string, locale: Locale): string {
  const d = parseISODateLocal(dateStr);
  if (!d) return dateStr;
  const day = d.getDate();
  const mo = d.getMonth();
  const year = d.getFullYear();
  if (locale === "th") {
    return `${day} ${MO_TH[mo]} ${year}`;
  }
  if (locale === "kr") {
    return `${day} ${MO_KR[mo]} ${year}`;
  }
  return `${day} ${MO_EN[mo]} ${year}`;
}

export function getAppDayOfWeekShort(dayIndex: number, locale: Locale): string {
  const i = ((dayIndex % 7) + 7) % 7;
  if (locale === "th") return DOW_TH[i];
  if (locale === "kr") return DOW_KR[i];
  return DOW_EN[i];
}

/** Weekday name for compact date blocks (e.g. พุธ, Wed) */
export function getAppDayOfWeekLabel(dayIndex: number, locale: Locale): string {
  const i = ((dayIndex % 7) + 7) % 7;
  if (locale === "th") return DOW_TH_FULL[i];
  if (locale === "kr") return DOW_KR[i];
  return DOW_EN[i];
}

/** Short month label for calendar-style blocks (e.g. พ.ค.) */
export function getAppMonthShort(monthIndex: number, locale: Locale): string {
  const m = ((monthIndex % 12) + 12) % 12;
  if (locale === "th") return MO_TH[m];
  if (locale === "kr") return MO_KR[m];
  return MO_EN[m];
}

/** Weekday + standard short date */
export function formatAppDateLong(dateStr: string, locale: Locale): string {
  const d = parseISODateLocal(dateStr);
  if (!d) return dateStr;
  const dow = getAppDayOfWeekShort(d.getDay(), locale);
  const date = formatAppDate(dateStr, locale);
  if (locale === "th") return `${DOW_TH_FULL[d.getDay()]}. ${date}`;
  return `${dow} ${date}`;
}

export function formatAppMonthYear(yyyy: string, mm: string, locale: Locale): string {
  const y = parseInt(yyyy, 10);
  const m = parseInt(mm, 10) - 1;
  if (Number.isNaN(y) || Number.isNaN(m) || m < 0 || m > 11) return `${yyyy}-${mm}`;
  if (locale === "th") return `${MO_FULL_TH[m]} ${y}`;
  if (locale === "kr") return `${y}년 ${m + 1}월`;
  return `${MO_FULL_EN[m]} ${y}`;
}

/** @deprecated use formatAppDate */
export function formatDateTH(dateStr: string) {
  return formatAppDateLong(dateStr, "th");
}

/** @deprecated use formatAppDate */
export function dateTHShort(dateStr: string) {
  return formatAppDate(dateStr, "th");
}

/** @deprecated use formatAppDate */
export function formatIntakeDateShort(dateStr: string, locale: Locale) {
  return formatAppDate(dateStr, locale);
}

/** @deprecated use formatAppMonthYear */
export function monthTHLabel(yyyy: string, mm: string) {
  return formatAppMonthYear(yyyy, mm, "th");
}

export function fmt(n: number | string) {
  return (parseFloat(String(n)) || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

/** ปฏิทินธุรกิจรับสินค้า / ประวัติ — ตามเวลาไทย ไม่ขึ้นกับประเทศที่ล็อกอิน */
export const BUSINESS_TIMEZONE = "Asia/Bangkok";

export function calendarDateInTimezone(date: Date, timeZone: string): string {
  return date.toLocaleDateString("sv-SE", { timeZone });
}

/** Calendar date on the user's device (browser timezone). */
export function browserCalendarTodayISO(): string {
  try {
    return calendarDateInTimezone(new Date(), Intl.DateTimeFormat().resolvedOptions().timeZone);
  } catch {
    return calendarDateInTimezone(new Date(), BUSINESS_TIMEZONE);
  }
}

/** @deprecated use todayBangkokISO for business dates */
export function todayISO() {
  return todayBangkokISO();
}

/** Calendar date in Asia/Bangkok (YYYY-MM-DD). */
export function todayBangkokISO() {
  return calendarDateInTimezone(new Date(), BUSINESS_TIMEZONE);
}

function toISOStringDate(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function addCalendarDaysISO(iso: string, days: number): string {
  const d = parseISODateLocal(iso);
  if (!d) return iso;
  d.setDate(d.getDate() + days);
  return toISOStringDate(d);
}

/** วันอาทิตย์ที่เริ่มสัปดาห์ปฏิทิม (อา.–ส.) */
export function weekStartSunday(isoDate: string): string {
  const d = parseISODateLocal(isoDate);
  if (!d) return isoDate;
  return addCalendarDaysISO(isoDate, -d.getDay());
}

/**
 * สัปดาห์นี้ (Bangkok): ช่วง 8 วัน อาทิตย์–อาทิตย์ (รวมปลายทาง)
 * - วันนี้เป็นอาทิตย์: วันนี้ → อาทิตย์ถัดไป
 * - วันอื่น: ย้อนไป (dow+1) วันจากวันนี้ แล้ว +7 วัน (เช่น พ. 27 → 23–30 พ.ค.)
 */
export function thisWeekRangeISO(referenceISO?: string): DateRangeISO {
  const today = referenceISO || todayBangkokISO();
  const d = parseISODateLocal(today);
  if (!d) return { from: today, to: today };
  const dow = d.getDay();
  const startOffset = dow === 0 ? 0 : dow + 1;
  const from = addCalendarDaysISO(today, -startOffset);
  const to = addCalendarDaysISO(from, 7);
  return { from, to };
}

/** ช่วงวันที่แบบย่อเมื่ออยู่เดือนเดียวกัน (เช่น 23–30 พ.ค. 2026) */
export function formatAppDateRange(from: string, to: string, locale: Locale): string {
  const df = parseISODateLocal(from);
  const dt = parseISODateLocal(to);
  if (!df || !dt) {
    return `${formatAppDate(from, locale)} – ${formatAppDate(to, locale)}`;
  }
  if (df.getFullYear() === dt.getFullYear() && df.getMonth() === dt.getMonth()) {
    const mo = df.getMonth();
    if (locale === "th") {
      return `${df.getDate()}–${dt.getDate()} ${MO_TH[mo]} ${df.getFullYear()}`;
    }
    if (locale === "kr") {
      return `${df.getDate()}–${dt.getDate()} ${MO_KR[mo]} ${df.getFullYear()}`;
    }
    return `${df.getDate()}–${dt.getDate()} ${MO_EN[mo]} ${df.getFullYear()}`;
  }
  return `${formatAppDate(from, locale)} – ${formatAppDate(to, locale)}`;
}

/** วันแรกของเดือนปัจจุบัน (Asia/Bangkok) */
export function monthStartISO() {
  const parts = new Date().toLocaleString("en-CA", { timeZone: "Asia/Bangkok" }).split(",")[0];
  const [y, m] = parts.split("-");
  return `${y}-${m}-01`;
}

/** True if string is ISO-like with explicit Z or numeric UTC offset (timestamptz from DB). */
function hasExplicitUtcOffset(isoCore: string): boolean {
  if (/[zZ]$/.test(isoCore)) return true;
  const m = isoCore.match(/([+-]\d{2}(?::\d{2})?(?::\d{2})?)$/);
  return Boolean(m);
}

/** Parse DB/API timestamps: explicit Z/offset use ISO rules; else treat as Bangkok wall (legacy saves). */
function parseTimestampForDisplay(input: string): Date | null {
  const s0 = input.trim();
  if (!s0) return null;
  const core = s0.includes("T") ? s0 : s0.replace(" ", "T");
  const candidate = hasExplicitUtcOffset(core) ? core : `${core}+07:00`;
  const d = new Date(candidate);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** แสดงวันเวลาบันทึกจาก saved_at */
export function formatAppDateTime(savedAt: string, locale: Locale): string {
  if (!savedAt) return "";
  const d = parseTimestampForDisplay(savedAt);
  if (!d) return savedAt;
  const datePart = d.toLocaleDateString("sv-SE", { timeZone: "Asia/Bangkok" });
  const timePart = d.toLocaleTimeString(locale === "kr" ? "ko-KR" : locale === "en" ? "en-GB" : "th-TH", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const dateLabel = formatAppDate(datePart, locale);
  if (locale === "th") return `${dateLabel} ${timePart} น.`;
  if (locale === "kr") return `${dateLabel} ${timePart}`;
  return `${dateLabel} ${timePart}`;
}

/** @deprecated use formatAppDateTime */
export function formatDateTimeTH(savedAt: string) {
  return formatAppDateTime(savedAt, "th");
}

/** @deprecated use daysAgoBangkok for business date ranges */
export function daysAgoISO(days: number) {
  return daysAgoBangkok(days);
}

export function daysAgoBangkok(days: number): string {
  const base = parseISODateLocal(todayBangkokISO());
  if (!base) return todayBangkokISO();
  base.setDate(base.getDate() - days);
  return toISOStringDate(base);
}

export type DateRangeISO = { from: string; to: string };

/** ช่วงวันที่สำเร็จรูปสำหรับหน้าประวัติ */
export function histDatePresetRange(preset: string): DateRangeISO {
  const today = todayBangkokISO();
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = daysAgoBangkok(1);
      return { from: y, to: y };
    }
    case "last7":
      return { from: daysAgoBangkok(6), to: today };
    case "thisWeek":
      return thisWeekRangeISO();
    case "last30":
      return { from: daysAgoBangkok(29), to: today };
    case "thisMonth":
      return { from: monthStartISO(), to: today };
    case "lastMonth":
      return lastMonthRangeISO();
    case "all":
      return { from: "", to: "" };
    default:
      return { from: today, to: today };
  }
}

function lastMonthRangeISO(): DateRangeISO {
  const d = parseISODateLocal(todayBangkokISO());
  if (!d) {
    const today = todayBangkokISO();
    return { from: today, to: today };
  }
  const first = new Date(d.getFullYear(), d.getMonth() - 1, 1);
  const last = new Date(d.getFullYear(), d.getMonth(), 0);
  return { from: toISOStringDate(first), to: toISOStringDate(last) };
}

export const HIST_DATE_PRESETS: { id: string; label: string }[] = [
  { id: "today", label: "วันนี้" },
  { id: "yesterday", label: "เมื่อวาน" },
  { id: "last7", label: "7 วันล่าสุด" },
  { id: "last30", label: "30 วันล่าสุด" },
  { id: "thisMonth", label: "เดือนนี้" },
  { id: "lastMonth", label: "เดือนที่แล้ว" },
  { id: "all", label: "ทั้งหมด" },
];
