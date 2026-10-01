import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {resolveAttention,attentionMatrix,cellProducts,emptyCellMessage} from '../lib/analytics/operational-attention.ts';
import {productAbc} from '../lib/analytics/private-pillar-product.ts';
// Staged private facts, deliberately outside this repository. Tests that need
// them SKIP when absent; they must never report a pass for work not done.
const STAGED=new URL('../private-staging/closure/private-product-facts.json',import.meta.url);
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
// The manifest half needs nothing staged, so it is its own test and always runs.
test('every reference source carries a sha256',()=>{
 const refs=JSON.parse(fs.readFileSync(new URL('../data/derived/operational-attention.json',import.meta.url),'utf8'));
 const sources=Object.values(refs.sources);
 assert.ok(sources.length>0,'a manifest with no sources would pass the loop below vacuously');
 for(const s of sources)assert.match(s.sha256,/^[a-f0-9]{64}$/);
});

// The arithmetic half needs the staged private facts, which are deliberately not
// in this repository. It previously `return`ed when they were absent and reported
// a PASS for arithmetic it had not performed.
test('real authorized-group arithmetic',{skip:!fs.existsSync(STAGED)&&'private-staging/closure/private-product-facts.json not present'},()=>{
 const refs=JSON.parse(fs.readFileSync(new URL('../data/derived/operational-attention.json',import.meta.url),'utf8'));
 const file=STAGED;
 const abc=productAbc(JSON.parse(fs.readFileSync(file,'utf8')));const evidence=resolveAttention(abc,refs);
 for(const key of new Set(abc.map(r=>`${r.org_code}/${r.year}`))){
  const rows=abc.filter(r=>`${r.org_code}/${r.year}`===key);const total=rows.reduce((s,r)=>s+r.cf,0);
  for(const col of attentionMatrix(rows,evidence))assert.ok(Math.abs(col.bands.reduce((s,b)=>s+b.listed.spend+b.not_listed.spend+b.unknown.spend,0)-total)<0.000001);
 }
 console.log('Operational attention:',abc.length,'product rows;',evidence.length,'distinct AICs;',Object.fromEntries(['h','registry','shortage','pht'].map(k=>[k,evidence.filter(e=>e.signals[k].status==='listed').length])));
});

// The drill-down grouping: what a reader actually sees when they open a cell.

const prod=(aic,band,cf)=>({aic,band,cf,atc5:'J01DD04',product_name:'X*1'});
const ev=(aic,status)=>({aic,signals:{h:{status,detail:'d'},registry:{status,detail:'d'},
  shortage:{status,detail:'d'},pht:{status,detail:'d'}}});

test('a cell opens both what is evidenced and what is undetermined',()=>{
 const rows=[prod('000000001','A',10),prod('000000002','A',30),prod('000000003','A',20)];
 const evidence=[ev('000000001','listed'),ev('000000002','unknown'),ev('000000003','not_listed')];
 const {listed,unknown}=cellProducts(rows,evidence,'A','h');
 assert.deepEqual(listed.map(r=>r.aic),['000000001']);
 assert.deepEqual(unknown.map(r=>r.aic),['000000002']);
 // not_listed is in neither: there is nothing to do about a clean negative.
 assert.equal([...listed,...unknown].some(r=>r.aic==='000000003'),false);
});

test('a product with no evidence row at all is undetermined, never negative',()=>{
 const rows=[prod('000000009','A',5)];
 const {listed,unknown}=cellProducts(rows,[],'A','shortage');
 assert.deepEqual(listed,[]);
 assert.deepEqual(unknown.map(r=>r.aic),['000000009']);
});

test('each group is ordered by spend, so the largest unresolved product is first',()=>{
 const rows=[prod('000000001','A',10),prod('000000002','A',900),prod('000000003','A',50)];
 const evidence=rows.map(r=>ev(r.aic,'unknown'));
 assert.deepEqual(cellProducts(rows,evidence,'A','registry').unknown.map(r=>r.cf),[900,50,10]);
});

test('only the selected band is opened',()=>{
 const rows=[prod('000000001','A',10),prod('000000002','B',10),prod('000000003','C',10)];
 const evidence=rows.map(r=>ev(r.aic,'listed'));
 assert.deepEqual(cellProducts(rows,evidence,'B','h').listed.map(r=>r.aic),['000000002']);
});

test('a cell whose products are all negative opens empty rather than misreporting',()=>{
 const rows=[prod('000000001','A',10)];
 const {listed,unknown}=cellProducts(rows,[ev('000000001','not_listed')],'A','h');
 assert.equal(listed.length+unknown.length,0);
});

test('the groups are per indicator, not shared across columns',()=>{
 const rows=[prod('000000001','A',10)];
 const evidence=[{aic:'000000001',signals:{h:{status:'listed',detail:'d'},registry:{status:'unknown',detail:'d'},
   shortage:{status:'not_listed',detail:'d'},pht:{status:'unknown',detail:'d'}}}];
 assert.equal(cellProducts(rows,evidence,'A','h').listed.length,1);
 assert.equal(cellProducts(rows,evidence,'A','registry').unknown.length,1);
 assert.equal(cellProducts(rows,evidence,'A','shortage').listed.length+cellProducts(rows,evidence,'A','shortage').unknown.length,0);
});

// The header count and the opened list are computed by two different functions.
// Nothing forced them to agree until here, and a reader who opens a cell
// labelled "18 non determinati" and counts 17 rows has no way to know which
// number to believe.

const agrees=(rows,evidence)=>{
 for(const col of attentionMatrix(rows,evidence))for(const band of col.bands){
  const g=cellProducts(rows,evidence,band.band,col.key);
  const spend=list=>list.reduce((s,r)=>s+r.cf,0);
  assert.equal(g.listed.length,band.listed.count,`${col.key}/${band.band} listed count`);
  assert.equal(g.unknown.length,band.unknown.count,`${col.key}/${band.band} unknown count`);
  assert.ok(Math.abs(spend(g.listed)-band.listed.spend)<0.000001,`${col.key}/${band.band} listed spend`);
  assert.ok(Math.abs(spend(g.unknown)-band.unknown.spend)<0.000001,`${col.key}/${band.band} unknown spend`);
 }
};

test('the opened list matches the count on the cell that opened it',()=>{
 // A zero-spend product still has to appear: it is a real match to resolve.
 const rows=[prod('000000001','A',900),prod('000000002','A',0),prod('000000003','B',50),
  prod('000000004','B',20),prod('000000005','C',5)];
 agrees(rows,[ev('000000001','listed'),ev('000000002','unknown'),ev('000000003','not_listed'),
  ev('000000004','listed')]);
});

// Previously `return`ed when the staged file was absent -- which it is in this
// repository -- and reported a pass having executed ZERO assertions.
test('drill-down and header agree on every cell of the real staged data',{skip:!fs.existsSync(STAGED)&&'private-staging/closure/private-product-facts.json not present'},()=>{
 const refs=JSON.parse(fs.readFileSync(new URL('../data/derived/operational-attention.json',import.meta.url),'utf8'));
 const file=STAGED;
 const abc=productAbc(JSON.parse(fs.readFileSync(file,'utf8')));
 const evidence=resolveAttention(abc,refs);
 for(const key of new Set(abc.map(r=>`${r.org_code}/${r.year}`)))
  agrees(abc.filter(r=>`${r.org_code}/${r.year}`===key),evidence);
});

// The empty state is the one place the view speaks without data behind it, so
// what it is allowed to say is pinned here rather than left to the JSX.

test('an empty cell never claims an outcome the source did not give',()=>{
 // shortage has no unknown status at all: not_listed IS its no-data bucket, so
 // "all negative" would turn absence from a list into a supply guarantee.
 const s=emptyCellMessage('shortage',true);
 assert.match(s,/non certifica la disponibilità locale/);
 // registry never emits not_listed, so "all negative" is false whenever it renders.
 assert.doesNotMatch(emptyCellMessage('registry',true),/negativ/i);
 // An empty band is said to be empty, not reported as an examined result.
 for(const k of ['h','registry','shortage','pht'])
  assert.match(emptyCellMessage(k,false),/Nessun prodotto in questa banda/);
});
