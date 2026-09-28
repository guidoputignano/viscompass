import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveAttention,attentionMatrix} from '../lib/analytics/operational-attention.ts';
import {productAbc} from '../lib/analytics/private-pillar-product.ts';
const refs={sources:{},h:['000000001'],a:['000000002'],shortage:{'000000001':[{start:'01/01/2026',reason:'Test'}]},registry:[{atc:'J01AA02',name:'BRAND',indication:'Specific indication',kind:'Registro',url:'https://www.aifa.gov.it'}],pht:{'000000001':'yes','000000002':'no'}};
const row=(aic='000000001',extra={})=>({aic,atc5:'J01AA02',product_name:'BRAND*10CPR',org_code:'x',year:2025,cf:100,band:'A',...extra});
test('exact identifiers and unknown are preserved',()=>{
 const result=resolveAttention([row(),row('000000002'),row('000000003')],refs);
 assert.equal(result[0].signals.h.status,'listed');assert.equal(result[1].signals.h.status,'not_listed');assert.equal(result[2].signals.h.status,'unknown');
 assert.equal(result[2].signals.pht.status,'unknown');assert.equal(result[2].signals.shortage.status,'not_listed');
 assert.throws(()=>resolveAttention([row('1')],refs));
});
test('registry requires exact brand and ATC; absent match is not a negative clinical claim',()=>{
 assert.equal(resolveAttention([row()],refs)[0].signals.registry.status,'listed');
 assert.equal(resolveAttention([row('000000002',{product_name:'OTHER*10'})],refs)[0].signals.registry.status,'unknown');
 assert.equal(resolveAttention([row('000000002',{atc5:'J01AA01'})],refs)[0].signals.registry.status,'unknown');
});
test('conflicting classification and product identities remain unknown',()=>{
 assert.equal(resolveAttention([row()],{...refs,a:['000000001']})[0].signals.h.status,'unknown');
 assert.equal(resolveAttention([row(),row('000000001',{atc5:'J01AA01'})],refs)[0].signals.registry.status,'unknown');
});
test('overlap is independent and every column reconciles',()=>{
 const rows=[row(),row('000000002',{cf:50,band:'B'}),row('000000003',{cf:10,band:'C'})];
 for(const col of attentionMatrix(rows,resolveAttention(rows,refs))){
  assert.equal(col.bands.reduce((s,b)=>s+b.listed.spend+b.not_listed.spend+b.unknown.spend,0),160);
  assert.equal(col.bands.reduce((s,b)=>s+b.listed.count+b.not_listed.count+b.unknown.count,0),3);
 }
 assert.throws(()=>attentionMatrix([row(),row('000000002',{org_code:'other'})],[]));
 assert.throws(()=>attentionMatrix([row(),row()],[]));
 assert.equal(attentionMatrix([row()],[])[0].bands[0].unknown.spend,100);
});
test('reference manifest and real authorized-group arithmetic',()=>{
 const refs=JSON.parse(fs.readFileSync(new URL('../data/derived/operational-attention.json',import.meta.url),'utf8'));
 for(const s of Object.values(refs.sources))assert.match(s.sha256,/^[a-f0-9]{64}$/);
 const file=new URL('../private-staging/closure/private-product-facts.json',import.meta.url);
 if(!fs.existsSync(file))return;
 const abc=productAbc(JSON.parse(fs.readFileSync(file,'utf8')));const evidence=resolveAttention(abc,refs);
 for(const key of new Set(abc.map(r=>`${r.org_code}/${r.year}`))){
  const rows=abc.filter(r=>`${r.org_code}/${r.year}`===key);const total=rows.reduce((s,r)=>s+r.cf,0);
  for(const col of attentionMatrix(rows,evidence))assert.ok(Math.abs(col.bands.reduce((s,b)=>s+b.listed.spend+b.not_listed.spend+b.unknown.spend,0)-total)<0.000001);
 }
 console.log('Operational attention:',abc.length,'product rows;',evidence.length,'distinct AICs;',Object.fromEntries(['h','registry','shortage','pht'].map(k=>[k,evidence.filter(e=>e.signals[k].status==='listed').length])));
});
