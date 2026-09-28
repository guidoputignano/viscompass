import type { ProductAbcRow } from './private-pillar-product.ts';

export const ATTENTION_KEYS = ['h', 'registry', 'shortage', 'pht'] as const;
export type AttentionKey = typeof ATTENTION_KEYS[number];
export type Evidence = { status: 'listed' | 'not_listed' | 'unknown'; detail: string };
export type ProductAttention = { aic: string; signals: Record<AttentionKey, Evidence> };
export type AttentionSource = { date: string; url?: string; label?: string; sha256: string; rows: number };
export type AttentionReferences = {
 sources: Record<string, AttentionSource>;
 h: string[]; a: string[];
 shortage: Record<string, { start: string; reason: string }[]>;
 registry: { atc: string; name: string; indication: string; kind: string; url: string }[];
 pht: Record<string, string>;
};
export const ATTENTION_LABELS: Record<AttentionKey, string> = {
 h: 'Classe H', registry: 'Registro / PT AIFA', shortage: 'Elenco carenze AIFA', pht: 'PHT · fonte locale',
};

/** Only called server-side on facts already authorized by the private scope. */
export function resolveAttention(products: readonly Pick<ProductAbcRow, 'aic'|'atc5'|'product_name'>[], refs: AttentionReferences): ProductAttention[] {
 const unique = new Map<string, typeof products[number]>();
 const conflicts = new Set<string>();
 for (const p of products) {
  if (!/^\d{9}$/.test(p.aic)) throw Error('Invalid AIC in attention perimeter');
  const prior = unique.get(p.aic);
  if (prior && (prior.atc5 !== p.atc5 || prior.product_name !== p.product_name)) conflicts.add(p.aic);
  unique.set(p.aic, p);
 }
 // Hashed once per call: the A and H lists are 10,711 and 2,464 entries and
 // were rescanned linearly for every product. Membership is all that is asked.
 const hSet=new Set(refs.h), aSet=new Set(refs.a);
 return [...unique.values()].map(p => {
  const h=hSet.has(p.aic), a=aSet.has(p.aic);
  const brand=p.product_name.split('*')[0].trim().toUpperCase().replace(/\s+/g,' ');
  const matches=conflicts.has(p.aic)?[]:refs.registry.filter(r=>r.atc===p.atc5 && r.name.trim().replace(/\s+/g,' ')===brand);
  const shortage=refs.shortage[p.aic];
  const pht=refs.pht[p.aic];
  return {aic:p.aic,signals:{
   h:{status:h!==a?(h?'listed':'not_listed'):'unknown',detail:h&&a?'Classificazione discordante nelle fonti':h?'AIC presente nella lista H':a?'AIC presente nella lista A':'AIC non classificato nelle liste A/H acquisite'},
   registry:{status:matches.length?'listed':'unknown',detail:matches.length?matches.map(r=>`${r.kind}: ${r.indication}`).join('\n'):'Nessuna corrispondenza esatta nome commerciale + ATC5; obbligo non determinato'},
   shortage:{status:shortage?'listed':'not_listed',detail:shortage?shortage.map(r=>`${r.start}: ${r.reason}`).join('; '):'AIC non presente nella lista acquisita; non certifica la disponibilità locale'},
   pht:{status:pht==='yes'?'listed':pht==='no'?'not_listed':'unknown',detail:pht==='yes'?'Flag S nel file locale':pht==='no'?'Flag N nel file locale':'Flag locale assente o discordante'},
  }};
 });
}

/**
 * The products behind one cell, split by what the source says about them.
 *
 * Two groups, never one: a positive result is something to act on, an
 * undetermined one is a match nobody has resolved yet. Merging them would let
 * the second read as the first, which is the whole thing this view avoids.
 *
 * not_listed is deliberately excluded — there is nothing to do about a product
 * the source gives a clean negative for, and in band C that is hundreds of rows.
 * A product with no evidence entry at all counts as unknown, never as negative.
 * Sorted by spend so the largest unresolved product is first.
 */
export function cellProducts<T extends {aic:string;band:string;cf:number}>(
 rows: readonly T[], evidence: readonly ProductAttention[], band: string, key: AttentionKey,
): {listed: T[]; unknown: T[]} {
 const lookup=new Map(evidence.map(e=>[e.aic,e]));
 const inCell=rows.filter(r=>r.band===band);
 const pick=(want:'listed'|'unknown')=>inCell
  .filter(r=>(lookup.get(r.aic)?.signals[key].status??'unknown')===want)
  .sort((a,b)=>b.cf-a.cf);
 return {listed:pick('listed'),unknown:pick('unknown')};
}

/**
 * What to say when a cell opens with nothing to act on.
 *
 * One sentence cannot serve four columns, because they do not share a status
 * vocabulary: registry never emits not_listed, shortage never emits unknown.
 * Saying "tutti negativi" would be false for registry and, for shortage, would
 * turn "absent from the acquired list" into a supply outcome the list does not
 * give -- which is the exact thing this view refuses to do elsewhere.
 */
export function emptyCellMessage(signal:AttentionKey,bandHasProducts:boolean){
 if(!bandHasProducts) return 'Nessun prodotto in questa banda per il perimetro selezionato.';
 if(signal==='shortage') return 'Nessun prodotto di questa banda compare nell’elenco carenze acquisito. L’assenza dall’elenco non certifica la disponibilità locale.';
 if(signal==='h') return 'Tutti i prodotti di questa banda risultano nella lista A della fonte acquisita.';
 if(signal==='pht') return 'Per tutti i prodotti di questa banda il file locale riporta il flag N.';
 return 'Nessun prodotto da esaminare in questa cella.';
}

/** Each column is independent. Overlapping signals are never added together. */
export function attentionMatrix(rows: readonly ProductAbcRow[], evidence: readonly ProductAttention[]) {
 if(new Set(rows.map(r=>`${r.org_code}|${r.year}`)).size>1) throw Error('Select one organization and year');
 if(new Set(rows.map(r=>r.aic)).size!==rows.length) throw Error('Duplicate product in matrix');
 const lookup=new Map(evidence.map(e=>[e.aic,e]));
 if(lookup.size!==evidence.length)throw Error('Duplicate attention evidence');
 return ATTENTION_KEYS.map(key=>({key,bands:(['A','B','C'] as const).map(band=>{
  const group=rows.filter(r=>r.band===band);
  const cells={listed:{count:0,spend:0},not_listed:{count:0,spend:0},unknown:{count:0,spend:0}};
  for(const r of group){
   if(!Number.isFinite(r.cf)||r.cf<0)throw Error('Invalid spend in attention matrix');
   const status=lookup.get(r.aic)?.signals[key].status??'unknown';
   cells[status].count++;cells[status].spend+=r.cf;
  }
  return {band,...cells};
 })}));
}
