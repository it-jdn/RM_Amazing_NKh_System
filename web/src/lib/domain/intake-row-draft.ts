export type IntakeRowVals = Record<string, { qty: string; total: string }>;

const EMPTY_ROW = { qty: "", total: "" };

function normRow(v: { qty: string; total: string } | undefined) {
  const r = v ?? EMPTY_ROW;
  return {
    qty: r.qty.trim(),
    total: r.total.trim(),
  };
}

/** มีการกรอกหรือแก้ไขค่าในฟอร์มเมื่อเทียบกับ baseline ที่โหลด/บันทึกล่าสุด */
export function isIntakeRowValsDirty(current: IntakeRowVals, baseline: IntakeRowVals): boolean {
  const keys = new Set([...Object.keys(current), ...Object.keys(baseline)]);
  for (const code of keys) {
    const a = normRow(current[code]);
    const b = normRow(baseline[code]);
    if (a.qty !== b.qty || a.total !== b.total) return true;
  }
  return false;
}

export function hasIntakeRowInput(vals: IntakeRowVals): boolean {
  for (const code of Object.keys(vals)) {
    const r = normRow(vals[code]);
    if (r.qty || r.total) return true;
  }
  return false;
}

export function cloneIntakeRowVals(vals: IntakeRowVals): IntakeRowVals {
  const out: IntakeRowVals = {};
  for (const [code, row] of Object.entries(vals)) {
    out[code] = { qty: row.qty, total: row.total };
  }
  return out;
}
