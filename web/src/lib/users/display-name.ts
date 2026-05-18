/** Thai vowel/tone marks that must follow a consonant (U+0E01–U+0E2E), not stand alone or before Latin text. */
const ORPHAN_THAI_MARKS =
  /(?<![\u0E01-\u0E2E])[\u0E31\u0E34-\u0E3A\u0E47-\u0E4E\u0E4B]+/gu;

const ZERO_WIDTH = /[\u200B-\u200D\uFEFF]/g;

/** Strip accidental Thai marks / zero-width chars from a name field (e.g. ๋JITDHANA → JITDHANA). */
export function sanitizeUserNamePart(value: string): string {
  return value
    .normalize("NFC")
    .replace(ZERO_WIDTH, "")
    .replace(ORPHAN_THAI_MARKS, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function buildDisplayName(firstName: string, lastName: string): string {
  const first = sanitizeUserNamePart(firstName);
  const last = sanitizeUserNamePart(lastName);
  return [first, last].filter(Boolean).join(" ");
}

/** Nav profile button: omit last whitespace-separated segment (family name). */
export function userNavLabelName(displayName?: string): string {
  const trimmed = sanitizeUserNamePart(displayName ?? "");
  if (!trimmed) return "";
  const parts = trimmed.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return trimmed;
  return parts.slice(0, -1).join(" ");
}

const THAI_CONSONANT = /[\u0E01-\u0E2E]/;

/** Avatar / profile initial: first Thai consonant (e.g. แอดมิน → อ), else first letter uppercased. */
export function userDisplayInitial(name?: string): string {
  const trimmed = sanitizeUserNamePart(name ?? "");
  if (!trimmed) return "?";

  if (/[\u0E00-\u0E7F]/.test(trimmed)) {
    for (const ch of trimmed) {
      if (THAI_CONSONANT.test(ch)) return ch;
    }
    const thai = [...trimmed].find((ch) => /[\u0E00-\u0E7F]/.test(ch));
    if (thai) return thai;
  }

  const ch = trimmed.charAt(0);
  return /[a-z]/i.test(ch) ? ch.toUpperCase() : ch;
}
