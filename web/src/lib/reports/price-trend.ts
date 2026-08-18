type PriceIntakePoint = {
  itemCode: string;
  date: string;
  unitPrice: number;
  mainUnit: string;
};

function dominantUnit(points: PriceIntakePoint[]): string {
  const counts = new Map<string, number>();
  for (const p of points) {
    if (p.unitPrice <= 0) continue;
    const u = p.mainUnit.trim() || "—";
    counts.set(u, (counts.get(u) ?? 0) + 1);
  }
  let best = "—";
  let bestN = -1;
  for (const [u, n] of counts) {
    if (n > bestN) {
      best = u;
      bestN = n;
    }
  }
  return best;
}

function unitPricesForDominantUnit(points: PriceIntakePoint[]): number[] {
  const unit = dominantUnit(points);
  return points
    .filter((p) => p.unitPrice > 0 && (p.mainUnit.trim() || "—") === unit)
    .map((p) => p.unitPrice);
}

/** Relative price range (max − min) / mean — higher means more volatile. */
export function priceVolatilityScore(prices: number[]): number {
  if (prices.length < 2) return 0;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const mean = prices.reduce((sum, value) => sum + value, 0) / prices.length;
  if (mean <= 0) return 0;
  return (max - min) / mean;
}

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

/** Item codes with the widest relative unit-price swings in the selected period. */
export function pickMostVolatileItemCodes(points: PriceIntakePoint[], limit = 5): string[] {
  const grouped = new Map<string, PriceIntakePoint[]>();
  for (const p of points) {
    if (p.unitPrice <= 0) continue;
    const code = p.itemCode.trim();
    if (!code) continue;
    const list = grouped.get(code) ?? [];
    list.push(p);
    grouped.set(code, list);
  }

  const ranked: { code: string; score: number; latestDate: string }[] = [];
  for (const [code, itemPoints] of grouped) {
    const prices = unitPricesForDominantUnit(itemPoints);
    const score = priceVolatilityScore(prices);
    if (score <= 0) continue;
    const latestDate = itemPoints.reduce(
      (max, point) => (point.date > max ? point.date : max),
      itemPoints[0]!.date
    );
    ranked.push({ code, score, latestDate });
  }

  ranked.sort(
    (a, b) =>
      b.score - a.score ||
      b.latestDate.localeCompare(a.latestDate) ||
      a.code.localeCompare(b.code)
  );

  const picked = ranked.slice(0, Math.max(0, limit)).map((row) => row.code);
  if (picked.length >= limit) return picked;

  const exclude = new Set(picked);
  const fallback = pickLatestReceivedItemCodes(points, limit).filter((code) => !exclude.has(code));
  return [...picked, ...fallback].slice(0, Math.max(0, limit));
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
