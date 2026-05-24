/** Format convert rate for display (e.g. 2, 3.5). */
export function formatConvertRateValue(convertRate: number): string {
  const n = Number(convertRate);
  if (!Number.isFinite(n) || n <= 0) return "1";
  const rounded = Math.round(n * 1000) / 1000;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) {
    return String(Math.round(rounded));
  }
  return String(rounded);
}

/** Params for intake.unitConversion i18n: "1 {main} = {rate} {sub}". */
export function unitConversionMessageParams(
  mainUnit: string,
  subUnit: string,
  convertRate: number
): { main: string; rate: string; sub: string } {
  const main = mainUnit.trim() || "—";
  const sub = subUnit.trim() || main;
  const rate = formatConvertRateValue(convertRate);
  return { main, rate, sub };
}
