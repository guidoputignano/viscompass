import {PillarAProducts} from '@/components/dashboard-review/pillar-a-products';
import {resolvePrivateScope} from '@/lib/analytics/private-scope';
import {PrivatePillarCharts} from '@/components/private-pillar-charts';
import {PrivatePncarContext} from '@/components/private-pncar-context';
import {privatePillarAnalysis,PRIVATE_RELEASE,type PrivateFact} from '@/lib/analytics/private-pillar-a';
import {PRIVATE_PILLAR_A_ACTIVE,UNDEFINED_TABLE} from '@/lib/analytics/private-pillar-activation';
import {orgDisplayMap} from '@/lib/analytics/org-pseudonym';
import {reconcileCostBases} from '@/lib/analytics/cost-basis-reconciliation';
import {itNumberFormat} from "@/lib/format/it-number";

const n=(v:number|null,d=2)=>v===null?'N/D':itNumberFormat({maximumFractionDigits:d}).format(v);
const pct=(v:number|null)=>v===null?'N/D':`${n(v*100,1)}%`;
const table='w-full text-sm [&_th]:p-3 [&_th]:text-left [&_td]:p-3 [&_tr]:border-b';
// Shown instead of figures when a validation guard rejects the data.
//
// The guards exist to stop an unverified number reaching the screen, and that
// still holds: nothing numeric is rendered here. What changes is the blast
// radius. Throwing reached the route error boundary and replaced the ENTIRE
// antibiotics page — including the authorized summary above, which had passed
// its own checks — with "L'analisi non è disponibile" and no reason. One
// section failing its checks is not a reason to take down the page around it.
//
// The technical reason is printed deliberately. The people who see this section
// are the ones who can act on "Mixed source versions" or "Category totals do
// not reconcile"; hiding it behind a generic message would leave them with a
// blank panel and nothing to chase.
const reason=(e:unknown)=>e instanceof Error?e.message:String(e);
function AnalysisSuspended({detail,scope}:{detail:string;scope:string}){
 return <section className="space-y-3 border-t pt-8">
  <h2 className="font-display text-xl font-semibold">Workbook verificato · Pillar A</h2>
  <p className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-700/60 dark:bg-rose-950/40 dark:text-rose-100">
   Analisi riservata sospesa per {scope}. I dati non superano i controlli di validazione, quindi
   non viene mostrata alcuna cifra: un numero non verificato sarebbe peggio di nessun numero.
   Motivo tecnico: <span className="font-mono text-[12px]">{detail}</span>.
  </p>
 </section>;
}
// Rendered inside /dashboard-review/antibiotici. Returns null until private
// activation is approved, so the host page is unchanged in the meantime.
export async function PillarAWorkbookSection({summary}:{summary?:{year:number;costEur:number;dddCount:number}[]}={}){
 // Activation is a recorded approval held in one constant. While it is false
 // the section renders nothing rather than querying a relation that may not
 // exist and surfacing an error boundary to every approved user.
 if(!PRIVATE_PILLAR_A_ACTIVE)return null;
 // WHO is asking and WHAT they may see is decided in exactly one place. This
 // component must not re-derive either: see lib/analytics/private-scope.ts.
 // scope.db is server-only and carries the service-role key on the reviewer
 // path — it is never passed to a Client Component.
 const scope=await resolvePrivateScope();
 if(!scope)return null;
 // Labels resolved server-side, so other organizations' real names never enter
 // the client payload unless the viewer is an authorized reviewer. The viewer
 // sees its own Azienda by name and every other one pseudonymously; a reviewer
 // sees them all by name. See lib/analytics/org-pseudonym.ts.
 const orgNames=orgDisplayMap(scope.orgs,scope.viewerCode,{unrestricted:scope.showRealNames});
 const {data,error}=await scope.db.from('pillar_a_private_fact').select('release_id,org_code,year,aware_category,cf,cmr,ddd,activity,activity_variant,source_hash').eq('release_id',PRIVATE_RELEASE).in('org_code',scope.orgCodes).order('year').order('org_code').order('aware_category').limit(1000);
 // An unapplied migration is a deployment state, not a read failure: report it
 // as such rather than as a generic error the user cannot act on.
 if(error?.code===UNDEFINED_TABLE)return null;
 if(error)throw Error('Impossibile leggere il workbook riservato.');
 if(!data?.length)return null;
 if(data.length>=1000)throw Error('Analisi sospesa: il limite di lettura impedisce di garantire totali completi.');
 // Validation is contained here rather than thrown at the route: every
 // component below re-runs privatePillarAnalysis on the same facts, so if it
 // rejects them once it rejects them everywhere, client-side included.
 let rows:ReturnType<typeof privatePillarAnalysis>;
 let reconciliation:ReturnType<typeof reconcileCostBases>;
 const perimeter=scope.allOrganizations?'tutte le Aziende del rilascio':scope.regional?'il perimetro autorizzato':'la tua Azienda';
 try{
  rows=privatePillarAnalysis(data as PrivateFact[]);
  reconciliation=summary?reconcileCostBases(rows,summary):[];
 }catch(e){
  return <AnalysisSuspended detail={reason(e)} scope={perimeter}/>;
 }
 if(!rows.length)return null;
 const latest=rows.at(-1)!;
 return <section className="space-y-6 border-t pt-8">
  {scope.reviewerScopeUnavailable&&<p className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-700/60 dark:bg-amber-950/40 dark:text-amber-100">Accesso revisore riconosciuto, ma la lettura estesa non è disponibile in questo ambiente: i dati mostrati restano limitati al perimetro della tua organizzazione. Non interpretare questa sezione come l’intero rilascio.</p>}
  <div><h2 className="font-display text-xl font-semibold">Workbook verificato · Pillar A</h2><p className="mt-2 text-sm text-muted-foreground">Antibiotici J01 · fonti {rows[0].year}–{latest.year} · spesa CF, costo CMR e DDD mantenuti distinti. Le variazioni e i rapporti di spesa in questa sezione usano CF, non il costo normalizzato del riepilogo sopra.</p></div>
  {reconciliation.length>0&&<details className="rounded-xl border bg-card p-5"><summary className="font-semibold">Riconciliazione delle basi di costo</summary><p className="my-3 text-sm text-muted-foreground">Confronto numerico per anno nello stesso perimetro autorizzato. Scarto = riepilogo − workbook. La corrispondenza entro 0,01 non rende CF e CMR equivalenti; la loro differenza non è un risparmio. Uno scarto richiede verifica delle versioni, senza modificare i dati di fonte.</p><div className="overflow-auto"><table className={table}><thead><tr>{['Anno','CF €','CMR €','Costo riepilogo €','Scarto vs CMR €','Scarto DDD','Esito'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{reconciliation.map(r=><tr key={r.year}><td>{r.year}</td><td>{n(r.cf)}</td><td>{n(r.cmr)}</td><td>{n(r.summaryCost)}</td><td>{n(r.cmrDelta)}</td><td>{n(r.dddDelta)}</td><td>{r.matches===null?'Non confrontabile':r.matches?'CMR e DDD corrispondono':'Da verificare'}</td></tr>)}</tbody></table></div></details>}
  <PrivatePillarCharts facts={data as PrivateFact[]} regional={scope.regional} orgNames={orgNames}/>
  <PillarAProducts aggregate={data as PrivateFact[]} names={orgNames} scope={scope}/>
  <PrivatePncarContext facts={data as PrivateFact[]} orgNames={orgNames}/>
  <h2 className="text-xl font-semibold">Riepilogo completo · {scope.allOrganizations?'tutte le Aziende del rilascio':scope.regional?'perimetro autorizzato':'la tua Azienda'}</h2><p className="text-sm text-muted-foreground">Le schede e le tabelle seguenti mostrano tutti gli anni del perimetro indicato e non cambiano con i selettori dei grafici sopra.</p>
  <div className="grid gap-4 sm:grid-cols-3">{[['Spesa CF (€)',n(latest.cf)],['DDD da conversione della fonte',n(latest.ddd)],['DDD / 100 unità attività A3',n(latest.dddPer100Activity)]].map(([label,value])=><div key={label} className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label} · {latest.year}</p><p className="mt-3 text-3xl font-semibold">{value}</p></div>)}</div>
  <section className="rounded-xl border bg-card p-5"><h2 className="text-xl font-semibold">Andamento e intensità</h2><div className="overflow-auto"><table className={table}><thead><tr>{['Anno','CF €','CMR €','DDD','Attività A3/T1','DDD/100 A3','CF €/DDD','Δ CF','Δ DDD'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.year}><td>{r.year}</td><td>{n(r.cf)}</td><td>{n(r.cmr)}</td><td>{n(r.ddd)}</td><td>{n(r.activity)}</td><td>{n(r.dddPer100Activity)}</td><td>{n(r.costPerDdd)}</td><td>{pct(r.costYoy)}</td><td>{pct(r.dddYoy)}</td></tr>)}</tbody></table></div></section>
  <section className="rounded-xl border bg-card p-5"><h2 className="text-xl font-semibold">Composizione AWaRe degli antibiotici</h2><div className="overflow-auto"><table className={table}><thead><tr>{['Anno','Categoria','CF €','DDD','Quota CF','Quota DDD'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.flatMap(r=>r.categories.map(c=><tr key={`${r.year}/${c.category}`}><td>{r.year}</td><td>{{A:'Access',W:'Watch',R:'Reserve'}[c.category]}</td><td>{n(c.cf)}</td><td>{n(c.ddd)}</td><td>{pct(c.spendShare)}</td><td>{pct(c.dddShare)}</td></tr>))}</tbody></table></div></section>
  <section className="rounded-xl border bg-card p-5"><h2 className="text-xl font-semibold">Scomposizione della variazione CF</h2><p className="my-3 text-sm text-muted-foreground">Confronto con l’anno precedente: effetto DDD e spesa media per DDD, incluso il mix. Non è un effetto prezzo puro né una stima di risparmio.</p><div className="overflow-auto"><table className={table}><thead><tr><th>Confronto</th><th>Effetto DDD €</th><th>Effetto spesa media €</th><th>Totale €</th></tr></thead><tbody>{rows.slice(1).map(r=><tr key={r.year}><td>{r.year-1} → {r.year}</td><td>{n(r.bridge?.volume??null)}</td><td>{n(r.bridge?.average??null)}</td><td>{n(r.bridge?r.bridge.volume+r.bridge.average:null)}</td></tr>)}</tbody></table></div></section>
  <section className="rounded-xl border bg-card p-5 text-sm"><h2 className="mb-3 text-lg font-semibold">Metodo e provenienza</h2><p>Allegati 1 e 2, versione verificata del 23 settembre 2026. DDD = QMR × fattore DDD_AIC fornito. Le categorie AWaRe riproducono la classificazione della fonte. CF è il costo di flusso riportato; CMR è la distinta base di costo normalizzata del workbook, non un risparmio.</p><p className="mt-3">Il workbook seleziona A3/T1: il denominatore viene mantenuto con questa definizione, senza rinominarlo A2 o equipararlo automaticamente alle giornate SDO. I tassi aggregati dividono le somme, non la media dei tassi delle Aziende. Nessun confronto con dati di altre Aziende è esposto a un account Azienda.</p><details className="mt-3"><summary>Formule e versione</summary><p>DDD/100 A3 = DDD ÷ attività × 100. CF/DDD = CF ÷ DDD. Δ% = valore corrente ÷ precedente − 1. Scomposizione simmetrica: ΔQ × media(P) e ΔP × media(Q), con Q=DDD e P=CF/DDD.</p><p className="mt-2 break-all">{PRIVATE_RELEASE} · SHA-256 manifest: {data[0].source_hash}</p></details></section>
 </section>;
}
