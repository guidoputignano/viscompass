// Deliberately tiny invented amounts. No workbook/source/organization result.
export function cReviewFixture() {
  const orgs = ['AQ', 'CH', 'PE', 'TE'], channels = ['CO', 'DD', 'DPC'];
  const monthly = [];
  for (const year of [2024, 2025, 2026]) for (let month = 1; month <= (year === 2026 ? 5 : 12); month++) for (const [oi, org] of orgs.entries()) for (const [ci, channel] of channels.entries()) {
    const net = channel === 'CO' && month === 2 ? -5 : month + oi + ci + (year - 2024) * 10;
    monthly.push({year, month, org, channel, rows: 1, net: String(net), positive: String(Math.max(net, 0)), negative: String(Math.min(net, 0))});
  }
  const baseline = [];
  for (const period of ['FY2024', 'FY2025', 'JM2025', 'JM2026']) for (const org of [...orgs, 'Regione']) for (const channel of [...channels, 'Tutti']) {
    const rows = monthly.filter(r => r.year === Number(period.slice(2)) && (org === 'Regione' || r.org === org) && (channel === 'Tutti' || r.channel === channel) && (!period.startsWith('JM') || r.month <= 5));
    baseline.push({period, org, channel, rows: rows.length, ...Object.fromEntries(['net', 'positive', 'negative'].map(f => [f, String(rows.reduce((s, r) => s + Number(r[f]), 0))]))});
  }
  const bridges = [];
  for (const comparison of ['K1', 'K2']) for (const org of [...orgs, 'Regione']) for (const channel of [...channels, 'Tutti']) {
    const [p0, p1] = comparison === 'K1' ? ['FY2024', 'FY2025'] : ['JM2025', 'JM2026'];
    const find = period => baseline.find(r => r.period === period && r.org === org && r.channel === channel);
    const delta = Number(find(p1).net) - Number(find(p0).net);
    for (const component of ['B-C', 'B-E', 'B-X', 'B-N']) bridges.push({comparison, org, channel, component, value: component === 'B-C' ? String(delta) : '0', cells: component === 'B-C' ? 12 : 0});
  }
  return {schema: 'pillar-c-review-v1', state: 'review_only', workbookSha256: 'a'.repeat(64), workbookVersion: 'TEST fixture not real', generatedAt: '2026-10-15T00:00:00Z', evidence: {financial: 'b'.repeat(64), budgetCount: 'c'.repeat(64)}, monthly, baseline, bridges,
    lineage: [
      {section: 'spend', outputIds: ['O-09-01', 'O-09-02', 'O-09-07'], claim: 'reported_spend', workbookRanges: ['F_Mesi!F2:J349'], checkedFields: ['net', 'rows'], receiptSha256: 'b'.repeat(64)},
      {section: 'change', outputIds: ['O-12-01', 'O-12-02'], claim: 'reported_spend', workbookRanges: ['10_Change_Contributions!A10:AA30'], checkedFields: ['value', 'cells'], receiptSha256: 'b'.repeat(64)},
      {section: 'budget', outputIds: ['ML-2-TE24', 'ML-2-FY2025', 'ML-2-JM2026'], claim: 'modelled_budget_allocation', workbookRanges: ['16B_ML2_Budget_Var!F212:S225'], checkedFields: ['budget', 'actual', 'alternative'], receiptSha256: 'c'.repeat(64)},
      {section: 'counts', outputIds: ['ML-3-CO-R', 'ML-3-CO-A', 'ML-3-SENS'], claim: 'modelled_count', workbookRanges: ['14B_ML3_Per_Patient!H332:P581'], checkedFields: ['persons', 'spend', 'perPerson'], receiptSha256: 'c'.repeat(64)},
    ].map(r => ({...r, numericState: 'scoped_pass', acceptance: 'pending', verification: 'implementation_separated_not_formal_v2', sourceHashes: ['d'.repeat(64)], methodHashes: ['e'.repeat(64)]})),
    budgets: [
      {id: 'TEST-PUBLISHED-ZERO', period: 'FY2024', org: 'TE', channel: 'CO', level: 'Dipartimento', area: '4000', basis: 'published', budget: '90', actual: '0', alternative: '5'},
      {id: 'TEST-MISSING-ACTUAL', period: 'FY2024', org: 'TE', channel: 'DD', level: 'Dipartimento', area: '2000', basis: 'published', budget: '50', actual: null, alternative: null},
      {id: 'TEST-SYNTHETIC', period: 'FY2025', org: 'AQ', channel: 'CO', level: 'Disciplina', area: '08', basis: 'synthetic', budget: '100', actual: '-10', alternative: '20'},
    ], counts: [
      {period: 'FY2025', org: 'AQ', portfolio: 'ONC', spend: '100', persons: '10', perPerson: '10', lowCountCost: '13.3333333333', highCountCost: '8', state: 'CALCOLATO'},
      {period: 'FY2025', org: 'Regione', portfolio: 'ONC', spend: '400', persons: '40', perPerson: '10', lowCountCost: '13.3333333333', highCountCost: '8', state: 'CALCOLATO'},
      {period: 'FY2025', org: 'Regione', portfolio: 'VAC', spend: '40', persons: null, perPerson: null, lowCountCost: null, highCountCost: null, state: 'NON_DISPONIBILE'},
    ]};
}

// The fixed label the parser requires verbatim (the binding regional-forecast label).
export const C_FORECAST_LABEL = 'Fonte pubblica · AIFA (CC BY 4.0) · previsione regionale, non aziendale';

// Invented tiny values for the regional-forecast section. Not a model output,
// not AIFA data, not any packet figure. Metrics are chosen so the registered
// conditions agree with each carried outcome.
function cForecastFixture() {
  const candidate = (name, metrics, failedConditions = []) => ({candidate: name, admitted: failedConditions.length === 0, failedConditions,
    mase: '0.5', maseThreshold: '0.9', maseRatio: '0.5', coverage80: '0.8', coverage95: '0.95', winkler80: '8', ...metrics});
  const variants = (ets, arima) => ['primaria', 'sensibilita_2020'].map(variant => ({variant, bestBaseline: 'stagionale_naive', maseBaseline: '1', winkler80Baseline: '10', candidates: [ets, arima]}));
  const admitted = (series, label, ets = candidate('ETS_AAA', {}), reasons = []) => ({series, label, decision: 'AMMESSA', model: 'ARIMA_011_011_12', registeredReasons: reasons, variants: variants(ets, candidate('ARIMA_011_011_12', {})), rejection: null});
  const seriesLabels = {TOT: 'Totale di prova', A: 'Classe A di prova', H: 'Classe H di prova', C: 'Classe C di prova'};
  const bases = {TOT: 100, A: 40, H: 50};
  const monthly = [], observed2025 = [], annual = [];
  for (const series of ['TOT', 'A', 'H']) {
    let sum = 0;
    for (let m = 1; m <= 12; m++) {
      // Integer cents. A carries one cent a month, so its annual total exercises the documented rounding tolerance.
      const cents = (bases[series] + m) * 100 + (series === 'A' ? 1 : 0), point = cents / 100;
      sum += cents;
      monthly.push({series, month: `2026-${String(m).padStart(2, '0')}`, point: point.toFixed(2), low80: (point - 2).toFixed(2), high80: (point + 2).toFixed(2), low95: (point - 4).toFixed(2), high95: (point + 4).toFixed(2), sigma: '1.5'});
      const missing = series === 'H' && m === 3;
      observed2025.push({series, month: `2025-${String(m).padStart(2, '0')}`, value: missing ? null : String(bases[series] - 10 + m), rowsSource: missing ? 2 : 3, rowsValued: missing ? 0 : 3, rowsMissing: missing ? 2 : 0, blankShareFlagged: series === 'A' && m === 1});
    }
    const exact = (sum / 100).toFixed(2), total = series === 'A' ? ((sum + 2) / 100).toFixed(2) : exact;
    annual.push({series, total, low80: (Number(total) - 10).toFixed(2), high80: (Number(total) + 10).toFixed(2), low95: (Number(total) - 20).toFixed(2), high95: (Number(total) + 20).toFixed(2), sigma: '7.5', monthlyPointsSum: exact});
  }
  return {
    region: 'Abruzzo', scope: 'regional_public_forecast',
    labels: {
      forecast: C_FORECAST_LABEL, observed: 'Serie osservata di prova', tier: 'Fonte pubblica', tierState: 'V2_IN_ATTESA',
      base: 'Base di prova', method: 'Metodo di prova', note: 'Nota di prova', reading: 'Lettura di prova', caveats: 'Limiti di prova',
      observedNote: 'Nota osservata di prova', annualType: 'Totale annuo di prova', licence: 'CC BY 4.0', attribution: 'Attribuzione di prova',
      seriesLabels, models: {ARIMA_011_011_12: 'ARIMA di prova', ETS_AAA: 'ETS di prova'},
      variants: {primaria: 'variante primaria', sensibilita_2020: 'sensibilità di prova'},
      conditions: {a_origini: 'origini', b_mase: 'MASE', c_copertura80: 'copertura 80', d_winkler: 'Winkler', e_nessuna_stima_trattenuta: 'nessuna stima trattenuta'},
      amendments: ['ML-A15', 'ML-A17'],
    },
    admission: [
      admitted('TOT', seriesLabels.TOT),
      admitted('A', seriesLabels.A),
      admitted('H', seriesLabels.H, candidate('ETS_AAA', {coverage80: '0.6'}, ['c_copertura80']), ['ETS di prova: copertura non superata']),
      {series: 'C', label: seriesLabels.C, decision: 'RIFIUTATA', model: null, registeredReasons: ['Entrambi i candidati di prova non superano MASE'],
        variants: variants(candidate('ETS_AAA', {mase: '1.3', maseRatio: '1.3', winkler80: '12'}, ['b_mase', 'd_winkler']), candidate('ARIMA_011_011_12', {mase: '1.2', maseRatio: '1.2'}, ['b_mase'])),
        rejection: {reason: 'Motivo di prova del rifiuto', fallback: 'Esito di prova senza previsione'}},
    ],
    monthly, annual, observed2025,
  };
}

/** v2 envelope: the v1 sections unchanged, plus the forecast section, its lineage row and the new evidence pins. */
export function cReviewV2Fixture() {
  const p = cReviewFixture();
  p.schema = 'pillar-c-review-v2';
  Object.assign(p.evidence, {financialR5Review: '1'.repeat(64), budgetCountR5Review: '2'.repeat(64), forecast: 'f'.repeat(64), forecastInputs: '3'.repeat(64), forecastWorkbookIntegration: '4'.repeat(64)});
  for (const row of p.lineage) Object.assign(row, {crossSystemReceiptSha256: row.receiptSha256 === 'b'.repeat(64) ? '1'.repeat(64) : '2'.repeat(64), workbookSha256: p.workbookSha256});
  p.lineage.push({section: 'forecast', numericState: 'cross_system_pass', acceptance: 'pending', verification: 'cross_system_codex_v2', outputIds: ['ML-5-ADM', 'ML-5-FC'],
    workbookRanges: ['18A_ML5_Forecast!A16:L20', '18A_ML5_Forecast!A26:Q43'], checkedFields: ['admission_decision', 'monthly_point', 'class_C_withheld'], claim: 'regional_public_forecast',
    receiptSha256: 'f'.repeat(64), sourceHashes: ['d'.repeat(64)], methodHashes: ['e'.repeat(64)], crossSystemReceiptSha256: '4'.repeat(64), workbookSha256: p.workbookSha256});
  p.forecast = cForecastFixture();
  return p;
}
