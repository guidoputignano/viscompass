"use client";
import {ResponsiveContainer,LineChart,Line,CartesianGrid,XAxis,YAxis,Tooltip,Legend} from 'recharts';
import {privatePillarAnalysis,type PrivateFact} from '@/lib/analytics/private-pillar-a';

// Per-Azienda hospital antibiotic intensity, on the denominator the workbook
// actually supplies.
//
// THE PNCAR LEVEL IS DELIBERATELY NOT DRAWN ON THIS CHART.
//
// PNCAR 2022-2025 indicator 2.3 asks for a >5% REDUCTION in DDD/100 giornate di
// degenza in 2025 against 2022 — a relative target — and the plan itself
// specifies no denominator at all: no care-setting perimeter, no public/private
// split. The only operational definition is OSMED's: SDO ordinary-regime days in
// PUBLIC hospitals only, plus day hospital / day surgery, with no acute-care
// restriction.
//
// The SDO series this product holds is all-institute and acute-only, so it
// mismatches OSMED on BOTH axes at once — ownership and care setting. It cannot
// be corrected into place either: giornate are never published by region x tipo
// istituto, and discharge shares do not substitute for giornate shares (in 2024
// acute ordinary regime, public institutes are 74.4% of discharges but 81.3% of
// giornate). OSMED further publishes regional grain only, so no per-ASL
// published figure exists to benchmark against.
//
// The magnitude is not waveable. Calibrating the public activity proxy against
// the Azienda-supplied value for region 130 in 2024
// (data/derived/pillar_a/a2_public_proxy_calibration_summary.json):
//
//   SDO acute, RO days + DH accesses   963,045 trusted vs 1,022,331 proxy  (+6.2%)
//   SDO acute, RO days only            963,045 trusted vs   910,332 proxy  (-5.5%)
//
// Holding the numerator fixed, those two compositions move the same Azienda
// between 78.09 and 87.70 DDD/100 — a 9.6-point spread with the 78.76 reference
// sitting inside it. Drawing a target line here would let the choice of
// denominator decide whether an Azienda appears to meet the plan. The
// calibration file itself carries generalizationPolicy: "not_yet_approved" and
// marks every composition "blocked", on one region-year with zero per-Azienda
// observations.
//
// The numerator differs too: OSMED counts antibiotics purchased by public
// facilities net of distribuzione diretta; this is hospital pharmacy erogato.
//
// What IS comparable to PNCAR is the RELATIVE change, because a percentage
// reduction is invariant to a denominator scaled consistently across years.
// This release starts at 2023, so the plan's own 2025-vs-2022 comparison cannot
// be computed — stated plainly below rather than substituted with the earliest
// year we happen to hold, which would answer a different question under the
// plan's name.
const colors=['#2a78d6','#eb6834','#1baf7a','#eda100'];
const n1=(v:number|null)=>v===null?'N/D':new Intl.NumberFormat('it-IT',{maximumFractionDigits:1}).format(v);
const pct=(v:number|null)=>v===null?'N/D':new Intl.NumberFormat('it-IT',{style:'percent',maximumFractionDigits:1,signDisplay:'exceptZero'}).format(v);
const colorFor=(org:string)=>colors[[...org].reduce((h,c)=>(h*31+c.charCodeAt(0))>>>0,7)%colors.length];
const PNCAR_BASELINE_YEAR=2022;

export function PrivatePncarContext({facts,orgNames={}}:{facts:PrivateFact[];orgNames?:Record<string,string>}){
 const orgs=[...new Set(facts.map(r=>r.org_code))].sort();
 const years=[...new Set(facts.map(r=>r.year))].sort((a,b)=>a-b);
 const label=(org:string)=>orgNames[org]??org;
 // One analysis per Azienda, so each keeps its own activity denominator.
 const byOrg=new Map(orgs.map(o=>[o,privatePillarAnalysis(facts.filter(r=>r.org_code===o))]));
 const series=years.map(y=>Object.fromEntries([['year',y],
  ...orgs.map(o=>[o,byOrg.get(o)!.find(r=>r.year===y)?.dddPer100Activity??null])]));
 const change=orgs.map(o=>{
  const rows=byOrg.get(o)!;
  const first=rows[0],last=rows[rows.length-1];
  const a=first?.dddPer100Activity??null,b=last?.dddPer100Activity??null;
  return {org:o,from:first?.year??null,to:last?.year??null,start:a,end:b,
   delta:a!==null&&b!==null&&a>0?b/a-1:null};
 });
 const haveBaseline=years.includes(PNCAR_BASELINE_YEAR);
 return <section className="space-y-4 rounded-xl border bg-card p-5">
  <h2 className="text-xl font-semibold">Intensità di consumo per Azienda · DDD per 100 A3/T1</h2>
  <p className="text-sm text-muted-foreground">Numeratore: DDD da conversione della fonte. Denominatore: attività A3/T1 fornita dall’Azienda, la stessa usata nel resto del workbook. Ogni Azienda usa il proprio denominatore; la serie non è normalizzata fra Aziende e non è un indicatore PNCAR.</p>
  <div className="h-72"><ResponsiveContainer><LineChart data={series}>
   <CartesianGrid strokeDasharray="3 5"/><XAxis dataKey="year"/>
   <YAxis width={70} tickFormatter={v=>n1(Number(v))}/>
   <Tooltip formatter={(v,name)=>[n1(Number(v)),label(String(name))]}/><Legend formatter={v=>label(String(v))}/>
   {orgs.map(o=><Line key={o} dataKey={o} name={o} stroke={colorFor(o)} strokeWidth={2} connectNulls={false}/>)}
  </LineChart></ResponsiveContainer></div>

  <div className="rounded-lg border-l-4 border-primary bg-secondary/50 px-4 py-3 text-sm leading-relaxed">
   <p className="font-semibold">Perché la soglia PNCAR non è tracciata su questo grafico</p>
   <p className="mt-2">L’indicatore 2.3 del PNCAR 2022–2025 chiede una riduzione superiore al 5% del consumo (DDD/100 giornate di degenza) di antibiotici sistemici in ambito ospedaliero nel 2025 rispetto al 2022: è un obiettivo <strong>relativo</strong>, e il piano <strong>non definisce il denominatore</strong>. L’unica definizione operativa è quella OSMED: giornate SDO in regime ordinario nei <strong>soli ospedali pubblici</strong>, più day hospital e day surgery, senza restrizione agli acuti.</p>
   <p className="mt-2">Il denominatore usato qui è l’attività A3/T1 fornita dall’Azienda. Lo scarto non è su un solo asse: OSMED è pubblico-solo e su tutti i regimi, mentre la serie SDO disponibile è tutti-istituti e solo acuti. Sulla calibrazione regionale 2024 le due composizioni SDO plausibili spostano lo stesso valore fra <strong>78,09</strong> e <strong>87,70</strong> DDD/100. Tracciare una soglia qui farebbe decidere alla scelta del denominatore se un’Azienda risulti in linea con il piano.</p>
   <p className="mt-2">Il valore <strong>78,76</strong> usato altrove come riferimento non compare in nessuna fonte: è calcolato come tasso OSMED 2022 del territorio moltiplicato per 0,95. È una soglia derivata, non pubblicata.</p>
   <p className="mt-2">Il confronto che resta valido è la <strong>variazione relativa</strong>: una riduzione percentuale non dipende da un denominatore scalato in modo coerente fra gli anni. {haveBaseline?`Con il ${PNCAR_BASELINE_YEAR} disponibile il confronto previsto dal piano è calcolabile.`:`Questo rilascio parte dal ${years[0]}, quindi il confronto 2025 rispetto al ${PNCAR_BASELINE_YEAR} previsto dal piano non è calcolabile e non viene mostrato come se lo fosse.`}</p>
  </div>

  <div className="overflow-auto"><table className="w-full text-left text-sm [&_td]:p-2 [&_th]:p-2">
   <caption className="text-left text-sm text-muted-foreground">Variazione osservata sugli anni disponibili. Non è la verifica dell’obiettivo PNCAR{haveBaseline?'':`, che richiede il ${PNCAR_BASELINE_YEAR} come base`}.</caption>
   <thead><tr><th>Azienda</th><th>Periodo</th><th>DDD/100 A3 iniziale</th><th>DDD/100 A3 finale</th><th>Variazione</th></tr></thead>
   <tbody>{change.map(r=><tr key={r.org} className="border-t"><td>{label(r.org)}</td><td>{r.from}–{r.to}</td><td>{n1(r.start)}</td><td>{n1(r.end)}</td><td>{pct(r.delta)}</td></tr>)}</tbody>
  </table></div>
 </section>;
}
