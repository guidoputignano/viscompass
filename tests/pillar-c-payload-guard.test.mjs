// Pillar C organisation-scoped delivery: the closed-schema payload guard and the field-aware token rule.
// Synthetic data only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {guardCScopedPayload,guardCClientAudience,C_PROVINCE_TOKEN,C_PLACE_NAME,C_REVIEWER_ONLY_KEYS} from '../lib/dashboard-review/pillar-c/payload-guard.ts';
import {toClientAudience} from '../lib/dashboard-review/pillar-c/audience-rules.ts';
import {parseCScopedReviewFile,mergeCScopedReview} from '../lib/dashboard-review/pillar-c/scoped-review.ts';
import {parseCAttrPacket} from '../lib/dashboard-review/pillar-c/attribution.ts';
import {cPortfolioView,parseCPortfolioPacket} from '../lib/dashboard-review/pillar-c/portfolio.ts';
import {scopedFixture,scopedReviewFile,TOKEN_LABEL,TOKEN_ATC,ASL_UNITS} from './fixtures/pillar-c-scoped.mjs';

const AZ=['asl-2','aggregato'],RE=['aggregato',...ASL_UNITS];
const fixture=scopedFixture();
const json=(unit,prefix)=>{const p=[...fixture.files.keys()].find(k=>k.startsWith(`v1/${unit}/${prefix}`));return JSON.parse(fixture.files.get(p).toString());};
const meta=unit=>json(unit,'index-');
function attrView(unit='asl-2'){
  const ix=meta(unit).attribution;
  const shards=['FY2025','FY2024'].map(p=>json(unit,`attr-${p}-Tutti-`));
  const packet=parseCAttrPacket({sourceSha256:ix.sourceSha256,classificationSha256:ix.classificationSha256,mappingVersion:ix.mappingVersion,precision:ix.precision,portfolios:ix.portfolios,schema:'pillar-c-attribution-v1',scopes:shards},[unit]);
  return {schema:'pillar-c-attribution-view-v1',sourceSha256:packet.sourceSha256,classificationSha256:packet.classificationSha256,mappingVersion:packet.mappingVersion,sourceSnapshot:'9'.repeat(64),portfolios:packet.portfolios,scope:packet.scopes[0],comparison:packet.scopes[1]};
}
function portView(unit='asl-2'){
  const ix=meta(unit).portfolio,shards=['FY2025','FY2024'].map(p=>json(unit,`port-${p}-Tutti-`));
  const packet=parseCPortfolioPacket({schema:'pillar-c-portfolio-v1',precision:ix.precision,sourceSha256:ix.sourceSha256,classificationSha256:ix.classificationSha256,mappingVersion:ix.mappingVersion,portfolios:ix.portfolios,scopes:shards},[unit]);
  return cPortfolioView(packet,'FY2025',unit,'Tutti','AA','9'.repeat(64));
}
const review=units=>mergeCScopedReview(units,units.map(u=>parseCScopedReviewFile(scopedReviewFile(u),u)));
const refuse=(kind,value,units,reason)=>assert.throws(()=>guardCScopedPayload(kind,value,units),new RegExp(`PCS_GUARD_${reason}`));

test('a valid payload is rebuilt unchanged as a fresh object, for every schema',()=>{
  for(const [kind,value,units] of [['attribution',attrView(),AZ],['portfolio',portView(),AZ],['review',review(AZ),AZ],['review',review(RE),RE]]){
    const out=guardCScopedPayload(kind,value,units);
    assert.deepEqual(out,value,kind);assert.notEqual(out,value);
  }
});

test('closed schema: an unknown or missing key at any depth fails, and every reviewer-only block is named',()=>{
  const cases=[
    ['attribution',v=>{v.scope.products[0].extra='x';},'UNKNOWN_FIELD'],['attribution',v=>{delete v.scope.bounds[0].upper2;},'MISSING_FIELD'],
    ['attribution',v=>{v.portfolios[0].hidden=true;},'UNKNOWN_FIELD'],['portfolio',v=>{v.dossier.monthly[0].note='x';},'UNKNOWN_FIELD'],
    ['portfolio',v=>{v.comparison.dossier.sharedProducts.push({});},'MISSING_FIELD'],['review',v=>{v.monthly[0].privateSentinel='x';},'UNKNOWN_FIELD'],
  ];
  for(const [kind,mutate,reason] of cases){const v=structuredClone(kind==='attribution'?attrView():kind==='portfolio'?portView():review(AZ));mutate(v);refuse(kind,v,AZ,reason);}
  for(const key of C_REVIEWER_ONLY_KEYS){
    refuse('review',{...review(AZ),[key]:[]},AZ,'REVIEWER_ONLY');
    refuse('attribution',{...attrView(),[key]:'a'.repeat(64)},AZ,'REVIEWER_ONLY');
  }
});

test('org fields admit only the audience units',()=>{
  for(const org of ['asl-1','asl-3','asl-4','Regione','AQ','TE','ASL-2','asl-2 ','']){
    const v=structuredClone(attrView());v.scope.org=org;refuse('attribution',v,AZ,'ORG');
    const r=structuredClone(review(AZ));r.counts[0].org=org;refuse('review',r,AZ,'ORG');
  }
  const r=structuredClone(review(AZ));r.orgs.push('asl-1');refuse('review',r,AZ,'ORG');
});

test('identifier and text fields: no province key, place name, NSIS Azienda code, foreign unit key or reviewer aggregate key',()=>{
  const cases=[
    [v=>{v.scope.products[0].key='TE';},'PROVINCE'],[v=>{v.scope.products[0].key='912-CH-1';},'PROVINCE'],[v=>{v.scope.bounds[0].id='PE';},'PROVINCE'],
    [v=>{v.portfolios[0].kind='area AQ';},'PROVINCE'],[v=>{v.mappingVersion='v0.1 TE';},'PROVINCE'],[v=>{v.scope.products[0].candidates=['AA','CH'];},'PROVINCE'],
    [v=>{v.scope.products[0].key='130203';},'PLACE'],[v=>{v.scope.products[0].key='x-130201-y';},'PLACE'],[v=>{v.portfolios[0].kind='Teramo';},'PLACE'],
    [v=>{v.scope.products[0].key='asl-1';},'FOREIGN_UNIT'],[v=>{v.mappingVersion='per asl-3';},'FOREIGN_UNIT'],[v=>{v.scope.products[0].key='Regione-1';},'REGIONE_KEY'],
  ];
  for(const [mutate,reason] of cases){const v=structuredClone(attrView());mutate(v);refuse('attribution',v,AZ,reason);}
  for(const [mutate,reason] of [[r=>{r.counts[0].portfolio='CH';},'PROVINCE'],[r=>{r.counts[0].portfolio='REGIONE';},'REGIONE_KEY']]){const r=structuredClone(review(AZ));mutate(r);refuse('review',r,AZ,reason);}
  // A budget id names its own unit: admitted for the units that read it, refused for any other audience.
  const re=review(RE);assert.ok(re.budgets.every(b=>b.id.startsWith('asl-4-b-')));
  assert.doesNotThrow(()=>guardCScopedPayload('review',re,RE));
  const az=review(['asl-2','aggregato']);az.budgets=structuredClone(re.budgets).map(b=>({...b,org:'asl-2'}));
  refuse('review',az,AZ,'FOREIGN_UNIT');
});

test('product and portfolio descriptors keep their legitimate tokens, but never a place name',()=>{
  const v=portView();
  assert.ok(JSON.stringify(v).includes(TOKEN_LABEL)&&JSON.stringify(v).includes(TOKEN_ATC));
  assert.match(TOKEN_LABEL,C_PROVINCE_TOKEN);assert.match(TOKEN_ATC,C_PROVINCE_TOKEN);
  assert.doesNotThrow(()=>guardCScopedPayload('portfolio',v,AZ));
  for(const place of ['Prodotto di Pescara','PRODOTTO CHIETI','Prodotto L’Aquila','prodotto laquila','ABRUZZO 1','Vasto','Sant’Omero','Giulianova']){
    assert.match(place,C_PLACE_NAME,place);
    const w=structuredClone(attrView());w.scope.products[0].label=place;refuse('attribution',w,AZ,'PLACE');
  }
  for(const word of ['Avezzanese 1','Vastità','Pescare','Teramolo','Atrio','Ortonale','Chietino'])assert.doesNotMatch(word,C_PLACE_NAME,`${word} is not a place name`);
});

test('client audience: own units, exactly its kind\u2019s capabilities, and the own name as the only exempt string',()=>{
  const az={kind:'azienda',orgCode:'204',orgName:'ASL sintetica di Teramo',unit:'asl-4',units:['asl-4','aggregato']};
  const re={kind:'regione',orgCode:'130',units:['aggregato','asl-1','asl-2','asl-3','asl-4']};
  for(const a of [az,re]){const c=toClientAudience(a);assert.deepEqual(guardCClientAudience(c,a),c);}
  const bad=[
    [az,c=>{c.orgs.push({key:'asl-1',label:'ASL 1'});},'OPTIONS'],[az,c=>{c.orgs[1].label='Azienda di Pescara';},'PLACE'],[az,c=>{c.orgs[0].label='Altra Azienda';},'OWN_LABEL'],
    [az,c=>{c.capabilities.workbook=true;},'CAPABILITY'],[az,c=>{c.extra=1;},'FIELDS'],[az,c=>{c.defaultOrg='aggregato';},'AUDIENCE_SHAPE'],
    [az,c=>{c.budgetOrgs.push({key:'aggregato',label:'Aggregato delle quattro Aziende'});},'OPTIONS'],[re,c=>{c.orgs[1].label='Teramo';},'PLACE'],
    [re,c=>{c.orgs[2].label='TE';},'PROVINCE'],[re,c=>{c.exportLabel+=' · Abruzzo';},'PLACE'],[re,c=>{c.kind='azienda';},'AUDIENCE_SHAPE'],[re,c=>{c.monthlyMode='summed';},'AUDIENCE_SHAPE'],
    // Regional analytical parity: the Regione holds the price/quantity/mix decomposition and nothing else; an Azienda none.
    [az,c=>{c.capabilities.pvm=true;},'CAPABILITY'],[re,c=>{c.capabilities.pvm=false;},'CAPABILITY'],[re,c=>{c.capabilities.evidence=true;},'CAPABILITY'],
    [re,c=>{c.capabilities.workbook=true;},'CAPABILITY'],[re,c=>{c.capabilities.insights=true;},'CAPABILITY'],[re,c=>{c.capabilities.lineage=false;},'CAPABILITY'],[re,c=>{c.capabilities.syntheticBudgets=false;},'CAPABILITY'],
    [az,c=>{c.capabilities.lineage=true;},'CAPABILITY'],[az,c=>{c.capabilities.syntheticBudgets=true;},'CAPABILITY'],
  ];
  for(const [a,mutate,reason] of bad){const c=toClientAudience(a);mutate(c);assert.throws(()=>guardCClientAudience(c,a),new RegExp(`PCS_GUARD_${reason}`),reason);}
});
