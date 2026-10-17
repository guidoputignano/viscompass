import { cWorkbookComparableColumns, cWorkbookLabel, cWorkbookLabelColumn, cWorkbookMetricUnits, cWorkbookNumber, cWorkbookRaw, type CWorkbookTable, type cWorkbookRows } from '@/lib/dashboard-review/pillar-c/workbook';
import { cInsightRowName } from '@/lib/dashboard-review/pillar-c/insights';
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
type Rows = ReturnType<typeof cWorkbookRows>;
export type CInsightInterval = { low: number; high: number; label: string };

export function cInsightPreferredMetric(table: CWorkbookTable, output: string, visible: number[]) {
  const preferred = output === 'ML-3-SENS' ? /^€\/paziente: base$/ : output.startsWith('ML-4') ? /Quantità.*Shapley/i : output === 'O-14-03' ? /D std \(pp/i : /€|quota|copertura|pendenza|variaz/i;
  return table.numericColumns.find(c => visible.includes(c) && preferred.test(table.columns[c])) ?? table.numericColumns.find(c => visible.includes(c)) ?? -1;
}

/** Row-preserving display adapter: never aggregate, impute, normalize or round raw values. */
export function cInsightPoints(table: CWorkbookTable, rows: Rows, formats: Record<string, string>, columns = table.numericColumns): CInsightPoint[] {
  const label = cInsightCanTrend(table, rows) ? timeColumn(table) : cWorkbookLabelColumn(table);
  return rows.map(({ cells, sourceRow }) => ({
    sourceRow,
    name: cInsightRowName(table, cells, cWorkbookLabel(cells[label], formats, table.columns[label]) || `Voce ${sourceRow}`),
    values: Object.fromEntries(columns.filter(c => table.numericColumns.includes(c)).map(c => [c, { value: cWorkbookNumber(cells[c]), exact: cWorkbookLabel(cells[c], formats, table.columns[c]) }])),
  }));
}

export function cInsightComparable(table: CWorkbookTable, rows: Rows, formats: Record<string, string>, metric: number, visible: number[]) {
  const cells = rows.map(r => r.cells), unit = cWorkbookMetricUnits(table, metric, formats, cells);
  if (unit.length !== 1) return [];
  return cWorkbookComparableColumns(table, metric, formats, cells).filter(c => visible.includes(c) && cWorkbookMetricUnits(table, c, formats, cells)[0] === unit[0]);
}

function periodFamily(h: string) {
  return h.toLowerCase().replace(/(?:anno\s+)?20\d{2}(?:\s*\(12 mesi\))?/g, 'YEAR').replace(/\s+/g, ' ').trim();
}
export function cInsightMatrixColumns(table: CWorkbookTable, metric: number, comparable: number[], output: string) {
  const family = periodFamily(table.columns[metric] ?? '');
  const peers = comparable.filter(c => periodFamily(table.columns[c]) === family ||
    (/^ML-4/.test(output) && /Shapley/.test(table.columns[metric]) && /Shapley/.test(table.columns[c])));
  return [metric, ...peers].slice(0, 6);
}
export function cInsightPreferredComparison(table: CWorkbookTable, metric: number, comparable: number[]) {
  // Full years never default to a five-month comparison, even though both use euros.
  return comparable.find(c => periodFamily(table.columns[c]) === periodFamily(table.columns[metric])) ?? -1;
}

/** Recognized source contracts only. Merely having two numbers does not make an interval. */
export function cInsightIntervals(table: CWorkbookTable, metric: number, comparable: number[], output: string): CInsightInterval[] {
  const h = table.columns[metric] ?? '', allowed = new Set(comparable), result: CInsightInterval[] = [];
  const pair = (low: string, high: string, label: string) => {
    const l = table.columns.indexOf(low), r = table.columns.indexOf(high);
    if (allowed.has(l) && allowed.has(r)) result.push({ low: l, high: r, label });
  };
  if (/^O-10-05$/.test(output) && / · F \(S2\) \(€\)$/.test(h)) {
    for (const n of [1, 2]) pair(h.replace(/F \(S2\)/, `LB${n}`), h.replace(/F \(S2\)/, `UB${n}`), `Ipotesi ${n}`);
  }
  if (/^O-14-03$/.test(output) && /^D std \(pp/.test(h)) pair('D min (pp)', 'D max (pp)', 'Sensibilità al mix');
  if (output === 'O-17-05' && h === 'Pendenza (€/mese)') pair('Intervallo di variabilità 95 %: inf. (€/mese)', 'Intervallo di variabilità 95 %: sup. (€/mese)', 'Variabilità al 95 %');
  if (/^ML-1/.test(output) && /: puntuale \(€\)$/.test(h)) pair(h.replace(': puntuale', ': minimo'), h.replace(': puntuale', ': massimo'), 'Sensibilità alla chiave');
  if (output === 'ML-2-TE24' && h === 'Consuntivo ML-1 puntuale (€)') pair('Consuntivo minimo (€)', 'Consuntivo massimo (€)', 'Sensibilità alla chiave');
  if (output === 'ML-3-SENS' && h === '€/paziente: base') pair('€/paziente: numerosità 1,25x', '€/paziente: numerosità 0,75x', 'Sensibilità della numerosità');
  if (output === 'ML-5-FC' && /: previsione \(€\)$/.test(h)) {
    for (const n of [80, 95]) pair(h.replace('previsione', `${n} % inf.`), h.replace('previsione', `${n} % sup.`), `Previsione al ${n} %`);
  }
  return result;
}

/** Lines are allowed only for one unambiguous, ordered time series. */
function timeColumn(table: CWorkbookTable) {
  return table.columns.findIndex(h => /^(?:anno|mese|periodo|data)(?:\s|$)/i.test(h));
}
export function cInsightCanTrend(table: CWorkbookTable, rows: Rows) {
  const label = timeColumn(table), heading = table.columns[label] ?? '';
  if (!/^(?:anno|mese|periodo|data)(?:\s|$)/i.test(heading) || rows.length < 2) return false;
  if (table.columns.some((h, c) => c !== label && /^(?:azienda|canale|classe|serie|ambito|confronto)(?:\s|$)/i.test(h) && new Set(rows.map(r => cWorkbookRaw(r.cells[c]))).size > 1)) return false;
  const keys = rows.map(r => cWorkbookRaw(r.cells[label]));
  if (new Set(keys).size !== keys.length) return false;
  // Do not turn an arbitrary list of categorical period labels into a time series.
  const time = keys.map(k => /^\d{4}(?:-\d{2}(?:-\d{2})?)?$/.test(k) ? Number(k.replaceAll('-', '')) : null);
  if (!time.every((v, i) => v !== null && (i === 0 || v > time[i - 1]!))) return false;
  const grain = keys[0].length;
  if (!keys.every(k => k.length === grain)) return false;
  const ordinals = keys.map(k => grain === 4 ? Number(k) : grain === 7 ? Number(k.slice(0, 4)) * 12 + Number(k.slice(5, 7)) - 1 : Date.parse(`${k}T00:00:00Z`) / 86_400_000);
  return ordinals.every((v, i) => Number.isFinite(v) && (i === 0 || v === ordinals[i - 1] + 1));
}

export function cInsightChartOptions({ table, rows, formats, metric, visible, output }: { table: CWorkbookTable; rows: Rows; formats: Record<string, string>; metric: number; visible: number[]; output: string }) {
  if (!table.numericColumns.includes(metric) || cWorkbookMetricUnits(table, metric, formats, rows.map(r => r.cells)).length !== 1) return [];
  const options: CInsightChart[] = ['dot', 'bar'];
  const comparable = cInsightComparable(table, rows, formats, metric, visible);
  if (comparable.some(c => rows.some(r => cWorkbookNumber(r.cells[c]) !== null && cWorkbookNumber(r.cells[metric]) !== null))) options.push('paired');
  if (cInsightMatrixColumns(table, metric, comparable, output).length > 1) options.push('matrix');
  if (cInsightIntervals(table, metric, comparable, output).some(b => rows.some(r => {
    const lo = cWorkbookNumber(r.cells[b.low]), hi = cWorkbookNumber(r.cells[b.high]), value = cWorkbookNumber(r.cells[metric]);
    return lo != null && hi != null && value != null && lo <= value && value <= hi;
  }))) options.push('interval');
  if (visible.some(c => c !== metric && table.numericColumns.includes(c) && cWorkbookMetricUnits(table, c, formats, rows.map(r => r.cells)).length === 1 && rows.filter(r => cWorkbookNumber(r.cells[c]) !== null && cWorkbookNumber(r.cells[metric]) !== null).length >= 2)) options.push('scatter');
  if (cInsightCanTrend(table, rows)) options.push('line', 'area');
  return options;
}

export function cInsightDefaultChart(options: CInsightChart[], section: string) {
  if (options.includes('interval')) return 'interval';
  if (options.includes('line')) return 'line';
  if (options.includes('matrix') && /^(composizione|attribuzione|costi|sensibilita|spesa)$/.test(section)) return 'matrix';
  if (options.includes('paired') && /^(confronti|pianificazione|previsione)$/.test(section)) return 'paired';
  return options[0] ?? 'dot';
}

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
