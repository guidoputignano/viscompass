"use client";
import {useState} from 'react';
import {expenditureBridge,spendingComposition,type PublicAnnual} from '@/lib/analytics/pillar-a-visuals';

const euro=(v:number)=>new Intl.NumberFormat('it-IT',{style:'currency',currency:'EUR',maximumFractionDigits:0}).format(v);
const short=(v:number)=>new Intl.NumberFormat('it-IT',{notation:'compact',maximumFractionDigits:1}).format(v);
const colors=['#13998f','#617b91'];

export function PillarAFlowVisuals({annual,region,regionName,group,channel}:{annual:PublicAnnual[];region:string;regionName:string;group:string;channel:string}){
 // Years derived from the territory's own rows. This was the literal
 // Array.from({length:9},(_,i)=>2017+i) — 2017..2025 — a derived value restated
 // by hand, correct only for today's extract. scripts/build_pillar_a_public_series.py
 // ingests AIFA year-generically, so a 2026 profile would load with no code
 // change and simply stay unreachable in this selector.
 //
 // Filtered on region alone, deliberately NOT on group/channel: the Sankey
 // states just below that it spans both families and both flows regardless of
 // those filters, so narrowing the options to one combination would contradict
 // the panel's own contract.
 //
 // The earliest year is offered too. It has no predecessor, but expenditureBridge
 // already returns null for that case and the waterfall renders its designed
 // "Scomposizione non disponibile" branch, while its Sankey is perfectly valid.
 // Dropping the first element would also quietly assume the series has no gaps.
 const years=[...new Set(annual.filter(r=>r.region===region).map(r=>r.year))].sort((a,b)=>a-b);
 const [year,setYear]=useState(years[years.length-1]);
 const composition=spendingComposition(annual,region,year);
 const selected=annual.filter(r=>r.region===region&&r.group===group&&r.channel===channel);
 const bridge=expenditureBridge(selected.find(r=>r.year===year-1),selected.find(r=>r.year===year));
 const sourceTotals=[0,1].map(i=>composition?.links.filter(l=>l.source===i).reduce((s,l)=>s+l.value,0)??0);
 const targetTotals=[0,1].map(i=>composition?.links.filter(l=>l.target===i).reduce((s,l)=>s+l.value,0)??0);
 const scale=composition?220/composition.total:0;
 const sourceY=[75,75+sourceTotals[0]*scale+36],targetY=[75,75+targetTotals[0]*scale+36];
 const usedS=[0,0],usedT=[0,0];
 const bars=bridge?[
  {label:String(year-1),low:0,high:bridge.start,value:bridge.start,color:'#173b49'},
  {label:'Effetto confezioni',low:Math.min(bridge.start,bridge.intermediate),high:Math.max(bridge.start,bridge.intermediate),value:bridge.volume,color:'#13998f'},
  {label:'Spesa media / conf.',low:Math.min(bridge.intermediate,bridge.end),high:Math.max(bridge.intermediate,bridge.end),value:bridge.average,color:'#617b91'},
  {label:String(year),low:0,high:bridge.end,value:bridge.end,color:'#173b49'}]:[];
 const max=Math.max(1,...bars.map(b=>b.high)),min=Math.min(0,...bars.map(b=>b.low));
 const y=(v:number)=>300-(v-min)/(max-min)*225;
 return <section className="space-y-6 rounded-2xl border bg-card p-5 sm:p-6">
  <div className="flex flex-wrap items-center justify-between gap-4"><div><h2 className="font-display text-xl font-semibold">Composizione e variazione della spesa</h2><p className="mt-2 text-sm text-muted-foreground">{regionName} · fonti pubbliche AIFA · importi riportati in euro</p></div><label className="text-sm font-semibold">Anno analisi<select aria-label="Anno analisi dei flussi" value={year} onChange={e=>setYear(Number(e.target.value))} className="ml-3 rounded-lg border bg-background p-2">{years.map(v=><option key={v}>{v}</option>)}</select></label></div>
  <p className="rounded-lg bg-secondary/50 p-3 text-sm">I grafici riconciliano le somme dei valori numerici riportati da AIFA. Le celle vuote restano non disponibili: non sono imputate né certificate come zero. La lettura descrive gli aggregati disponibili, non certifica la completezza dei consumi. Le etichette sono arrotondate all’euro: possono apparire piccoli scarti di arrotondamento.</p>
  <div><h3 className="font-semibold">Sankey · flussi e famiglie</h3><p className="mt-2 text-sm text-muted-foreground">Acquisti diretti e convenzionata, antibiotici J01 e antifungini J02A. Questo grafico comprende entrambe le famiglie e i flussi, indipendentemente dai filtri sopra. Le bande rappresentano quote di spesa, non trasferimenti o percorsi di pazienti.</p>
  {!composition?<p className="mt-4 text-sm">Composizione non disponibile: servono quattro aggregati numerici non negativi, con totale positivo.</p>:<><div className="overflow-x-auto"><svg viewBox="0 0 900 390" className="min-w-[700px] w-full" role="img" aria-label={`Composizione della spesa ${year}: ${euro(composition.total)}`}>
    {composition.links.map(l=>{const h=l.value*scale,a=sourceY[l.source]+usedS[l.source],b=targetY[l.target]+usedT[l.target];usedS[l.source]+=h;usedT[l.target]+=h;return <path key={`${l.source}-${l.target}`} d={`M 235 ${a} C 430 ${a},470 ${b},665 ${b} L 665 ${b+h} C 470 ${b+h},430 ${a+h},235 ${a+h} Z`} fill={colors[l.target]} opacity=".4"><title>{['Acquisti diretti','Convenzionata'][l.source]} → {['Antibiotici J01','Antifungini J02A'][l.target]}: {euro(l.value)}</title></path>;})}
    {sourceTotals.map((v,i)=><g key={`s${i}`}><rect x="220" y={sourceY[i]} width="15" height={v*scale} fill="#173b49"/><text x="205" y={sourceY[i]+v*scale/2-5} textAnchor="end" fontSize="14" fill="currentColor">{['Acquisti diretti','Convenzionata'][i]}</text><text x="205" y={sourceY[i]+v*scale/2+15} textAnchor="end" fontSize="13" fill="currentColor">{euro(v)}</text></g>)}
    {targetTotals.map((v,i)=><g key={`t${i}`}><rect x="665" y={targetY[i]} width="15" height={v*scale} fill={colors[i]}/><text x="695" y={targetY[i]+v*scale/2-5} fontSize="14" fill="currentColor">{['Antibiotici J01','Antifungini J02A'][i]}</text><text x="695" y={targetY[i]+v*scale/2+15} fontSize="13" fill="currentColor">{euro(v)}</text></g>)}
  </svg></div><details className="text-sm"><summary className="cursor-pointer">Importi delle quattro componenti</summary><ul className="mt-2 space-y-1">{composition.links.map(l=><li key={`${l.source}-${l.target}`}>{['Acquisti diretti','Convenzionata'][l.source]} / {['J01','J02A'][l.target]}: {euro(l.value)}</li>)}</ul></details></>}
  </div>
  <div className="border-t pt-6"><h3 className="font-semibold">Waterfall · da {year-1} a {year}</h3><p className="mt-2 text-sm text-muted-foreground">{group==='antibiotics'?'Antibiotici J01':'Antifungini J02A'} · {channel==='direct'?'Acquisti diretti':'Convenzionata'}. Scomposizione simmetrica tra numero di confezioni e spesa media per confezione. Quest’ultima include il mix di prodotti e confezionamenti: non è un effetto prezzo puro.</p>
  {!bridge?<p className="mt-4 text-sm">Scomposizione non disponibile: occorrono aggregati numerici per due anni consecutivi, con spesa non negativa e confezioni positive.</p>:<><div className="overflow-x-auto"><svg viewBox="0 0 900 380" className="min-w-[700px] w-full" role="img" aria-label={`Variazione della spesa ${euro(bridge.end-bridge.start)}`}>
    {[0,.25,.5,.75,1].map(f=>{const v=min+(max-min)*f;return <g key={f}><line x1="85" x2="860" y1={y(v)} y2={y(v)} stroke="#d5e3e5" strokeDasharray="3 5"/><text x="75" y={y(v)+5} textAnchor="end" fontSize="12" fill="currentColor">{short(v)}</text></g>;})}
    {bars.map((b,i)=><g key={b.label}><rect x={120+i*190} y={y(b.high)} width="105" height={Math.max(1,y(b.low)-y(b.high))} fill={b.color}/><text x={172+i*190} y={y(b.high)-12} textAnchor="middle" fontSize="13" fill="currentColor">{i===1||i===2?(b.value>=0?'+':''):''}{euro(b.value)}</text><text x={172+i*190} y="332" textAnchor="middle" fontSize="13" fill="currentColor">{b.label}</text></g>)}
    {[bridge.start,bridge.intermediate,bridge.end].map((v,i)=><line key={i} x1={225+i*190} x2={310+i*190} y1={y(v)} y2={y(v)} stroke="#80959e" strokeDasharray="4 4"/>)}
  </svg></div><p className="text-sm">Variazione totale: <strong>{euro(bridge.end-bridge.start)}</strong>. Effetto confezioni {euro(bridge.volume)} + effetto spesa media {euro(bridge.average)}.</p><details className="mt-3 text-sm"><summary className="cursor-pointer">Formula e interpretazione</summary><p className="mt-2">Q = confezioni; P = spesa/Q. Effetto Q = (Q₁−Q₀)×(P₀+P₁)/2; effetto P = (P₁−P₀)×(Q₀+Q₁)/2. La somma riconcilia con la variazione di spesa. È una scomposizione contabile, non una spiegazione causale né una stima di risparmio.</p></details></>}
  </div>
 </section>;
}
