// Synthetic under-€10 DPC medicine lists (joint feedback 2, G2-16) for tests/pillar-c-under10.test.mjs: invented medicines,
// ingredients, AIC codes and amounts; nothing here is a real product or figure. Built like the private objects
// (build u10-v1): money in integer cents, rows by total service, the «others» row for products with fewer than 5 assistiti.
import {createHash} from 'node:crypto';

export const U10_UNITS=['asl-1','asl-2','asl-3','asl-4'];
const sha=b=>createHash('sha256').update(b).digest('hex');

/** One ASL: three listed medicines (the third averages 9,999 € a pack: shown as 10,00 € and still under the threshold),
 * and, except for ASL 4, an «others» row of two medicines, one with a recorded acquisition of zero. */
export function u10Entry(unit){
  const n=Number(unit.slice(4)),aic=i=>`90000${n}10${i}`;
  const rows=[
    {aic:aic(1),medicine:`Farmaco sintetico Alfa ${n}`,pack:'28 compresse in blister PVC/PE',ingredient:'Sostanza sintetica uno',packs:100*n,acquisitionCents:50000*n,serviceCents:80000*n},
    {aic:aic(2),medicine:`Farmaco sintetico Beta ${n}`,pack:'10 flaconcini',ingredient:'Àcido sintetico due',packs:60,acquisitionCents:54000,serviceCents:48000},
    {aic:aic(3),medicine:`Farmaco sintetico Gamma ${n}`,pack:'30 capsule',ingredient:'Base sintetica tre',packs:40,acquisitionCents:39996,serviceCents:32000},
  ];
  const others=n===4?null:{products:2,packs:7,acquisitionCents:2100,serviceCents:5600,zeroAcquisition:1};
  const add=k=>rows.reduce((a,r)=>a+r[k],0)+(others?others[k]:0);
  return {unit,total:{products:rows.length+(others?others.products:0),packs:add('packs'),acquisitionCents:add('acquisitionCents'),serviceCents:add('serviceCents')},rows,others};
}
export const u10Object=(units,mutate)=>{const o={schema:'pillar-c-under10-v1',build:'u10-v1',period:'2026-01',channel:'DPC',thresholdCents:1000,minRecipients:5,units:units.map(u10Entry)};mutate?.(o);return o;};
const bytesOf=o=>Buffer.from(JSON.stringify(o),'utf8');

/** The bucket as the loaders read it (v9/<unit>/sotto10-<sha>.json and v9/regione/…) and the pins that name it. */
export function u10Fixture({unit,full}={}){
  const files=new Map(),pins={build:'u10-v1',root:'v9',scoped:{}};
  for(const u of U10_UNITS){
    const b=bytesOf(u10Object([u],o=>unit?.(u,o)));const name=`sotto10-${sha(b)}.json`;
    files.set(`v9/${u}/${name}`,b);pins.scoped[u]={name,sha256:sha(b),bytes:b.length};
  }
  const fullBytes=bytesOf(u10Object(U10_UNITS,full));
  pins.regional={name:`sotto10-${sha(fullBytes)}.json`,sha256:sha(fullBytes),bytes:fullBytes.length};
  pins.reviewer={bucket:'pillar-c-review',object:`u10/${sha(fullBytes)}.json`,sha256:sha(fullBytes),bytes:fullBytes.length};
  files.set(`v9/regione/${pins.regional.name}`,fullBytes);
  return {files,pins,fullBytes};
}
/** A view as a workspace receives it: the given ASLs under the given labels. */
export const u10ViewOf=(units,label=u=>`ASL ${u.slice(4)}`)=>({units:units.map(u=>({key:u,label:label(u),entry:u10Entry(u)}))});
