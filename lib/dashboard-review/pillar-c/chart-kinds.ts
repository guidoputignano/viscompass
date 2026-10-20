/** Chart vocabulary and the change-bridge waterfall, shared by the reviewer and the organisation-scoped workspaces.
 * Kept apart from insight-charts.ts, which builds charts from workbook tables through insights.ts (reviewer-only:
 * it carries the reviewer labels), so that the scoped workspace's bundle reaches neither. insight-charts.ts
 * re-exports everything here for the reviewer path. Pure: no figure, no organisation key. */
import { cMoneyDifference, type CBridge } from '@/lib/dashboard-review/pillar-c/review';

export type CInsightChart = 'dot' | 'paired' | 'matrix' | 'interval' | 'scatter' | 'line' | 'area' | 'bar';
export const C_INSIGHT_CHARTS: Record<CInsightChart, { label: string; description: string }> = {
  dot: { label: 'Profilo a punti', description: 'Confronta le categorie su una scala comune, senza sommarle.' },
  paired: { label: 'Confronto collegato', description: 'Due indicatori della stessa unità, collegati solo all’interno della stessa voce.' },
  matrix: { label: 'Mappa di calore', description: 'Ogni cella conserva il proprio valore. Nessuna somma o percentuale aggiunta.' },
  interval: { label: 'Punti e intervalli', description: 'Punto e limiti già presenti nella fonte. Il significato dell’intervallo resta quello dell’analisi.' },
  scatter: { label: 'Relazione fra indicatori', description: 'Una voce per punto, due assi distinti. L’associazione non dimostra un rapporto causale.' },
  line: { label: 'Andamento', description: 'Sequenza temporale; un valore assente interrompe la linea.' },
  area: { label: 'Area temporale', description: 'Valori nel tempo, senza somma cumulata né interpolazione dei dati assenti.' },
  bar: { label: 'Barre', description: 'Valori con segno, a partire dallo zero.' },
};
export type CInsightPoint = { sourceRow: number; name: string; values: Record<number, { value: number | null; exact: string }> };
export type CInsightInterval = { low: number; high: number; label: string };

/** Decimal endpoints reconcile exactly; floating point is used only for drawing. */
export function cInsightWaterfall(opening: string, closing: string, components: Pick<CBridge, 'component' | 'value'>[]) {
  if (components.length !== 4 || new Set(components.map(c => c.component)).size !== 4) return [];
  let running = opening;
  const steps = components.map(c => {
    const start = running;
    running = cMoneyDifference(running, cMoneyDifference('0', c.value));
    return { id: c.component, start, end: running, value: c.value, total: false };
  });
  if (cMoneyDifference(running, closing) !== '0') return [];
  return [{ id: 'opening', start: '0', end: opening, value: opening, total: true }, ...steps,
    { id: 'closing', start: '0', end: closing, value: closing, total: true }];
}
