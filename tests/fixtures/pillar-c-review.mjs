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
