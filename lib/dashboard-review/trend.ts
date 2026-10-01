export interface TrendDatum { label: string; spend_eur: number }
export interface IndexedTrendDatum extends TrendDatum { index: number; change: number | null }

export function indexSpendTrend(points: TrendDatum[]): IndexedTrendDatum[] {
  const baseline = points.find((point) => point.spend_eur > 0)?.spend_eur ?? 0;
  return points.map((point, index) => ({
    ...point,
    index: baseline > 0 ? (point.spend_eur / baseline) * 100 : 100,
    change: index > 0 && points[index - 1].spend_eur !== 0
      ? (point.spend_eur - points[index - 1].spend_eur) / points[index - 1].spend_eur
      : null,
  }));
}

export function latestComparison(points: TrendDatum[]): { current: string; previous: string; change: number } | null {
  if (points.length < 2) return null;
  const current = points[points.length - 1];
  const previous = points[points.length - 2];
  if (previous.spend_eur === 0) return null;
  return { current: current.label, previous: previous.label, change: (current.spend_eur - previous.spend_eur) / previous.spend_eur };
}
