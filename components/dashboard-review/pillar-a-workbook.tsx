import {createClient} from '@/lib/supabase/server';
import {getCurrentOrg} from '@/lib/auth/get-current-org';
import {PrivatePillarCharts} from '@/components/private-pillar-charts';
import {privatePillarAnalysis,PRIVATE_RELEASE,type PrivateFact} from '@/lib/analytics/private-pillar-a';
import {PRIVATE_PILLAR_A_ACTIVE,UNDEFINED_TABLE} from '@/lib/analytics/private-pillar-activation';

const n=(v:number|null,d=2)=>v===null?'N/D':new Intl.NumberFormat('it-IT',{maximumFractionDigits:d}).format(v);
const pct=(v:number|null)=>v===null?'N/D':`${n(v*100,1)}%`;
const table='w-full text-sm [&_th]:p-3 [&_th]:text-left [&_td]:p-3 [&_tr]:border-b';
// Rendered inside /dashboard-review/antibiotici. Returns null until private
// activation is approved, so the host page is unchanged in the meantime.
export async function PillarAWorkbookSection(){
 const org=await getCurrentOrg();
 if(!org)return null;
 // Activation is a recorded approval held in one constant. While it is false
 // the section renders nothing rather than querying a relation that may not
 // exist and surfacing an error boundary to every approved user.
 if(!PRIVATE_PILLAR_A_ACTIVE)return null;
 const db=await createClient();
 // Request-scoped session only. RLS is the authorization boundary. Never cache
 // this result globally or use a service-role client in this route.
 let query=db.from('pillar_a_private_fact').select('release_id,org_code,year,aware_category,cf,cmr,ddd,activity,activity_variant,source_hash').eq('release_id',PRIVATE_RELEASE);
 // Select the primary membership's scope as well as enforcing RLS. A user with
 // multiple approved memberships must not see their totals mixed together.
 // Real organization names, so the charts never have to guess a label. The
 // client component previously carried a hardcoded {'201':'ASL 1',...} map and
 // fell back to the generic 'Azienda autorizzata' — which made every
 // organization beyond the original four indistinguishable from the others.
 let orgNames:Record<string,string>={};
 if(org.org_type==='asl')query=query.eq('org_code',org.org_code);
 else{
  const {data:members,error}=await db.from('organizations').select('org_code,org_name').eq('region_code',org.region_code).eq('org_type','asl');
  if(error)throw Error('Impossibile verificare il perimetro organizzativo.');
  if(!members?.length)return null;
  query=query.in('org_code',members.map(r=>r.org_code));
  orgNames=Object.fromEntries(members.map(r=>[r.org_code,r.org_name]));
 }
 const {data,error}=await query.order('year').order('org_code').order('aware_category').limit(1000);
 // An unapplied migration is a deployment state, not a read failure: report it
 // as such rather than as a generic error the user cannot act on.
 if(error?.code===UNDEFINED_TABLE)return null;
 if(error)throw Error('Impossibile leggere il workbook riservato.');
 if(!data?.length)return null;
 if(data.length>=1000)throw Error('Analisi sospesa: il limite di lettura impedisce di garantire totali completi.');
 const rows=privatePillarAnalysis(data as PrivateFact[]),latest=rows.at(-1)!;
 return <section className="space-y-6 border-t pt-8">
  <div><h2 className="font-display text-xl font-semibold">Workbook verificato · Pillar A</h2><p className="mt-2 text-sm text-muted-foreground">Antibiotici J01 · fonti {rows[0].year}–{latest.year} · spesa CF, costo CMR e DDD mantenuti distinti. Stessa analisi della sezione AWaRe qui sopra, sulle fonti verificate del workbook.</p></div>
  <PrivatePillarCharts facts={data as PrivateFact[]} regional={org.org_type==='regione'} orgNames={orgNames}/>
  <h2 className="text-xl font-semibold">Riepilogo completo · {org.org_type==='regione'?'perimetro autorizzato':'la tua Azienda'}</h2><p className="text-sm text-muted-foreground">Le schede e le tabelle seguenti mostrano tutti gli anni del perimetro indicato e non cambiano con i selettori dei grafici sopra.</p>
  <div className="grid gap-4 sm:grid-cols-3">{[['Spesa CF (€)',n(latest.cf)],['DDD da conversione della fonte',n(latest.ddd)],['DDD / 100 unità attività A3',n(latest.dddPer100Activity)]].map(([label,value])=><div key={label} className="rounded-xl border bg-card p-5"><p className="text-sm text-muted-foreground">{label} · {latest.year}</p><p className="mt-3 text-3xl font-semibold">{value}</p></div>)}</div>
  <section className="rounded-xl border bg-card p-5"><h2 className="text-xl font-semibold">Andamento e intensità</h2><div className="overflow-auto"><table className={table}><thead><tr>{['Anno','CF €','CMR €','DDD','Attività A3/T1','DDD/100 A3','CF €/DDD','Δ CF','Δ DDD'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.map(r=><tr key={r.year}><td>{r.year}</td><td>{n(r.cf)}</td><td>{n(r.cmr)}</td><td>{n(r.ddd)}</td><td>{n(r.activity)}</td><td>{n(r.dddPer100Activity)}</td><td>{n(r.costPerDdd)}</td><td>{pct(r.costYoy)}</td><td>{pct(r.dddYoy)}</td></tr>)}</tbody></table></div></section>
  <section className="rounded-xl border bg-card p-5"><h2 className="text-xl font-semibold">Composizione AWaRe degli antibiotici</h2><div className="overflow-auto"><table className={table}><thead><tr>{['Anno','Categoria','CF €','DDD','Quota CF','Quota DDD'].map(h=><th key={h}>{h}</th>)}</tr></thead><tbody>{rows.flatMap(r=>r.categories.map(c=><tr key={`${r.year}/${c.category}`}><td>{r.year}</td><td>{{A:'Access',W:'Watch',R:'Reserve'}[c.category]}</td><td>{n(c.cf)}</td><td>{n(c.ddd)}</td><td>{pct(c.spendShare)}</td><td>{pct(c.dddShare)}</td></tr>))}</tbody></table></div></section>
  <section className="rounded-xl border bg-card p-5"><h2 className="text-xl font-semibold">Scomposizione della variazione CF</h2><p className="my-3 text-sm text-muted-foreground">Confronto con l’anno precedente: effetto DDD e spesa media per DDD, incluso il mix. Non è un effetto prezzo puro né una stima di risparmio.</p><div className="overflow-auto"><table className={table}><thead><tr><th>Confronto</th><th>Effetto DDD €</th><th>Effetto spesa media €</th><th>Totale €</th></tr></thead><tbody>{rows.slice(1).map(r=><tr key={r.year}><td>{r.year-1} → {r.year}</td><td>{n(r.bridge?.volume??null)}</td><td>{n(r.bridge?.average??null)}</td><td>{n(r.bridge?r.bridge.volume+r.bridge.average:null)}</td></tr>)}</tbody></table></div></section>
  <section className="rounded-xl border bg-card p-5 text-sm"><h2 className="mb-3 text-lg font-semibold">Metodo e provenienza</h2><p>Allegati 1 e 2, versione verificata del 23 settembre 2026. DDD = QMR × fattore DDD_AIC fornito. Le categorie AWaRe riproducono la classificazione della fonte. CF è il costo di flusso riportato; CMR è la distinta base di costo normalizzata del workbook, non un risparmio.</p><p className="mt-3">Il workbook seleziona A3/T1: il denominatore viene mantenuto con questa definizione, senza rinominarlo A2 o equipararlo automaticamente alle giornate SDO. I tassi aggregati dividono le somme, non la media dei tassi delle Aziende. Nessun confronto con dati di altre Aziende è esposto a un account Azienda.</p><details className="mt-3"><summary>Formule e versione</summary><p>DDD/100 A3 = DDD ÷ attività × 100. CF/DDD = CF ÷ DDD. Δ% = valore corrente ÷ precedente − 1. Scomposizione simmetrica: ΔQ × media(P) e ΔP × media(Q), con Q=DDD e P=CF/DDD.</p><p className="mt-2 break-all">{PRIVATE_RELEASE} · SHA-256 manifest: {data[0].source_hash}</p></details></section>
 </section>;
}

