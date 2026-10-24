// Synthetic Pillar C additions objects (build add-v1 shape: P8-03 residence, P10-04 narrowing by area, P10-05 File F
// fields), serialised as the private build writes them (compact JSON and a trailing newline), with the pins a test
// installs in place of additions-storage.ts. Invented counts, shares and amounts only: no figure of any organisation, and
// a hidden-cell pattern of its own (ASL 2 and ASL 4 × NEF and PNE), unrelated to any delivered table.
import {createHash} from 'node:crypto';

export const ADD_UNITS=['aggregato','asl-1','asl-2','asl-3','asl-4'];
export const ADD_ASL=['asl-1','asl-2','asl-3','asl-4'];
export const AREAS=['CV','END','GAS','NEF','PNE','REU'];
export const CLASSES=['consistent','inconsistent','rare','all_drug','non_clinical','none'];
export const HIDDEN='suppressed';
export const sha256=b=>createHash('sha256').update(b).digest('hex');
const r3=v=>Math.round(v*1000)/1000, r4=v=>Math.round(v*10000)/10000;

/** Per ASL: eligible recipients, residence counts, narrowed recipients and spend share, area cells (null = hidden; the
 * synthetic hidden value is kept apart, only to build the aggregate), area shares of the narrowed spend. */
const ASL={
  'asl-1':{eligible:1000,residence:[900,60,40,0],total:300,share:0.25,areas:[120,60,50,30,25,40],narrowed:[0.4,0.15,0.15,0.1,0.1,0.1]},
  'asl-2':{eligible:1200,residence:[1100,70,30,0],total:360,share:0.2,areas:[150,70,60,null,null,50],hiddenValues:[0,0,0,3,4,0],narrowed:[0.45,0.15,0.15,null,null,0.15]},
  'asl-3':{eligible:1500,residence:[1400,60,40,0],total:450,share:0.3,areas:[180,90,80,45,35,60],narrowed:[0.4,0.2,0.1,0.1,0.1,0.1]},
  'asl-4':{eligible:800,residence:[720,50,30,0],total:240,share:0.15,areas:[100,40,35,null,null,30],hiddenValues:[0,0,0,2,6,0],narrowed:[0.5,0.2,0.1,null,null,0.1]},
};
const CLASS_FRACTIONS=[0.35,0.05,0.02,0.1,0.4,0.3], CLASS_SHARES=[0.3,0.05,0.02,0.08,0.15,0.4];
const RESIDENCE_KEYS=['sameAsl','otherAslInRegion','outsideRegion','unknown'];

function residence(unit,eligible,counts){
  return {period:'2026-01',channel:'DPC',recipientsAreSum:unit==='aggregato',eligible,...Object.fromEntries(RESIDENCE_KEYS.map((k,i)=>[k,{count:counts[i],share:r3(eligible?counts[i]/eligible:0)}]))};
}
function narrowing(unit,eligible,total,share,areas,narrowed,classes){
  return {period:'2026-01',channel:'DPC',recipientsAreSum:unit==='aggregato',domainReviewPending:true,eligibleRecipients:eligible,
    narrowed:{total:{recipients:total,shareOfEligibleSpend:share},byArea:Object.fromEntries(AREAS.map((a,i)=>[a,areas[i]===null?HIDDEN:{recipients:areas[i],shareOfNarrowedSpend:narrowed[i],shareOfEligibleSpend:r4(narrowed[i]*share)}]))},
    lineClasses:Object.fromEntries(CLASSES.map((c,i)=>[c,{recipients:classes[i],shareOfEligibleSpend:CLASS_SHARES[i]}]))};
}
const classCounts=eligible=>CLASS_FRACTIONS.map(f=>Math.round(f*eligible));

/** The File F 2025 inventory of asl-3: 17 categories, each group partitioning the same rows and amount. */
export function fileFFields(){
  const cells={all:[10000,'5000000.00'],'prescriber:present':[8000,'4000000.00'],'prescriber:blank':[2000,'1000000.00'],'sdo:present':[500,'800000.00'],'sdo:blank':[9500,'4200000.00'],
    'mode:01':[100,'10000.00'],'mode:02':[200,'50000.00'],'mode:03':[3000,'3000000.00'],'mode:04':[400,'20000.00'],'mode:05':[500,'30000.00'],'mode:06':[5000,'1000000.00'],'mode:07':[50,'90000.00'],'mode:08':[700,'600000.00'],'mode:09':[50,'200000.00'],
    'ticket:00':[1500,'900000.00'],'ticket:01':[6000,'3500000.00'],'ticket:02':[2500,'600000.00']};
  const cents=s=>Math.round(Number(s)*100),all=cells.all;
  return {scope:{period:'2025',organisationUnit:'asl-3',countedUnit:'rows'},
    categories:Object.fromEntries(Object.entries(cells).map(([k,[rows,amount]])=>[k,{rows,amountEUR:amount,rowShare:r4(rows/all[0]),amountShare:r4(cents(amount)/cents(all[1]))}]))};
}

/** One unit's entry (unit, residence, narrowing, fileFFields). */
export function addEntry(unit){
  if(unit==='aggregato'){
    const sumOf=f=>ADD_ASL.reduce((s,u)=>s+f(ASL[u]),0);
    const eligible=sumOf(a=>a.eligible),counts=RESIDENCE_KEYS.map((_,i)=>sumOf(a=>a.residence[i]));
    const areas=AREAS.map((_,i)=>sumOf(a=>a.areas[i]??a.hiddenValues[i]));
    const classes=CLASSES.map((_,i)=>sumOf(a=>classCounts(a.eligible)[i]));
    return {unit,residence:residence(unit,eligible,counts),narrowing:narrowing(unit,eligible,sumOf(a=>a.total),0.23,areas,[0.42,0.17,0.13,0.1,0.09,0.09],classes),fileFFields:null};
  }
  const a=ASL[unit];
  return {unit,residence:residence(unit,a.eligible,a.residence),narrowing:narrowing(unit,a.eligible,a.total,a.share,a.areas,a.narrowed,classCounts(a.eligible)),fileFFields:unit==='asl-3'?fileFFields():null};
}
export const addUnitObject=unit=>({schema:'pillar-c-additions-unit-v1',build:'add-v1',...addEntry(unit)});
export const addFullObject=()=>({schema:'pillar-c-additions-v1',build:'add-v1',units:ADD_UNITS.map(addEntry)});
const bytesOf=o=>Buffer.from(JSON.stringify(o)+'\n');

/** Files at their storage paths and the pins of additions-storage.ts. `hooks.unit(unit, object)` / `hooks.full(object)`
 * mutate an object BEFORE it is hashed, so a tampered object stays consistent with its pin. */
export function addFixture(hooks={}){
  const files=new Map(),scoped={};
  for(const u of ADD_UNITS){const o=addUnitObject(u);hooks.unit?.(u,o);const body=bytesOf(o),sha=sha256(body),name=`aggiunte-${sha}.json`;files.set(`v9/${u}/${name}`,body);scoped[u]={name,sha256:sha,bytes:body.length};}
  const full=addFullObject();hooks.full?.(full);
  const fullBytes=bytesOf(full),fullSha=sha256(fullBytes),regionalName=`aggiunte-${fullSha}.json`;
  files.set(`v9/regione/${regionalName}`,fullBytes);
  return {files,fullBytes,pins:{build:'add-v1',root:'v9',scoped,regional:{name:regionalName,sha256:fullSha,bytes:fullBytes.length},
    reviewer:{bucket:'pillar-c-review',object:`add1/${fullSha}.json`,sha256:fullSha,bytes:fullBytes.length}}};
}

/** The view a loader hands a workspace: the given units, labelled as the audience names them. */
export const addViewOf=(units,label=u=>u==='aggregato'?'Aggregato delle quattro Aziende':`ASL ${u.slice(4)}`)=>({units:units.map(u=>({key:u,label:label(u),entry:addEntry(u)}))});
