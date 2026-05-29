export type ItemCumulativeRow = {
  date: string;
  itemCode: string;
  totalPrice: number;
};

export type ItemCumulativeSeries = {
  itemCode: string;
  values: number[];
};

/** Daily spend per item, then cumulative total over sorted dates in range. */
export function buildItemCumulativeChart(
  rows: ItemCumulativeRow[],
  itemCodes: string[]
): { labels: string[]; series: ItemCumulativeSeries[] } {
  if (!itemCodes.length) {
    return { labels: [], series: [] };
  }

  const codeSet = new Set(itemCodes);
  const datesSet = new Set<string>();
  const daily = new Map<string, Map<string, number>>();

  for (const code of itemCodes) {
    daily.set(code, new Map());
  }

  for (const r of rows) {
    if (!codeSet.has(r.itemCode)) continue;
    datesSet.add(r.date);
    const byDate = daily.get(r.itemCode)!;
    byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.totalPrice);
  }

  const labels = [...datesSet].sort();

  const series = itemCodes.map((code) => {
    const byDate = daily.get(code)!;
    let cumulative = 0;
    const values = labels.map((d) => {
      cumulative += byDate.get(d) ?? 0;
      return cumulative;
    });
    return { itemCode: code, values };
  });

  return { labels, series };
}
