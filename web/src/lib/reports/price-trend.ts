/** Most recently received item codes (by latest txn date), newest first. */
export function pickLatestReceivedItemCodes(
  points: { itemCode: string; date: string }[],
  limit = 5
): string[] {
  const latestByItem = new Map<string, string>();
  for (const p of points) {
    const code = p.itemCode.trim();
    if (!code) continue;
    const prev = latestByItem.get(code);
    if (!prev || p.date > prev) latestByItem.set(code, p.date);
  }
  return [...latestByItem.entries()]
    .sort((a, b) => b[1].localeCompare(a[1]) || a[0].localeCompare(b[0]))
    .slice(0, Math.max(0, limit))
    .map(([code]) => code);
}

/** Cluster intake points by similar order quantity for comparable unit-price trends. */
export function groupPointsBySimilarQty<T extends { qty: number; date: string; mainUnit?: string }>(
  points: T[]
): { label: string; points: T[] }[] {
  if (!points.length) return [];
  const sorted = [...points].sort((a, b) => a.qty - b.qty);
  const groups: T[][] = [];
  let current: T[] = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prevQty = sorted[i - 1].qty;
    const curQty = sorted[i].qty;
    const ratio = prevQty > 0 ? curQty / prevQty : Infinity;
    const startsNewGroup = ratio > 1.4 && curQty - prevQty > Math.max(prevQty * 0.4, 0.5);
    if (startsNewGroup) {
      groups.push(current);
      current = [sorted[i]];
    } else {
      current.push(sorted[i]);
    }
  }
  groups.push(current);

  return groups.map((g) => {
    const qtys = g.map((p) => p.qty);
    const min = Math.min(...qtys);
    const max = Math.max(...qtys);
    const unit = (g[0]?.mainUnit || "").trim();
    const qtyLabel =
      min === max ? formatQty(min) : `${formatQty(min)}–${formatQty(max)}`;
    const label = unit ? `${qtyLabel} ${unit}` : qtyLabel;
    return { label, points: [...g].sort((a, b) => a.date.localeCompare(b.date)) };
  });
}

function formatQty(n: number): string {
  if (!Number.isFinite(n)) return "0";
  const rounded = Math.round(n * 1000) / 1000;
  if (Math.abs(rounded - Math.round(rounded)) < 1e-9) return String(Math.round(rounded));
  return String(rounded);
}
