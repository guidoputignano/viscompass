import { createClient } from '@/lib/supabase/server';
import { getCurrentOrg } from '@/lib/auth/get-current-org';
import { workbookAnalysis, type WorkbookFact } from '@/lib/analytics/private-workbook';
import { PageHeader } from '@/components/dashboard-review/analytics-ui';

const n=(v:number|null,d=2)=>v===null?'N/D':new Intl.NumberFormat('it-IT',{maximumFractionDigits:d}).format(v);
const pct=(v:number|null)=>v===null?'N/D':`${n(v*100,1)}%`;
export default async function PrivatePillarA(){
  const org=await getCurrentOrg();
  if(!org)return <p>È richiesta un’appartenenza organizzativa approvata.</p>;
  const db=await createClient();
  // Request-scoped user client only: never use service-role or a shared cache here.
  const {data,error}=await db.from('antibiotic_consumption_fact').select('org_code,year,aware_category,cost_eur,ddd_count,unit_code,source_note').is('unit_code',null).order('year').order('org_code').order('aware_category').limit(1000);
  if(error)throw new Error('Impossibile leggere i dati autorizzati del workbook.');
  if(!data?.length)return <p>Nessun workbook verificato disponibile per questa organizzazione. Non vengono mostrati dati dimostrativi.</p>;
  if(data.length>=1000)throw new Error('Dataset oltre il limite: analisi sospesa per evitare totali parziali.');
  if(data.some(r=>!r.source_note?.startsWith('VIS_WORKBOOK_V1:')))return <p>La provenienza dei dati richiede verifica prima di attivare questa analisi.</p>;
  const rows=workbookAnalysis(data as WorkbookFact[]),latest=rows.at(-1)!;
  const table='w-full text-sm [&_th]:p-3 [&_th]:text-left [&_td]:p-3 [&_tr]:border-b';
  return <div className="space-y-6">
    <PageHeader eyebrow="Pillar A · workbook riservato" title="Spesa, DDD e composizione AWaRe" description="Calcoli riprodotti dal workbook fornito, nel perimetro autorizzato. DDD già calcolate dalla fonte, non ricostruite dalle confezioni." period={`${rows[0].year}–${latest.year}`} scope={org.org_type==='regione'?'Aggregato delle Aziende autorizzate':'La tua Azienda'}/>
    <div className="grid gap-4 sm:grid-cols-3">{[['Spesa riportata (€)',n(latest.cost)],['DDD fornite',n(latest.ddd)],['Euro per DDD',n(latest.costPerDdd)]].map(([label,value])=><div key={label} className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label}</p><p className="mt-3 text-3xl font-semibold">{value}</p></div>)}</div>
    <section className="rounded-xl border bg-card p-5"><h2 className="text-xl font-semibold">Andamento annuale</h2><div className="overflow-auto"><table className={table}><thead><tr>{['Anno','Spesa €','DDD','€/DDD','Δ spesa','Δ DDD'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.year}><td>{r.year}</td><td>{n(r.cost)}</td><td>{n(r.ddd)}</td><td>{n(r.costPerDdd)}</td><td>{pct(r.costYoy)}</td><td>{pct(r.dddYoy)}</td></tr>)}</tbody></table></div></section>
    <section className="rounded-xl border bg-card p-5"><h2 className="text-xl font-semibold">Composizione degli antibiotici · {latest.year}</h2><div className="overflow-auto"><table className={table}><thead><tr>{['AWaRe','Spesa €','DDD','Quota spesa','Quota DDD'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{latest.categories.map(r=><tr key={r.category}><td>{{A:'Access',W:'Watch',R:'Reserve'}[r.category]}</td><td>{n(r.cost)}</td><td>{n(r.ddd)}</td><td>{pct(r.spendShare)}</td><td>{pct(r.dddShare)}</td></tr>)}</tbody></table></div><p className="mt-3 text-sm text-muted-foreground">Scarto totale − somma categorie: € {n(latest.costGap)}; DDD {n(latest.dddGap)}. I valori arrotondati forniti sono conservati senza correzioni artificiali.</p></section>
    <section className="rounded-xl border bg-card p-5"><h2 className="text-xl font-semibold">Confronto illustrativo con il riferimento del workbook</h2><p className="my-3 text-sm text-muted-foreground">Volume totale DDD mantenuto fisso; prezzi medi e composizione AWaRe dal foglio National Reference (2023–2024). Non è una stima di risparmio né il confronto normalizzato A2. La componente prezzo può includere differenze di composizione interne alle classi. Riferimento 2025 non disponibile.</p><div className="overflow-auto"><table className={table}><thead><tr>{['Anno','Spesa categorie €','Scenario €','Differenza €','Prezzo €','Composizione €','Interazione €'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.year}><td>{r.year}</td>{(['actual','reference','excess','price','mix','interaction'] as const).map(k=><td key={k}>{n(r.decomposition?.[k]??null)}</td>)}</tr>)}</tbody></table></div></section>
    <section className="rounded-xl border bg-card p-5 text-sm"><h2 className="mb-3 text-lg font-semibold">Fonte e limiti</h2><p>Fonte: Pillar A Workbook, copia verificata del 20 settembre 2026. Le identità aritmetiche sono verificate; le DDD rimangono quantità fornite dalla fonte. Gli indicatori A2 e di popolazione sono sospesi finché definizioni e ambito dei denominatori non sono confermati. Il benchmark interno tra Aziende non viene esposto a un account Azienda.</p><details className="mt-4"><summary>Tracciabilità della fonte</summary><p className="mt-2 break-all font-mono text-xs">{data[0].source_note}</p></details></section>
  </div>;
}
