import type {PrivateScope} from '@/lib/analytics/private-scope';
import {PrivateProductCharts} from '@/components/private-product-charts';
import {productAbc,atc5Series,reconcileProductsToAggregate,type PrivateProductFact} from '@/lib/analytics/private-pillar-product';
import {PRIVATE_RELEASE,type PrivateFact} from '@/lib/analytics/private-pillar-a';

// Called only after the workbook has resolved the caller's scope. The client
// and the organization list both come from that scope, never from a second
// gate here: for an ordinary viewer it is the session client under RLS, and for
// an allow-listed reviewer it is the service-role client. The org list is derived
// from the aggregate rows the workbook already read, so the product grain can
// never reach past the scope the aggregate was allowed to cover.
export async function PillarAProducts({aggregate,names,scope}:{aggregate:PrivateFact[];names:Record<string,string>;scope:PrivateScope}){
 const db=scope.db;
 const orgs=[...new Set(aggregate.map(r=>r.org_code))];
 const facts:PrivateProductFact[]=[];
 // Paginate: the regional release exceeds Supabase's default 1,000-row cap.
 for(let start=0;;start+=500){
  const {data,error}=await db.from('pillar_a_private_product_fact').select('release_id,org_code,year,aic,atc5,aware_category,product_name,qmr,ddd_aic,cf,cn,cmr,ddd,source_hash').eq('release_id',PRIVATE_RELEASE).in('org_code',orgs).order('org_code').order('year').order('aic').range(start,start+499);
  if(error)throw Error('Impossibile leggere i prodotti riservati.');
  facts.push(...(data??[]) as PrivateProductFact[]);
  if(!data||data.length<500)break;
  if(start>=99500)throw Error('Analisi sospesa: superato il limite di lettura dei prodotti.');
 }
 if(!facts.length)return <p className="text-sm text-muted-foreground">Dettaglio prodotti non disponibile per il perimetro autorizzato.</p>;
 // Contained, not thrown: this is one panel inside the workbook section, and a
 // product grain that will not reconcile is a reason to withhold the product
 // charts, not to take down the aggregate analysis above them. Nothing numeric
 // is rendered on this path.
 const hash=aggregate[0]?.source_hash;
 const mixed=facts.some(f=>f.source_hash!==hash);
 let reconciled=false,detail='';
 try{reconciled=reconcileProductsToAggregate(facts,aggregate).ok;}catch(e){detail=e instanceof Error?e.message:String(e);}
 if(mixed||!reconciled)return <p className="rounded-xl border border-rose-300 bg-rose-50 p-4 text-sm text-rose-900 dark:border-rose-700/60 dark:bg-rose-950/40 dark:text-rose-100">
  Dettaglio prodotti sospeso: {mixed?'le righe provengono da versioni sorgente diverse':'il grano prodotto non si riconcilia con gli aggregati'}.
  Nessuna cifra di prodotto viene mostrata finché il controllo non passa.{detail&&<> Motivo tecnico: <span className="font-mono text-[12px]">{detail}</span>.</>}
 </p>;
 return <PrivateProductCharts abc={productAbc(facts)} series={atc5Series(facts)} names={names}/>;
}
