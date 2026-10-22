// Isolated fictional fixture for tests/pillar-c-six-sections.test.mjs (docs/PILLAR_C_SIX_SECTIONS_20261022.md §6 and §7):
// invented months with a null (an absent month), a zero and a negative; invented budget areas; invented decision
// values derived from those months. Never a real figure, organisation name, place or province key. It starts from the
// invented scoped bucket of tests/fixtures/pillar-c-scoped.mjs and changes one unit's CO months only; every baseline
// and bridge row of that unit is re-derived, so the closed scoped parser accepts the file.
import {ASL_UNITS,scopedFixture} from './pillar-c-scoped.mjs';

/** The unit whose CO months carry the three edge values, and the months (FY2025) that carry them. */
export const EDGE_UNIT='asl-4';
export const EDGE_MONTHS={negative:2,absent:3,zero:4};
const PERIODS=['FY2024','FY2025','JM2025','JM2026'],LOCAL=['CO','DD','DPC'];

function rederive(file){
  file.baseline=[];
  for(const period of PERIODS)for(const channel of [...LOCAL,'Tutti']){
    const rows=file.monthly.filter(r=>r.year===Number(period.slice(2))&&(channel==='Tutti'||r.channel===channel)&&(!period.startsWith('JM')||r.month<=5));
    file.baseline.push({period,org:file.unit,channel,rows:rows.reduce((s,r)=>s+r.rows,0),...Object.fromEntries(['net','positive','negative'].map(k=>[k,String(rows.reduce((s,r)=>s+Number(r[k]),0))]))});
  }
  file.bridges=[];
  for(const comparison of ['K1','K2'])for(const channel of [...LOCAL,'Tutti']){
    const [p0,p1]=comparison==='K1'?['FY2024','FY2025']:['JM2025','JM2026'];
    const find=p=>file.baseline.find(r=>r.period===p&&r.channel===channel);
    const delta=Number(find(p1).net)-Number(find(p0).net);
    for(const component of ['B-C','B-E','B-X','B-N'])file.bridges.push({comparison,org:file.unit,channel,component,value:component==='B-C'?String(delta):'0',cells:component==='B-C'?12:0});
  }
  return file;
}

/** The aggregate's explicit monthly rows: the exact sum of the four units per (year, month, channel), as the closed
 * merge checks for a reader of all five units (scoped-review.ts checkCScopedAggregate). */
function aggregateOf(reviews){
  const cells=new Map();
  for(const unit of ASL_UNITS)for(const r of reviews[unit].monthly){
    const key=`${r.year}|${r.month}|${r.channel}`,c=cells.get(key)??{year:r.year,month:r.month,org:'aggregato',channel:r.channel,rows:0,net:0,positive:0,negative:0};
    c.rows+=r.rows;c.net+=Number(r.net);c.positive+=Number(r.positive);c.negative+=Number(r.negative);cells.set(key,c);
  }
  return [...cells.values()].map(c=>({...c,net:String(c.net),positive:String(c.positive),negative:String(c.negative)}));
}

/** The scoped review files, one per unit: the base bucket's, with EDGE_UNIT's 2025 CO months changed (February stays
 * the base fixture's negative month, March is absent, April is zero) and the aggregate re-summed; every baseline and
 * bridge of the two changed files is re-derived. The invented budget areas 4000 and 2000 of the base bucket stay. */
export function sixSectionsReviews(){
  const reviews=structuredClone(scopedFixture().reviews),file=reviews[EDGE_UNIT];
  const co2025=r=>r.year===2025&&r.channel==='CO';
  file.monthly=file.monthly.filter(r=>!(co2025(r)&&r.month===EDGE_MONTHS.absent));
  for(const r of file.monthly)if(co2025(r)&&r.month===EDGE_MONTHS.zero){r.net='0';r.positive='0';r.negative='0';}
  if(!file.monthly.some(r=>co2025(r)&&r.month===EDGE_MONTHS.negative&&Number(r.net)<0))throw Error('fixture: the negative month is gone');
  rederive(file);
  reviews.aggregato.monthly=aggregateOf(reviews);
  rederive(reviews.aggregato);
  return reviews;
}
