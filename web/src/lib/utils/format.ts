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

/** Standard app date: day + short month + 2-digit year (e.g. 17 พ.ค. 69) */
export function formatAppDate(dateStr: string, locale: Locale): string {
  const d = parseISODateLocal(dateStr);
  if (!d) return dateStr;
  const day = d.getDate();
  const mo = d.getMonth();
  if (locale === "th") {
    return `${day} ${MO_TH[mo]} ${String(d.getFullYear() + 543).slice(-2)}`;
  }
  if (locale === "kr") {
    return `${day} ${MO_KR[mo]} ${String(d.getFullYear()).slice(-2)}`;
  }
  return `${day} ${MO_EN[mo]} ${String(d.getFullYear()).slice(-2)}`;
}

export function getAppDayOfWeekShort(dayIndex: number, locale: Locale): string {
  const i = ((dayIndex % 7) + 7) % 7;
  if (locale === "th") return DOW_TH[i];
  if (locale === "kr") return DOW_KR[i];
  return DOW_EN[i];
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
  if (locale === "th") return `${MO_FULL_TH[m]} ${y + 543}`;
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

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
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

export function daysAgoISO(days: number) {
  return new Date(Date.now() - days * 864e5).toISOString().slice(0, 10);
}

export type DateRangeISO = { from: string; to: string };

/** ช่วงวันที่สำเร็จรูปสำหรับหน้าประวัติ */
export function histDatePresetRange(preset: string): DateRangeISO {
  const today = todayISO();
  switch (preset) {
    case "today":
      return { from: today, to: today };
    case "yesterday": {
      const y = daysAgoISO(1);
      return { from: y, to: y };
    }
    case "last7":
      return { from: daysAgoISO(6), to: today };
    case "last30":
      return { from: daysAgoISO(29), to: today };
    case "thisMonth":
      return { from: today.slice(0, 7) + "-01", to: today };
    case "lastMonth":
      return lastMonthRangeISO();
    case "all":
      return { from: "", to: "" };
    default:
      return { from: today, to: today };
  }
}

function lastMonthRangeISO(): DateRangeISO {
  const [y, m] = todayISO().split("-").map(Number);
  const first = new Date(Date.UTC(y, m - 2, 1));
  const last = new Date(Date.UTC(y, m - 1, 0));
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    from: `${first.getUTCFullYear()}-${pad(first.getUTCMonth() + 1)}-01`,
    to: `${last.getUTCFullYear()}-${pad(last.getUTCMonth() + 1)}-${pad(last.getUTCDate())}`,
  };
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
