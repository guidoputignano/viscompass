export const COMBINED_REGION = '040';
export const COMBINED_REGION_NAME = 'Trentino-Alto Adige';
type RankingRow = { region:string; year:number; group:string; channel:string; spend:number|null; packs:number|null; population:number|null; perResident:number|null; missingSpendCells:number; missingPackCells:number; months:number; spendYoy:number|null };

/** Input must be one year, family and channel. Preserve the two AIFA source units. */
export function regionalRankingRows<T extends RankingRow>(rows:T[]):T[] {
  const keys = new Set(rows.map(r => `${r.year}/${r.group}/${r.channel}`));
  if (keys.size > 1) throw Error('Regional ranking requires a single reporting scope');
  if (new Set(rows.map(r => r.region)).size !== rows.length) throw Error('Duplicate ranking territory');
  if (rows.some(r => r.region === COMBINED_REGION)) throw Error('Region already aggregated');
  const provinces = rows.filter(r => r.region === '041' || r.region === '042');
  if (!provinces.length) return [...rows];
  const sum = (key:'spend'|'packs'|'population') => provinces.length === 2 && provinces.every(r => r[key] !== null && Number.isFinite(r[key]))
    ? provinces.reduce((s,r) => s + r[key]!, 0) : null;
  const spend = sum('spend'), population = sum('population');
  const combined = {...provinces[0], region:COMBINED_REGION, spend, packs:sum('packs'), population,
    perResident:spend !== null && population !== null && population > 0 ? spend / population : null,
    spendYoy:null, months:Math.min(...provinces.map(r => r.months)),
    missingSpendCells:provinces.reduce((s,r) => s + r.missingSpendCells, 0),
    missingPackCells:provinces.reduce((s,r) => s + r.missingPackCells, 0)};
  return [...rows.filter(r => r.region !== '041' && r.region !== '042'), combined];
}
