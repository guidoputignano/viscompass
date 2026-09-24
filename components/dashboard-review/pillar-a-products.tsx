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
 const hash=aggregate[0]?.source_hash;
 if(facts.some(f=>f.source_hash!==hash)||!reconcileProductsToAggregate(facts,aggregate).ok)throw Error('Dettaglio prodotti non riconciliato: visualizzazione sospesa.');
 return <PrivateProductCharts abc={productAbc(facts)} series={atc5Series(facts)} names={names}/>;
}
