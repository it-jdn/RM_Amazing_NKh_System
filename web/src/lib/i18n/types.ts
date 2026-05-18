export type Locale = "th" | "en" | "kr";

export const LOCALES: { id: Locale; label: string }[] = [
  { id: "th", label: "ไทย" },
  { id: "en", label: "EN" },
  { id: "kr", label: "한국어" },
];

export const LOCALE_STORAGE_KEY = "rm_locale";
