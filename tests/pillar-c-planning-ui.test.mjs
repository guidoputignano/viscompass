import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {register,createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {buildCAttrPacket} from '../lib/dashboard-review/pillar-c/attribution.ts';
import {buildCPortfolioPacket,cPortfolioView} from '../lib/dashboard-review/pillar-c/portfolio.ts';
import {cPortfolioPlanning} from '../lib/dashboard-review/pillar-c/portfolio-insights.ts';
import {PILLAR_C_SECTIONS,pillarCSectionAtViewport} from '../lib/dashboard-review/pillar-c/section-navigation.ts';
import {C_PERIOD_LABELS} from '../lib/dashboard-review/pillar-c/review.ts';
import {C_PLANNING_GROUP_STATEMENTS,C_PLANNING_LABELS as L,C_PLANNING_MATCHED,C_PLANNING_READING,C_PLANNING_RULE_NOTES,cPlanningSplitStatus,cPlanningStatements,cPlanningAccept,cPlanningCompare,cPlanningCopyLint,cPlanningDossierHref,cPlanningExport,cPlanningExportName,cPlanningFilters,cPlanningMoney,cPlanningNumber,cPlanningPartialText,cPlanningPercentLabel,cPlanningRegroup,cPlanningSearch,cPlanningShareText,cPlanningWorkspace} from '../lib/dashboard-review/pillar-c/planning.ts';
const root=fileURLToPath(new URL('..',import.meta.url));
register('data:text/javascript,'+encodeURIComponent(`
import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';
let sucrase;export function initialize({pkg}){sucrase=createRequire(pkg)('sucrase');}
export async function resolve(specifier,context,next){return next(['next/navigation','next/link'].includes(specifier)?specifier+'.js':specifier,context);}
export async function load(url,context,next){if(url.startsWith('file:')&&url.endsWith('.tsx')){const file=fileURLToPath(url);return{format:'module',source:sucrase.transform(readFileSync(file,'utf8'),{transforms:['typescript','jsx'],jsxRuntime:'automatic',production:true,filePath:file}).code,shortCircuit:true};}return next(url,context);}
`),{data:{pkg:pathToFileURL(`${root}package.json`).href}});
const req=createRequire(`${root}package.json`),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const {CPlanningPanel,cPlanningAddress,cPlanningFieldStep,cPlanningFieldSync,cPlanningFocusFirst,cPlanningNext}=await import('../components/dashboard-review/pillar-c/planning-workspace.tsx');
const {CPortfolioDossierView,cPortfolioPlanningLink}=await import('../components/dashboard-review/pillar-c/portfolio-dossier.tsx');
const {CAttributionView}=await import('../components/dashboard-review/pillar-c/attribution-analysis.tsx');
const reviewer=await (await import('./helpers/pillar-c-audience.mjs')).reviewerAudience(React);
const source=file=>fs.readFileSync(fileURLToPath(new URL(`../${file}`,import.meta.url)),'utf8').replace(/\r\n/g,'\n');
const ui=source('components/dashboard-review/pillar-c/planning-workspace.tsx');

// Synthetic fixture only: invented portfolios, products and small euro values.
const V=[{id:'AA',label:'Area sintetica A (test)',kind:'area_terapeutica'},{id:'BB',label:'Area sintetica B',kind:'area_terapeutica'},{id:'CC',label:'Area sintetica C',kind:'area_terapeutica'},{id:'DD',label:'Categoria sintetica D',kind:'categoria'}];
const r=(key,c,state,candidates,{y=2025,m=3,org='AQ',ch='CO'}={})=>({anno:y,mese:m,asl:org,canale:ch,prodotto_key:key,atc:state==='S5'?'':'TST01',c,attribution_status:state,candidate_portfolios:candidates});
const ROWS=[
  r('100000001','10.5','S2',['AA']),r('100000001','1.5','S2',['AA'],{m:4}),r('100000002','30','S2',['BB']),r('100000003','-5.25','S2',['BB'],{m:7}),
  r('100000004','4','S2',['DD']),r('100000004','-4','S2',['DD'],{m:8}),
  r('200000001','80','S3',['AA','BB']),r('200000001','-10','S3',['BB','AA'],{m:9}),r('200000002','20','S3',['AA','BB','CC']),
  r('200000003','-15','S3',['BB','DD']),r('200000004','7','S3',['CC','DD']),r('200000005','5','S3',['AA','CC']),r('200000005','-9','S3',['AA','CC'],{m:11}),
  r('200000006','3.333','S3',['AA','BB','CC','DD']),r('300000001','2','S4',[]),r('E-synth','6','S5',[]),
  r('100000001','11','S2',['AA'],{y:2024}),r('200000001','40','S3',['AA','BB'],{y:2024}),r('300000001','1','S4',[],{y:2024}),
  r('100000001','3','S2',['AA'],{y:2026,m:2}),r('200000002','1.75','S3',['AA','BB','CC'],{y:2026,m:1}),
  r('100000002','9','S2',['BB'],{org:'TE',y:2024}),r('200000001','4','S3',['AA','BB'],{org:'TE',y:2024}),
];
const packet=buildCAttrPacket(ROWS,V,new Map(ROWS.map(x=>[x.prodotto_key,`Prodotto sintetico ${x.prodotto_key}`])),'1'.repeat(64),'2'.repeat(64),'test-v0.1');
const rawOf=(p,period,org,channel)=>{const find=(a,b,c)=>p.scopes.find(s=>s.period===a&&s.org===b&&s.channel===c)??null;return JSON.parse(JSON.stringify({schema:'pillar-c-attribution-view-v1',sourceSha256:p.sourceSha256,classificationSha256:p.classificationSha256,mappingVersion:p.mappingVersion,sourceSnapshot:'3'.repeat(64),portfolios:p.portfolios,scope:find(period,org,channel),comparison:find(C_PLANNING_MATCHED[period],org,channel)}));};
const views=new Map();
const view=(period='FY2025',org='AQ',channel='CO')=>{const k=`${period}|${org}|${channel}`;if(!views.has(k))views.set(k,cPlanningAccept(rawOf(packet,period,org,channel),period,org,channel));return views.get(k);};
const scope=(period='FY2025',org='AQ',channel='CO')=>`c_port_period=${period}&c_port_org=${org}&c_port_channel=${channel}`;
const ready=(period,org,channel)=>({key:`${period??'FY2025'}|${org??'AQ'}|${channel??'CO'}`,view:view(period,org,channel)});
const html=(search,load,{acts=[],evidence=false}={})=>renderToStaticMarkup(reviewer(React.createElement(CPlanningPanel,{search,load,acts,evidenceAnchor:evidence,onSearch(){},onRetry(){}})));
const text=h=>h.replace(/<[^>]*>/g,' ').replace(/&#x27;/g,'’').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/\s+/g,' ');
const count=(t,s)=>t.split(s).length-1;
const EURO=/\d[\d.,]*\s?€|€\s?\d/;
const engine=(search,period='FY2025',org='AQ',channel='CO')=>cPlanningWorkspace(view(period,org,channel),cPlanningFilters(search).state);
const clean=label=>label.replace(/\s*\([^)]*\)\s*$/,'');
/** The HTML of the element that opens at `start` (an index into h), up to its matching close tag. */
function element(h,start){
  const tag=h.slice(start+1).match(/^[a-z0-9]+/)[0];let depth=0;
  for(const m of h.slice(start).matchAll(new RegExp(`<(/?)${tag}\\b[^>]*?(/?)>`,'g'))){if(m[2])continue;depth+=m[1]?-1:1;if(!depth)return h.slice(start,start+m.index+m[0].length);}
  throw Error(`unclosed ${tag}`);
}
const lane=(h,id)=>element(h,h.lastIndexOf('<article',h.indexOf(`aria-labelledby="${id}"`)));
const figure=(h,label)=>{const at=h.indexOf(`<figure class="mt-4 min-w-0" aria-label="${label}">`);return at<0?null:element(h,at);};
const states={
  observed:`${scope()}&c_plan_ids=AA.BB`,
  variants:`${scope()}&c_plan_ids=AA.BB&c_plan_v1=1000&c_plan_v2=-2000_s500_BB.-100`,
  one:`${scope()}&c_plan_ids=AA.BB&c_plan_v1=1000`,
  eq:`${scope()}&c_plan_ids=AA.BB&c_plan_v1=1000&c_plan_split=eq`,
  eq2:`${scope()}&c_plan_ids=AA.BB&c_plan_v1=1000&c_plan_v2=-2000&c_plan_split=eq`,
  prop:`${scope()}&c_plan_ids=AA.CC&c_plan_split=prop`,
  user:`${scope()}&c_plan_ids=AA.BB&c_plan_v1=250&c_plan_split=user&c_plan_shares=AA-BB-CC.5000_AA-CC-DD.2500`,
  userNone:`${scope()}&c_plan_ids=AA.BB&c_plan_v1=250&c_plan_split=user`,
  nothing:`${scope()}&c_plan_ids=AA.BB.CC.DD&c_plan_v1=1000&c_plan_split=eq`,
  single:`${scope()}&c_plan_ids=CC`,
  partial:`${scope('JM2026')}&c_plan_ids=AA`,
};
const loadOf=name=>ready(...(name==='partial'?['JM2026']:[]));
const all=()=>Object.entries(states).map(([name,search])=>[name,html(search,loadOf(name))]);

test('observed lane: the joint interval and its reference lead, the six-part partition in the registered order, L2 as one line',()=>{
  const h=html(states.observed,ready()),t=text(h),w=engine(states.observed),o=text(lane(h,'scenari-observed-title'));
  assert.match(h,/<section id="scenari" aria-labelledby="scenari-title" class="[^"]*" data-c-planning="v1">/);
  assert.ok(o.includes(`${L.bounds.joint} ${cPlanningMoney(w.observed.lower1)} – ${cPlanningMoney(w.observed.upper1)} ${L.bounds.width}: ${cPlanningMoney(w.observed.width1)}`));
  assert.ok(o.includes(`${L.bounds.reference} ${cPlanningMoney(w.observed.reference)} ${L.bounds.referenceDetail}`),'the reference carries its definition');
  const parts=o.slice(o.indexOf(L.observed.parts)),order=[L.observed.fixed,'Area sintetica A','Area sintetica B',L.observed.inside,L.observed.crossing,L.observed.otherFixed,L.observed.otherShared,L.observed.unattributed,L.observed.total,L.observed.footer].map(s=>parts.indexOf(s));
  assert.ok(order.every((at,i)=>at>=0&&(i===0||at>order[i-1])),`partition order ${order}`);
  assert.match(h,/<details class="[^"]*"><summary class="[^"]*">Composizione della spesa dell’ambito<\/summary>/,'the partition is one click away, collapsed');
  assert.ok(!t.includes('Area sintetica A (test)'),'portfolio labels lose their trailing parenthesis, as in the dossier');
  for(const row of w.partition.rows)assert.ok(o.includes(cPlanningMoney(row.value)),row.key);
  assert.ok(o.includes(`${L.observed.crossingAbs} · ${cPlanningMoney(w.partition.crossingAbs)}`),'absolute exposure is an annotation, not a row of the sum');
  assert.equal(count(t,L.bounds.l2),1,'L2 is one line, never a toggle or a row extension');
  assert.ok(o.includes(`Se anche le voci non attribuite potessero ricadere nel gruppo: ${cPlanningMoney(w.observed.lower2)} – ${cPlanningMoney(w.observed.upper2)}`));
  for(const m of w.members)assert.ok(o.includes(`${clean(m.label)} · ${L.bounds.member} ${cPlanningMoney(m.lower1)} – ${cPlanningMoney(m.upper1)}`),m.id);
  assert.match(h,/<details class="[^"]*"><summary class="[^"]*">Intervalli propri dei portafogli del gruppo<\/summary><div class="[^"]*"><figure class="mt-4 min-w-0" aria-label="Intervallo condizionale di attribuzione">/,'the member chart is one click away, beside the headline');
  assert.ok(t.includes(L.variants.empty),'no variant and no rule: no value under assumption');
  assert.doesNotMatch(h,/data-scenario=/);assert.ok(!t.includes(L.split.statement));assert.ok(!t.includes(L.variants.base),'no variant: nothing to label as the base');
  assert.ok(o.includes(`${C_PERIOD_LABELS.FY2024} · ${L.bounds.joint}`),'the matched period is observed context only');
  assert.match(lane(h,'scenari-observed-title'),new RegExp(`<button type="button" class="[^"]*" aria-controls="scenari-reading">${L.bounds.readThis}</button>`),'the observed interval points to the reading block');
  assert.ok(t.includes(L.section.confidentiality)&&t.includes(L.section.draft));
  assert.match(h,/<button type="button" class="[^"]*" aria-describedby="scenari-confidentiality">.*?Esporta JSON<\/button>/);
  assert.ok(!text(html(states.single,ready())).includes(L.bounds.scale),'a single portfolio needs no member chart: the headline holds the interval');
});

test('UI-15/R3/R4/R5: controls first; one reading block, a pointer to it beside every group interval, captions at the lane head and under every value',()=>{
  for(const [name,h] of all()){
    const t=text(h),results=h.indexOf('data-scope-key=');assert.ok(results>0,name);
    const w=engine(states[name],...(name==='partial'?['JM2026']:[])),shown=cPlanningSplitStatus(w)==='shown',v=w.variants.length,chart=v>1||(shown&&v>0);
    for(const control of ['<select','inputMode="decimal"','type="radio"'].filter(c=>h.includes(c)))assert.ok(h.indexOf(control)<results,`${name}: ${control} precedes the results`);
    const group=h.indexOf('<fieldset'),first=Math.min(...['<button','<select','<input'].map(c=>h.indexOf(c)).filter(i=>i>=0));
    assert.ok(element(h,group).includes(`>${L.group.label}</legend>`)&&first>group&&first<group+element(h,group).length,`${name}: the first control of the section is the group picker`);
    assert.equal(count(h,`>${L.bounds.read}</summary>`),1,`${name}: one reading block`);
    const at=h.lastIndexOf('<details',h.indexOf(`>${L.bounds.read}</summary>`)),block=text(element(h,at));
    assert.ok(h.startsWith('<details id="scenari-reading" ',at)&&at>h.indexOf('aria-labelledby="scenari-observed-title"'),`${name}: the block sits in the observed lane, beside its interval`);
    for(const s of C_PLANNING_READING){assert.equal(count(t,s),1,`${name}: once: ${s}`);assert.ok(block.includes(s),`${name}: inside the block: ${s}`);}
    // R3: a visible pointer to the block beside every group interval: the observed one, each variant's, the base split's, the variants chart.
    assert.equal(count(h,`aria-controls="scenari-reading">${L.bounds.readThis}</button>`),1+v+(shown?1:0)+(chart?1:0),`${name}: one pointer per group interval`);
    for(const x of w.variants)assert.equal(count(element(h,h.lastIndexOf('<article',h.indexOf(`data-scenario="${x.index}"`))),`>${L.bounds.readThis}<`),1,`${name}: ${x.name}`);
    if(shown)assert.equal(count(element(h,h.lastIndexOf('<div',h.indexOf('data-scenario="base-split"'))),`>${L.bounds.readThis}<`),1,`${name}: base split`);
    // R4: the caption, the time reading and the split statement once at the lane head, and in one line under every value and split result.
    assert.equal(count(t,L.variants.scenario),v||w.split?1:0,`${name}: the full caption once, at the head of the assumptions lane`);
    assert.equal(count(t,L.section.duration),v?1:0,`${name}: the time reading at the lane head`);
    assert.equal(count(t,L.variants.compact),v+(chart?1:0),`${name}: one compact caption under each variant's values and under the variants chart`);
    assert.equal(count(t,L.split.statement),shown?2+v+(chart?1:0):0,`${name}: the split statement at the head and under every split result`);
    // R5: the notes on what a split is sit with the split results, and only when a split is shown.
    for(const s of [L.split.inside,L.split.noEffect])assert.equal(count(t,s),shown?1:0,`${name}: ${s}`);
    for(const s of [L.split.inside,L.split.noEffect,L.split.propZero,L.split.propWeights])assert.ok(!block.includes(s),`${name}: no split note in the reading block`);
    if(shown)for(const s of [L.split.inside,L.split.noEffect])assert.ok(text(element(h,h.lastIndexOf('<div',h.indexOf('data-scenario="base-split"')))).includes(s),`${name}: ${s} beside the split`);
  }
  assert.ok(text(html(states.prop,ready())).includes(L.split.propWeights));
  // Size budget of the busiest states (two variants and a rule), as first shown: closed <details> bodies, screen-reader-only text and
  // option lists left out. The layout before the UI-15 fix showed 1,834 words here; the registered captions under every value and
  // split result (R4) add about 160 words to the 975 of the single-block layout.
  const shownWords=h=>text(h.replace(/(<details(?![^>]*\sopen)[^>]*><summary[^>]*>.*?<\/summary>).*?<\/details>/gs,'$1</details>').replace(/<span class="sr-only">.*?<\/span>|<p class="sr-only"[^>]*>.*?<\/p>|<option[^>]*>.*?<\/option>/gs,'')).split(' ').filter(Boolean).length;
  for(const [name,budget] of [['eq2',1200],['user',1200],['observed',620]]){const words=shownWords(html(states[name],ready()));assert.ok(words<budget,`${name}: ${words} words`);}
});

test('a zero single-portfolio net reads «righe assenti o compensate», never as a zero amount',()=>{
  const h=html(`${scope()}&c_plan_ids=CC.DD`,ready()),t=text(h);
  assert.ok(count(t,L.observed.zeroFixed)>=4,'both partition rows and both chart rows');
  assert.doesNotMatch(t,/Area sintetica C 0 €|Categoria sintetica D 0 €/);
  const w=engine(`${scope()}&c_plan_ids=CC.DD`);assert.ok(cPlanningCompare(w.observed.lower1,'0')<0);
  assert.ok(t.includes(L.bounds.legendZero),'a zero line is drawn and named when the plotted values cross zero');
  const two=html(`${scope()}&c_plan_ids=AA.BB&c_plan_v1=1000&c_plan_v2=500`,ready());
  assert.ok(text(figure(two,L.bounds.chip)).includes(L.bounds.legendZero)&&!text(figure(two,L.variants.chip)).includes(L.bounds.legendZero),'each chart draws a zero line only when its own values cross zero');
  assert.ok(text(html(states.observed,ready())).includes(`${L.bounds.scale}: ${cPlanningMoney(engine(states.observed).members[0].lower1)} – `),'positions, not lengths: the scale spans the plotted values');
  // R8: a one-portfolio group with F_p = 0 heads with the zero reading, in the observed lane and in every variant card, never «0 €».
  const one=html(`${scope()}&c_plan_ids=CC&c_plan_v1=1000_s0&c_plan_v2=500`,ready()),obs=text(lane(one,'scenari-observed-title'));
  assert.ok(engine(`${scope()}&c_plan_ids=CC`).observed.referenceZero);
  assert.ok(obs.includes(`${L.bounds.reference} ${L.observed.zeroFixed} ${L.bounds.referenceDetail}`)&&!obs.includes(`${L.bounds.reference} 0 €`),'observed headline');
  for(const i of [1,2]){const c=text(element(one,one.lastIndexOf('<article',one.indexOf(`data-scenario="${i}"`))));assert.ok(c.includes(`${L.variants.reference} ${L.observed.zeroFixed} ${L.bounds.referenceDetail}`)&&!c.includes(`${L.variants.reference} 0 €`),`Variante ${i}`);}
  assert.ok(text(lane(html(states.observed,ready()),'scenari-observed-title')).includes(`${L.bounds.reference} ${cPlanningMoney(engine(states.observed).observed.reference)}`),'a non-zero reference is an amount');
});

test('variants: each card heads with the part that does not depend on the split, its definition, the interval, the effect and «Non variano»',()=>{
  const h=html(states.variants,ready()),t=text(h),w=engine(states.variants);
  assert.equal(w.variants.length,2);
  assert.match(h,/data-scenario="1" data-bps="1000"/);assert.match(h,/data-scenario="2" data-bps="-2000"/);
  for(const v of w.variants){
    const c=text(element(h,h.lastIndexOf('<article',h.indexOf(`data-scenario="${v.index}"`))));
    assert.equal(L.variants.reference,`${L.bounds.reference} · sotto ipotesi`,'the registered name of F′_Q + I′_Q');
    assert.ok(c.includes(`${L.variants.reference} ${cPlanningMoney(v.bounds.reference)} ${L.bounds.referenceDetail}`),v.name);
    assert.ok(c.includes(`${L.variants.interval} ${cPlanningMoney(v.bounds.lower1)} – ${cPlanningMoney(v.bounds.upper1)}`),v.name);
    const e=cPlanningMoney(v.effect.reference);assert.ok(c.includes(`${L.variants.effect} ${e.startsWith('-')?e:`+${e}`}`),v.name);
    assert.ok(c.includes(L.variants.unvaried),`${v.name}: «Non variano» on every card`);
    assert.ok(!c.includes(L.variants.scenario)&&c.includes(L.variants.compact),`${v.name}: the full caption heads the lane; the card carries the compact one`);
  }
  assert.equal(count(t,L.variants.unvaried),2);
  const a=text(lane(h,'scenari-variants-title'));assert.ok(a.includes(`${L.variants.scenario} ${L.section.duration}`),'one caption for the lane, with the time reading');
  assert.ok(t.includes(`${L.variants.source} · ${L.variants.fixedPart}: +10% · ${L.variants.sharedPart}: +10%`));
  assert.ok(t.includes(`${L.variants.source} · ${L.variants.fixedPart}: -20% · Area sintetica B: -1% · ${L.variants.sharedPart}: +5%`),'advanced values are printed next to the result');
  assert.ok(text(lane(h,'scenari-observed-title')).includes(L.variants.base),'with variants, the observed lane is labelled as the base');
  assert.match(h,/<details class="[^"]*"><summary class="[^"]*">Ipotesi avanzate<\/summary>/,'advanced assumptions start collapsed');
  assert.equal(count(t,L.observed.total),1,'the scope total appears once, in the observed lane only');
  assert.doesNotMatch(t,/Ripeti la variazione|punti base|20(26|27)\b/,'no preset, no basis points, no calendar-year reference');
  assert.match(h,/<input class="[^"]*h-11[^"]*" id="[^"]+" inputMode="decimal"[^>]*value="10"/,'the percent field shows the declared value');
  assert.doesNotMatch(h,new RegExp(L.variants.add),'at most two variants');
  assert.match(html(states.observed,ready()),new RegExp(L.variants.add));
});

test('UI-01/UI-02: a declared split never sits under the observed base, and no chart mixes the observed and the assumption layers',()=>{
  for(const name of ['eq','eq2','prop','user']){
    const h=html(states[name],ready()),w=engine(states[name]),observed=lane(h,'scenari-observed-title');
    assert.ok(!text(observed).includes(L.split.result),`${name}: no split in the observed lane`);
    assert.doesNotMatch(observed,/rotate-45|inset-y-1\.5 rounded-sm/,`${name}: no split marker in the observed chart`);
    const base=element(h,h.lastIndexOf('<div',h.indexOf('data-scenario="base-split"'))),tb=text(base);
    assert.ok(tb.startsWith(` ${L.split.baseTitle} ${L.split.rule}: ${L.split[w.split.rule]} `),`${name}: the block is headed as an assumption on the observed spend`);
    assert.ok(!tb.includes(L.variants.base),`${name}: «Base osservata (nessuna ipotesi)» never heads a split`);
    assert.ok(tb.includes(`${L.bounds.observedJoint} ${cPlanningMoney(w.observed.lower1)} – ${cPlanningMoney(w.observed.upper1)}`),`${name}: the split is never shown without its interval, named as observed (R7)`);
    assert.equal(L.bounds.observedJoint,'Intervallo congiunto del gruppo · spesa osservata');assert.ok(!tb.includes(L.bounds.interval),`${name}: no unlabelled interval in the assumptions lane`);
    const own=figure(base,L.split.baseTitle);assert.ok(own,`${name}: the base split has its own chart`);assert.equal(count(own,'<li class="min-w-0">'),1);
    const variants=figure(h,L.variants.chip);
    if(variants){
      const tv=text(variants);
      for(const label of [L.bounds.interval,L.bounds.joint,L.variants.base,L.bounds.member])assert.ok(!tv.includes(label),`${name}: no observed bar on the variants' scale (${label})`);
      assert.ok(!tv.includes(`${cPlanningMoney(w.observed.lower1)} – ${cPlanningMoney(w.observed.upper1)}`)||w.variants.some(v=>v.bounds.lower1===w.observed.lower1),`${name}: no observed interval in the assumptions chart`);
      assert.equal(count(variants,'<li class="min-w-0">'),w.variants.length);
    }
  }
  for(const h of [html(states.observed,ready()),html(states.variants,ready())]){
    const o=figure(lane(h,'scenari-observed-title'),L.bounds.chip);assert.ok(o);assert.doesNotMatch(text(o),/Variante \d/,'the observed chart holds no variant');
  }
  assert.ok(figure(html(states.variants,ready()),L.variants.chip),'two variants are compared on one chart of their own');
  assert.equal(figure(html(states.one,ready()),L.variants.chip),null,'one variant without a split needs no chart: its card holds the numbers');
});

test('split rules: the declared split is drawn inside its own interval, labelled as an assumption with its registered note',()=>{
  const eq=html(states.eq,ready()),te=text(eq),w=engine(states.eq);
  assert.equal(w.split.observed.complete,true);
  assert.ok(te.includes(`${L.split.result}: ${cPlanningMoney(w.split.observed.lower)} ${L.split.statement} ${L.split.point}`),'the base block: label, single value, its statement, coverage');
  assert.ok(text(element(eq,eq.lastIndexOf('<article',eq.indexOf('data-scenario="1"')))).includes(`${L.split.result} ${cPlanningMoney(w.split.variants[0].lower)} ${L.split.statement}`),'the statement under the variant card split');
  assert.ok(text(element(eq,eq.lastIndexOf('<article',eq.indexOf('data-scenario="1"')))).includes(`${L.split.result} ${cPlanningMoney(w.split.variants[0].lower)}`),'the variant card: the split beside its own interval');
  assert.equal(count(te,L.split.point),1,'the coverage note is the same for every column and is printed once');
  for(const s of [C_PLANNING_RULE_NOTES.eq,L.split.statement,L.split.inside,L.split.noEffect,L.split.point])assert.ok(te.includes(s),s);
  assert.match(eq,/<input type="radio" class="[^"]*" name="[^"]+-rule" checked="" value="eq"\/>/);assert.equal((eq.match(/type="radio"[^>]*checked=""/g)??[]).length,1,'one rule at a time; none is pre-selected');
  assert.match(html(states.observed,ready()),/name="[^"]+-rule" checked="" value="none"/,'the default is «Nessuna ripartizione (solo intervallo)»');
  // The marker sits inside the drawn interval of its own row, at the position of the exact split value (one linear scale per chart).
  const rows=[...eq.matchAll(/<li class="min-w-0">(.*?)<\/li>/g)].map(m=>m[1]).filter(x=>x.includes('rotate-45'));
  const expected=[[w.observed,w.split.observed],[w.variants[0].bounds,w.split.variants[0]]].map(([b,s])=>(cPlanningNumber(s.lower)-cPlanningNumber(b.lower1))/(cPlanningNumber(b.upper1)-cPlanningNumber(b.lower1)));
  assert.equal(rows.length,2,'the base block and the variant chart each carry the declared split');
  rows.forEach((row,i)=>{const lefts=[...row.matchAll(/left:([\d.]+)%/g)].map(m=>Number(m[1]));const [lo,hi]=[lefts[1],lefts[2]],band=Number(row.match(/rotate-45[^"]*" style="left:([\d.]+)%/)[1]);
    assert.ok(lo<=band&&band<=hi,`${lo} ≤ ${band} ≤ ${hi}`);assert.ok(Math.abs((band-lo)/(hi-lo)-expected[i])<1e-6,`row ${i}: marker at the split value`);});
  assert.doesNotMatch(rows[0],/rounded-full bg-foreground/,'no observed reference dot beside the split at the base');
  const prop=text(html(states.prop,ready())),wp=engine(states.prop);
  assert.equal(wp.split.observed.complete,false);
  for(const s of [C_PLANNING_RULE_NOTES.prop,L.split.propZero,L.split.propWeights,L.split.partial,L.split.uncoveredOne])assert.ok(prop.includes(s),s);
  assert.ok(prop.includes(`${L.split.result}: ${cPlanningMoney(wp.split.observed.lower)} – ${cPlanningMoney(wp.split.observed.upper)}`),'an uncovered entry keeps its range');
  const user=html(states.user,ready()),tu=text(user),wu=engine(states.user);
  assert.ok(tu.includes(C_PLANNING_RULE_NOTES.user)&&tu.includes(L.split.userUnset)&&tu.includes(L.split.unused));
  assert.deepEqual(wu.split.unusedShares,['AA+CC+DD']);
  assert.match(user,/value="50"/,'the declared share for the set is shown');
  const inputs=[...user.matchAll(/<span class="sr-only"> · Insieme di candidati: ([^<]+)<\/span>/g)].map(m=>m[1]);
  assert.deepEqual(inputs,wu.crossingSets.map(s=>s.candidates.map(c=>clean(V.find(p=>p.id===c).label)).join(' · ')),'one labelled share per crossing candidate set, ranked by exposure');
  assert.match(user,/inset-y-1\.5 rounded-sm border-2/,'an incomplete split is a band, still an interval');
  for(const h of [eq,user])assert.ok(text(h).includes(L.split.statement));
  assert.doesNotMatch(text(html(states.variants,ready())),new RegExp(`${L.split.result}:`),'no split result without a rule');
});

test('UI-08: nothing to split, or a rule that covers nothing, shows no split figure and no marker',()=>{
  const w=engine(states.nothing);assert.equal(w.partition.crossingEntries,0);assert.equal(w.split.observed.complete,true,'the engine still returns a band');
  const n=html(states.nothing,ready()),tn=text(n);
  assert.ok(tn.includes(L.split.nothing));assert.equal(L.split.nothing,'Nessuna voce condivisa con portafogli fuori dal gruppo: non c’è nulla da ripartire.');
  const wu=engine(states.userNone);assert.ok(wu.partition.crossingEntries>0);assert.equal(wu.split.observed.covered.entries,0);
  const u=html(states.userNone,ready()),tu=text(u);
  assert.ok(tu.includes(L.split.noneCovered)&&tu.includes(L.split.userUnset));
  for(const [name,h,t] of [['nothing',n,tn],['userNone',u,tu]]){
    assert.doesNotMatch(t,new RegExp(`${L.split.result}(:| \\d)`),`${name}: no split figure`);
    assert.ok(!t.includes(L.split.point)&&!t.includes(L.split.statement),`${name}: no «valore unico» and no split caption`);
    assert.ok(!t.includes(L.split.inside)&&!t.includes(L.split.noEffect),`${name}: R5: no note on a split that is not shown`);
    assert.doesNotMatch(h,/data-scenario="base-split"|rotate-45|inset-y-1\.5 rounded-sm/,`${name}: no split block or marker`);
    assert.match(h,/data-scenario="1"/,`${name}: the variant itself still shows`);
  }
  assert.doesNotMatch(n,/Insieme di candidati/,'no share editor without crossing sets');
});

test('error, loading, unknown-portfolio and stale states show truthful copy and no euro figure',()=>{
  const k='FY2025|AQ|CO';
  const cases={
    loading:[states.observed,null,L.section.loading],
    unavailable:[states.observed,{key:k,error:'unavailable'},L.section.unavailable],
    forbidden:[states.observed,{key:k,error:'forbidden'},L.section.forbidden],
    staleKey:[`${scope('FY2025','CH')}&c_plan_ids=AA`,ready(),L.section.loading],
    staleView:[`${scope('FY2025','CH')}&c_plan_ids=AA`,{key:'FY2025|CH|CO',view:view()},L.section.unavailable],
    staleError:[states.observed,{key:'FY2025|CH|CO',error:'forbidden'},L.section.loading],
    unknown:[`${scope()}&c_plan_ids=ZZ`,ready(),L.section.unknownPortfolio],
  };
  for(const [name,[search,load,message]] of Object.entries(cases)){
    const h=html(search,load),t=text(h);
    assert.ok(t.includes(message),name);
    assert.doesNotMatch(t,EURO,`${name}: no euro figure`);
    assert.doesNotMatch(h,/data-scope-key|data-scenario/,`${name}: no result container`);
    assert.ok(t.includes(L.outside.title)&&t.includes(L.notComputed.title),`${name}: the strip and the limits stay`);
    assert.match(h,/<button type="button" class="[^"]*" disabled="" aria-describedby="scenari-confidentiality">/,`${name}: nothing to export`);
  }
  assert.ok(text(html(states.observed,{key:k,error:'forbidden'})).includes(L.section.unavailable));
  assert.doesNotMatch(html(states.observed,{key:k,error:'forbidden'}),new RegExp(`>${L.section.retry}<`),'no retry for a session that is not entitled');
  assert.match(html(states.observed,{key:k,error:'unavailable'}),new RegExp(`>${L.section.retry}<`));
  assert.match(html(states.observed,null),/<div role="status"/);
  const bad=text(html(`${scope()}&c_plan_ids=AA&c_plan_v1=1.5`,ready()));
  assert.ok(bad.includes(L.section.invalidUrl),'an invalid assumption in the address is announced and ignored');
  // The client container: fetch for the inherited scope, accept only the echoed scope, and render under the same key.
  assert.match(ui,/fetch\(`\/api\/pillar-c\/attribution\?\$\{new URLSearchParams\(\{ period, org, channel \}\)\}`, \{ signal: controller\.signal, cache: "no-store", credentials: "same-origin" \}\)/);
  assert.match(ui,/return \{ key, view: cPlanningAccept\(await response\.json\(\), period, org, channel\) \};/);
  assert.match(ui,/if \(response\.status === 403\) return \{ key, error: "forbidden" \};/);
  assert.match(ui,/const view = load && load\.key === scopeKey && "view" in load \? load\.view : null;/);
  assert.match(ui,/if \(!r\.key\.startsWith\(`\$\{scopeKey\}\|`\)\) return \{ status: "failed" \};/);
  assert.match(ui,/return \(\) => \{ active = false; controller\.abort\(\); \};/,'a late response for an earlier scope is discarded');
});

test('the January–May banner names its base period and is not annualised; full years carry none',()=>{
  const t=text(html(states.partial,ready('JM2026')));
  assert.equal(cPlanningPartialText('JM2026'),`${C_PERIOD_LABELS.JM2026} ${L.section.partial}`);assert.equal(cPlanningPartialText('JM2025'),`${C_PERIOD_LABELS.JM2025} ${L.section.partial}`);
  assert.ok(t.includes('Gen–mag 2026 (parziale, 5 mesi): valori riferiti a cinque mesi, non annualizzati, da non confrontare con importi annuali.'));
  for(const p of ['FY2024','FY2025'])assert.equal(cPlanningPartialText(p),null);
  assert.doesNotMatch(text(html(states.observed,ready())),/parziale, 5 mesi/);
  assert.ok(text(html(`${states.partial}&c_plan_v1=500`,ready('JM2026'))).includes(L.section.duration),'values under a variant carry the time reading');
});

test('the planning section carries only allowlisted data-* attributes, never an amount, and no regional forecast data',()=>{
  const ALLOWED=new Set(['data-c-planning','data-scope-key','data-scenario','data-bps']);
  for(const [name,h] of [...all(),['error',html(states.observed,{key:'FY2025|AQ|CO',error:'unavailable'})]]){
    const attrs=[...h.matchAll(/\s(data-[a-z0-9-]+)="([^"]*)"/g)];
    assert.ok(attrs.length>0,name);
    for(const [,a,v] of attrs){
      assert.ok(ALLOWED.has(a),`${name}: ${a}`);
      if(a==='data-bps')assert.match(v,/^-?\d+$/);
      if(a==='data-scope-key')assert.match(v,/^(FY|JM)20\d\d\|(Regione|AQ|CH|PE|TE)\|(Tutti|CO|DD|DPC)\|[A-Z0-9.]+$/);
      if(a==='data-scenario')assert.match(v,/^(1|2|base-split)$/);
    }
    for(const [,v] of h.matchAll(/\s(?:aria-label|title|id|for)="([^"]*)"/g))assert.doesNotMatch(v,EURO,`${name}: no amount in an attribute`);
    assert.doesNotMatch(h,/regional_public_forecast|data-scope=|data-forecast|Previsione 2026|Intervallo 80|Intervallo 95|PillarCForecast/,name);
    const strip=text(h.slice(h.indexOf('id="scenari-outside-title"')));
    assert.doesNotMatch(strip,EURO,`${name}: the strip has no amount`);assert.ok(strip.includes('previsione regionale, non aziendale'));
  }
  // Source isolation: no forecast, budget-row or review-selection code is imported or named by the workspace or the engine.
  for(const file of ['components/dashboard-review/pillar-c/planning-workspace.tsx','lib/dashboard-review/pillar-c/planning.ts'])
    assert.doesNotMatch(source(file),/CForecast|selectCForecast|parseCForecast|regional-forecast|forecast-section|CBudget|selectCReview|localStorage|sessionStorage|indexedDB/,file);
  assert.doesNotMatch(ui,/\bdemo\b|dimostra|verificat/i,'never a demo, never a verification claim');
  assert.doesNotMatch(Object.values(L).flatMap(g=>Object.values(g).flat()).join(' '),/verificat|\bdemo\b/i,'no label claims a verification');
  const workspace=source('components/dashboard-review/pillar-c/analytical-workspace.tsx');
  // 1.2b: the Spazio scenari sits in section 5 «Budget e scenari», after the budget panel and before the CO count
  // scenario; the dossier moved to section 3, before the spend block of section 4.
  const at=s=>{const i=workspace.indexOf(s);assert.ok(i>=0,s);assert.equal(workspace.indexOf(s,i+1),-1,`${s} occurs once`);return i;};
  const mount='<PillarCPlanningWorkspace publishedActs={publishedActs} evidenceAnchor={Boolean(workbook)}/>';
  assert.ok(at('<section id="pianificazione"')<at(mount)&&at(mount)<at('<section id="numerosita"'),'Spazio scenari in section 5 after the budget panel, with only the act keys');
  assert.ok(at('<PillarCPortfolioDossier workbook={workbook} />')<at('<section id="spesa"'),'the dossier precedes the spend block');
  assert.match(workspace,/const publishedActs = useMemo\(\(\) => \[\.\.\.new Set\(packet\.budgets\.filter\(b => b\.basis === "published" && b\.level === "Dipartimento"\)\.map\(b => `\$\{b\.org\}\|\$\{b\.period\}\|\$\{b\.channel\}`\)\)\], \[packet\]\);/,'keys only, never a budget row or amount');
  assert.equal((workspace.match(/PillarCPlanningWorkspace/g)??[]).length,2,'imported once, mounted once');
});

test('«Fuori da questa sezione»: status lines keyed on org|period|channel, links only, no amount',()=>{
  const acts=['TE|FY2024|CO','TE|FY2024|DD'];
  const te=text(html(`${scope('FY2024','TE','Tutti')}&c_plan_ids=AA`,null,{acts}));
  assert.ok(te.includes(L.outside.budgetAct));assert.match(html(`${scope('FY2024','TE','Tutti')}`,null,{acts}),/href="#pianificazione"/);
  const reg=text(html(`${scope('FY2024','Regione','Tutti')}`,null,{acts}));
  assert.ok(reg.includes(`${L.outside.budgetWithin} ASL 4. ${L.outside.budgetWithinNote}`));
  const none=html(`${scope('FY2025','AQ','CO')}`,null,{acts});
  assert.ok(text(none).includes(L.outside.budgetNone));assert.doesNotMatch(none,/href="#pianificazione"/);
  for(const h of [none,html(states.observed,ready())]){assert.match(h,/href="#previsione"/);for(const s of [L.outside.regional,L.outside.noLocalForecast,L.outside.selection])assert.ok(text(h).includes(s));}
  assert.ok(text(html(states.observed,ready(),{acts:['Regione|FY2024|CO']})).includes(L.outside.regional),'a malformed act key never breaks the strip');
});

test('UI-10: the crossing-entry ranking says it is computed on the observed base, reads «fino a» and links to the queue only when it exists',()=>{
  const w=engine(states.observed),h=html(states.observed,ready()),t=text(h),card=text(lane(h,'scenari-ranking-title'));
  assert.ok(card.startsWith(` ${L.ranking.title} ${L.ranking.base} `),'the layer of the ranking is stated under its title');
  assert.ok(L.ranking.base.startsWith('Calcolata sulla spesa osservata, non sulle varianti'));
  assert.ok(text(lane(html(states.eq2,ready()),'scenari-ranking-title')).includes(`${L.bounds.width}: ${cPlanningMoney(w.observed.width1)}`),'under variants the amounts stay those of the observed base');
  assert.ok(w.ranking.count>0);
  assert.match(h,new RegExp(`<details class="[^"]*"><summary class="[^"]*"><span>${L.ranking.show} · ${w.ranking.count} voci prodotto</span></summary>`),'the review order is one click away');
  for(const row of w.ranking.rows){assert.ok(t.includes(`${row.rank}. ${row.label} ${L.ranking.reduction} ${cPlanningMoney(row.abs)}`),row.key);assert.ok(t.includes(`${L.ranking.cumulative}: ${cPlanningShareText(row.cumulative,w.ranking.total)}`));}
  for(const s of [L.ranking.note,L.ranking.organisational,L.ranking.order])assert.ok(t.includes(s));
  assert.doesNotMatch(h,/href="#evidence-workflow"/);assert.match(html(states.observed,ready(),{evidence:true}),/<a href="#evidence-workflow"[^>]*>Apri le verifiche/);
  assert.ok(text(html(`${scope()}&c_plan_ids=AA.BB.CC.DD`,ready())).includes(L.ranking.empty),'the full vocabulary has nothing left to narrow');
  assert.equal(cPlanningShareText('1','3'),'33,3%');assert.equal(cPlanningShareText('2','3',2),'66,67%');assert.equal(cPlanningShareText('1','0'),null);assert.equal(cPlanningShareText('-1','-8'),'12,5%');assert.equal(cPlanningShareText('1/3','1'),'33,3%');
});

test('copy lint passes on every rendered state; the contract statements appear verbatim',()=>{
  for(const [name,h] of [...all(),['error',html(states.observed,{key:'FY2025|AQ|CO',error:'forbidden'})],['acts',html(`${scope('FY2024','Regione','Tutti')}`,null,{acts:['TE|FY2024|CO']})]])
    assert.deepEqual(cPlanningCopyLint(h),[],name);
  for(const s of [L.split.baseTitle,L.split.nothing,L.split.noneCovered,L.ranking.base,L.ranking.show,L.observed.parts,L.bounds.read,L.bounds.readThis,L.bounds.observedJoint,L.group.commit,L.section.dossierLinkWith,L.section.dossierReplaces,L.section.separation,L.variants.compact,L.variants.reference])assert.deepEqual(cPlanningCopyLint(s),[],s);
  // PC-08-A12 item 5 and A13 item 4, as registered (straight apostrophes in the contract, the house apostrophe here).
  const contract=["Gli estremi dei singoli portafogli non sono raggiungibili contemporaneamente, e quelli del gruppo non lo sono insieme a quelli dei portafogli fuori dal gruppo.","In ogni ripartizione possibile, il gruppo e gli altri portafogli ricevono insieme esattamente la spesa a portafoglio singolo e la spesa condivisa dell'ambito.","La parte del gruppo che non dipende dalla ripartizione è sempre compresa nell'intervallo del gruppo.","Intervallo condizionale: non è un intervallo di confidenza e non esprime una probabilità.","Sommare gli intervalli dei singoli portafogli conta più volte le voci condivise fra portafogli del gruppo; l'intervallo del gruppo le conta una volta.","Gli arrotondamenti possono non sommare.","Mappatura terapeutica in bozza (v0.1): la parte a portafoglio singolo è un raggruppamento per ATC, non un'attribuzione clinica; la sensibilità alla mappatura non è valutata."];
  const q=s=>s.replace(/'/g,'’');
  assert.deepEqual(C_PLANNING_GROUP_STATEMENTS,contract.map(q));
  for(const [label,expected] of [[L.variants.scenario,"Scenario (ipotesi dichiarata) — non è una previsione né un dato osservato; nessuna probabilità associata. Non è un budget, un tetto o un risparmio."],[L.variants.effect,"Effetto dell'ipotesi rispetto alla spesa osservata del periodo di base, non risparmio"],[L.variants.unvaried,"Non variano: la parte a portafoglio singolo degli altri portafogli, la spesa condivisa solo fra altri portafogli e le voci non attribuite."],[L.variants.base,"Base osservata (nessuna ipotesi)"],[L.variants.advanced,"Ipotesi avanzate"],[L.bounds.reference,"Parte del gruppo che non dipende dalla ripartizione"],[L.split.result,"Ripartizione dichiarata (ipotesi)"],[L.split.none,"Nessuna ripartizione (solo intervallo)"],[L.split.eq,"Quote uguali fra i candidati"],[L.split.prop,"In proporzione alla parte a portafoglio singolo osservata nello stesso ambito"],[L.split.user,"Quota del gruppo scelta dall'utente per insieme di candidati"],[L.split.partial,"Voci che restano non ripartite: mantengono il loro intervallo"],[L.split.statement,"Ripartizione dichiarata (ipotesi): non è un dato osservato né un'attribuzione clinica e non esprime una probabilità."],[C_PLANNING_RULE_NOTES.eq,"Quote uguali fra i candidati: un riferimento aritmetico, non un'evidenza."],[C_PLANNING_RULE_NOTES.prop,"Quote proporzionali alla parte a portafoglio singolo osservata in questo ambito: un riferimento aritmetico, non un'evidenza; non additiva tra Aziende e canali."],[C_PLANNING_RULE_NOTES.user,"Quote scelte dall'utente: nessuna evidenza le sostiene."],[L.ranking.title,"Revisione delle indicazioni del prodotto: riduzione massima dell'intervallo del gruppo"],[L.observed.zeroFixed,"Nessun importo netto a portafoglio singolo (righe assenti o compensate)"],[L.section.unavailable,"L'analisi non è disponibile per questa selezione. Nessun valore viene sostituito con zero."],[L.outside.title,"Fuori da questa sezione"],[L.section.confidentiality,"Riservato ai revisori del progetto · contiene aggregati di più Aziende"],[L.bounds.read,"Come leggere questi valori"],[L.split.baseTitle,"Ripartizione dichiarata (ipotesi) sulla spesa osservata"],
    // Added by the dated correction of 2026-10-19 (A12 items 5 and 6, A13 item 4).
    [L.bounds.readThis,"Come leggere questo intervallo"],[L.variants.compact,"Scenario (ipotesi dichiarata), per un periodo della stessa durata del periodo di base: non è una previsione né un dato osservato."],[L.bounds.observedJoint,"Intervallo congiunto del gruppo · spesa osservata"]])
    assert.equal(label,q(expected));
  assert.ok(L.observed.footer.startsWith(q("Le parti sommano al totale dell'ambito (verifica esatta)")));
  assert.ok(L.bounds.l2.startsWith('Se anche le voci non attribuite potessero ricadere nel gruppo:'));
  for(const [k,s] of Object.entries({fixed:'Portafogli del gruppo · parte a portafoglio singolo',inside:'Resta nel gruppo in ogni ripartizione',crossing:'Condivisa con portafogli fuori dal gruppo',otherFixed:'Altri portafogli · parte a portafoglio singolo',otherShared:'Condivisa solo fra altri portafogli',unattributed:'Non attribuita'}))assert.equal(L.observed[k],s);
  for(const layer of ['Budget approvato','Spesa rendicontata osservata','Valori sotto ipotesi','Contesto regionale'])assert.ok(text(html(states.observed,ready())).includes(layer),layer);
  assert.ok(L.section.durationInline==='per un periodo della stessa durata del periodo di base');
});

test('translation safety: every changing text is its own keyed element; no mixed text nodes; 375 px layout',()=>{
  for(const [name,h] of all()){
    assert.doesNotMatch(h,/<!-- -->/,`${name}: no text node shares an element with changing text`);
    for(const cls of h.matchAll(/class="([^"]*)"/g))for(const token of cls[1].split(/\s+/)){
      const px=token.match(/^(?:min-)?w-\[(\d+)px\]$/);assert.ok(!px||Number(px[1])<=343,`${name}: ${token}`);
      assert.doesNotMatch(token,/^(?:min-)?w-(?:96|\[\d+rem\])$|^min-w-\[/,`${name}: ${token}`);
    }
    const fields=[...h.matchAll(/<(select|input) class="([^"]*)"/g)];assert.ok(fields.length>0,name);
    for(const sel of fields)assert.match(sel[2],/\bh-11\b/,`${name}: ${sel[1]} is 44 px high`);
    assert.doesNotMatch(h,/NaN|Infinity|undefined|\[object/,name);
  }
  // Source pins: a text expression that closes an element is either a constant label or rendered through <Live>.
  // The audience's export label and the refusal text chosen from the audience are constants of the page (recommendation 5).
  const loose=[...ui.matchAll(/\{([^{}<>]+)\}<\/([A-Za-z]+)>/g)].filter(([,expr,tag])=>tag!=='Live'&&tag!=='option'&&!/^L\.[A-Za-z.]+$/.test(expr.trim())&&!['children','audience.exportLabel','forbidden'].includes(expr.trim()));
  assert.deepEqual(loose.map(m=>m[0]),[]);
  assert.match(ui,/function Live\(\{ children, className \}: \{ children: string; className\?: string \}\) \{ return <span key=\{children\} className=\{className\}>\{children\}<\/span>; \}/);
  assert.match(ui,/: <div key=\{ready\.r\.key\} className="space-y-4" data-scope-key=\{ready\.r\.key\}>/,'a new scope or group replaces the result block whole');
});

test('UI-12: one persistent polite region, outside the keyed result block, announces each committed recalculation once',()=>{
  for(const [name,h] of all()){
    const live=h.indexOf('<p class="sr-only" role="status">'),block=h.indexOf('data-scope-key=');
    assert.ok(live>0&&live<h.lastIndexOf('<div',block),`${name}: the region precedes the keyed block and is not inside it`);
    assert.match(h,/<p class="sr-only" role="status"><\/p>/,`${name}: nothing is announced for the first render of an address`);
    assert.match(h,/<p role="status" class="text-xs text-destructive"><\/p>/,`${name}: the export-failure region is always present, empty until a failure`);
  }
  assert.match(html(states.observed,null),/<p class="sr-only" role="status"><\/p>/,'the region exists before any result');
  // The announcement is keyed by the address, so a new commit replaces its node even when the text repeats, and it shows only
  // after the commit's own address has rendered (never the stale result of the previous one).
  assert.match(ui,/<p className="sr-only" role="status">\{announcement && <Live key=\{search\}>\{announcement\}<\/Live>\}<\/p>/);
  assert.ok(ui.includes('const announcement = ready && announceAfter !== null && announceAfter === search.replace(/^\\?/, "") ? `${L.section.updated}: '),'announced only for the address this workspace wrote');
  assert.ok(ui.includes('const commit = (next: string, mode: Mode, target: Focus = null, change?: CPlanningAddressChange) => { if (next.replace(/^\\?/, "") === address.current()) return; focus.current = target; setAnnounceAfter(next.replace(/^\\?/, "")); address.write(next, change); onSearch(next, mode); };'));
  for(const change of ['cPlanningRegroup(p, [...p.ids, id]), "replace", "group")','cPlanningRegroup(p, p.ids.filter(x => x !== id)) : p, "replace", "group")','onRule={rule => apply(p => ({ ...p, rule }), "replace")}','return { ...p, shares }; }, "replace")','variants: p.variants.map((x, j) => j === i ? change(x) : x) }), "replace")'])assert.ok(ui.includes(change),change);
  assert.match(ui,/<p role="status" className="text-xs text-destructive">\{exportFailures > 0 && <Live key=\{exportFailures\}>\{L\.section\.exportFailed\}<\/Live>\}<\/p>/,'each failure is announced again');
});

test('UI-14: percent fields keep help and error outside the label, describe the input, and commit only on blur or Enter',()=>{
  const h=html(states.variants,ready());
  const fields=[...h.matchAll(/<label for="([^"]+)" class="block font-medium">(.*?)<\/label><input class="[^"]*" id="([^"]+)"([^>]*)\/>/g)];
  assert.ok(fields.length>=6,'two main fields and the advanced ones');
  for(const [,forId,label,id,rest] of fields){
    assert.equal(forId,id);assert.doesNotMatch(label,/<input|<p /,'the label holds the name only');
    assert.match(rest,/aria-invalid="false"/,'nothing is flagged before a commit');assert.doesNotMatch(rest,/aria-errormessage/);
    const described=rest.match(/aria-describedby="([^"]+)"/)[1].split(' ');
    for(const d of described){const at=h.indexOf(`id="${d}"`);assert.ok(at>0,`describedby ${d} exists`);assert.ok(!element(h,h.lastIndexOf('<label',h.indexOf(`for="${id}"`))).includes(`id="${d}"`),'the description is outside the label');}
  }
  const main=fields.filter(([,,label])=>label.includes(L.variants.input));assert.equal(main.length,2);
  const shared=main.map(([,,,,rest])=>rest.match(/aria-describedby="([^"]+)"/)[1]);assert.equal(new Set(shared).size,1,'the two main fields share one visible help text');
  assert.ok(text(element(h,h.lastIndexOf('<p',h.indexOf(`id="${shared[0]}"`)))).includes(`${L.variants.inputHelp} ${L.variants.range}`));
  assert.match(main[0][2],/<span class="sr-only"> · Variante 1<\/span>/,'each main field names its variant');
  const R={min:-5000,max:10000,optional:false},O={...R,optional:true},blank={draft:'',error:false};
  let f=cPlanningFieldStep({draft:'10',error:false},{type:'type',text:'12,'},1000,R);assert.deepEqual(f,{draft:'12,',error:false},'a transient «12,» is not flagged while typing');
  assert.deepEqual(cPlanningFieldStep(f,{type:'type',text:'-'},1000,R),{draft:'-',error:false});
  assert.deepEqual(cPlanningFieldStep(f,{type:'commit'},1000,R),{draft:'12,',error:true},'an invalid draft is flagged at the commit and nothing is committed');
  f=cPlanningFieldStep({draft:'12,',error:true},{type:'type',text:'12,5'},1000,R);assert.deepEqual(f,{draft:'12,5',error:false},'typing clears the flag');
  assert.deepEqual(cPlanningFieldStep(f,{type:'commit'},1000,R),{draft:'12,5',error:false,commit:1250});
  assert.deepEqual(cPlanningFieldStep({draft:'+12.50 %',error:false},{type:'commit'},1000,R),{draft:'12,5',error:false,commit:1250},'the committed text is normalised');
  assert.deepEqual(cPlanningFieldStep({draft:'10',error:false},{type:'commit'},1000,R),{draft:'10',error:false},'an unchanged value commits nothing');
  assert.deepEqual(cPlanningFieldStep({draft:'101',error:false},{type:'commit'},1000,R),{draft:'101',error:true},'out of range');
  assert.deepEqual(cPlanningFieldStep(blank,{type:'commit'},1000,R),{draft:'',error:true},'a required field cannot be emptied');
  assert.deepEqual(cPlanningFieldStep(blank,{type:'commit'},250,O),{draft:'',error:false,commit:null},'an optional field is cleared');
  assert.deepEqual(cPlanningFieldStep(blank,{type:'commit'},null,O),blank);
  assert.match(ui,/onChange=\{e => step\(\{ type: "type", text: e\.target\.value \}\)\} onBlur=\{\(\) => step\(\{ type: "commit" \}\)\} onKeyDown=\{e => \{ if \(e\.key === "Enter"\) \{ e\.preventDefault\(\); step\(\{ type: "commit" \}\); \} \}\}/);
});

test('UI-04/UI-13: the group select commits only through «Aggiungi» or Enter, and focus lands on a live control after every removal',()=>{
  const h=html(states.variants,ready());
  const picker=element(h,h.indexOf('<fieldset'));
  assert.match(picker,/<legend tabindex="-1" class="[^"]*">Portafogli pianificati insieme<\/legend>/,'the group heading can take focus');
  assert.match(picker,/<select class="[^"]*h-11[^"]*" id="[^"]+" aria-describedby="[^"]+"><option value="" selected="">Scegli un portafoglio<\/option>/);
  assert.match(picker,/<button type="button" class="[^"]*" disabled=""><svg[^>]*>.*?<\/svg>Aggiungi<\/button>/,'nothing to add until a portfolio is chosen');
  assert.ok(picker.includes(L.group.limit));
  assert.match(ui,/onChange=\{e => setChoice\(e\.target\.value\)\} onKeyDown=\{e => \{ if \(e\.key === "Enter"\) \{ e\.preventDefault\(\); add\(\); \} \}\}/,'browsing the options with the arrow keys only moves the choice');
  assert.match(ui,/const valid = !full && free\.some\(p => p\.id === choice\), add = \(\) => \{ if \(valid\) \{ setChoice\(""\); onAdd\(choice\); \} \};/);
  assert.ok(ui.includes('const addId = (id: string) => apply(p => p.ids.includes(id) || p.ids.length >= C_PLANNING_MAX_GROUP ? p : cPlanningRegroup(p, [...p.ids, id]), "replace", "group");'),'a group change replaces the history entry');
  assert.equal((h.match(/<h4 tabindex="-1" class="[^"]*"><span>Variante \d<\/span><\/h4>/g)??[]).length,2,'each variant heading can take focus');
  // Focus targets: after a group change the add select, or the group heading when the select is disabled (a full group); after a
  // variant removal the remaining variant's heading, or «Aggiungi variante»; after an addition the new variant's field.
  assert.match(ui,/if \(want === "group"\) cPlanningFocusFirst\(\[addRef\.current, groupHeading\.current\]\);/);
  assert.match(ui,/else if \(want === "added"\) cPlanningFocusFirst\(\[inputs\.current\[variantCount - 1\], heads\.current\[variantCount - 1\]\]\);/);
  assert.match(ui,/else cPlanningFocusFirst\(\[heads\.current\[0\], addVariantRef\.current\]\);/);
  assert.match(ui,/\}, \[search, variantCount\]\);/,'focus moves after the new address has rendered');
  assert.ok(ui.includes('const removeVariant = (key: string) => { const i = at(key); if (i >= 0) apply(p => ({ ...p, variants: p.variants.filter((_, j) => j !== i) }), "push", "variant", { remove: i }); };'));
  const fake=(name,{disabled=false,isConnected=true}={})=>({name,disabled,isConnected,focused:0,focus(){this.focused++;}});
  const select=fake('select',{disabled:true}),legend=fake('legend');
  assert.equal(cPlanningFocusFirst([select,legend]),legend,'a disabled select (full group) hands focus to the heading');assert.equal(select.focused,0);assert.equal(legend.focused,1);
  const open=fake('select');assert.equal(cPlanningFocusFirst([open,legend]),open);
  const gone=fake('heading',{isConnected:false}),add=fake('add');assert.equal(cPlanningFocusFirst([null,gone,add]),add,'a removed card hands focus on');
  assert.equal(cPlanningFocusFirst([null,undefined]),null);
});

test('URL state: only c_plan_* keys change; a new group keeps the variants and drops what no longer applies',()=>{
  const other='c_port_period=FY2025&c_port_org=AQ&c_port_channel=CO&c_attr_org=CH&c_forecast_series=A&cw_tab=2';
  const plan={ids:['AA','BB'],variants:[{bps:250,sharedBps:-100,fixedBps:{AA:5,BB:-5}}],rule:'user',shares:{'AA+CC':1000,'BB+DD':2000}};
  const next=cPlanningRegroup(plan,['AA','CC']);
  assert.deepEqual(next,{ids:['AA','CC'],rule:'user',variants:[{bps:250,sharedBps:-100,fixedBps:{AA:5}}],shares:{}},'AA+CC is now inside the group and BB+DD outside it; BB left');
  assert.deepEqual(cPlanningRegroup(plan,['DD']).shares,{'BB+DD':2000},'a set that still crosses keeps its share');
  assert.deepEqual(plan.ids,['AA','BB'],'never mutated');
  assert.throws(()=>cPlanningRegroup(plan,[]),e=>e.message==='C_PLANNING_GROUP');assert.throws(()=>cPlanningRegroup(plan,['AA','AA']),e=>e.message==='C_PLANNING_GROUP');
  const s=new URLSearchParams(cPlanningSearch(other,next));
  assert.deepEqual([...s].filter(([k])=>!k.startsWith('c_plan_')),[...new URLSearchParams(other)]);
  assert.match(ui,/const reset = \(\) => \{ const q = new URLSearchParams\(address\.current\(\)\); for \(const k of C_PLANNING_PARAMS\) q\.delete\(k\);/);
  assert.ok(ui.includes('commit(cPlanningNext(address.current(), change), mode, target, shape);'));
  assert.match(ui,/window\.history\.replaceState\(null, "", url\)/,'typing and group edits replace the entry instead of filling the history');
  assert.doesNotMatch(ui,/c_port_(period|org|channel|id)/,'the dossier scope is read through the engine, never written');
});

test('export: built from the newest address and the page’s view; every exported statement, amount, label and note is on the page',()=>{
  const signedOf=a=>{const t=cPlanningMoney(a);return t.startsWith('-')||t==='0 €'?t:`+${t}`;};
  for(const [name,search] of [...Object.entries(states),['zero',`${scope()}&c_plan_ids=CC&c_plan_v1=1000`],['zeroPair',`${scope()}&c_plan_ids=CC.DD&c_plan_v1=500&c_plan_split=prop`]]){
    const h=html(search,loadOf(name)),t=text(h),st=cPlanningFilters(search).state,v=name==='partial'?view('JM2026'):view(),w=engine(search,...(name==='partial'?['JM2026']:[]));
    const x=cPlanningExport(v,st,'2026-10-19T10:00:00.000Z');
    assert.match(h,new RegExp(`<p id="scenari-confidentiality" class="[^"]*">${x.confidentiality}</p>`),`${name}: the exported label is the one beside the button`);
    assert.deepEqual(x.statements,cPlanningStatements(w));for(const s of x.statements)assert.ok(t.includes(s),`${name}: the exported statement is on the page: ${s}`);
    assert.equal(x.results.split===null,cPlanningSplitStatus(w)!=='shown',`${name}: split rows only when the page shows a split`);
    // Every exported amount is on the page, rounded once; every exported label, layer, caption and note is on the page too.
    let amounts=0;const walk=(node,path)=>{
      if(Array.isArray(node))return node.forEach((y,i)=>walk(y,`${path}[${i}]`));if(!node||typeof node!=='object')return;
      for(const [k,val] of Object.entries(node)){
        if(typeof val==='string'&&/^-?\d/.test(val)){amounts++;assert.ok(t.includes(k==='value'&&path.endsWith('.effect')?signedOf(val):cPlanningMoney(val)),`${name}: ${path}.${k} = ${val} is shown`);}
        else if(['label','layer','caption','note','ruleLabel'].includes(k))assert.ok(t.includes(val),`${name}: ${path}.${k} is on the page: ${val}`);
        else walk(val,`${path}.${k}`);
      }};
    walk(x.results,'results');assert.ok(amounts>=10,name);
    assert.deepEqual(x.group.map(g=>g.id),st.ids);assert.equal(cPlanningExportName(st),`vis-scenari-${st.period}-${st.org}-${st.channel}-${st.ids.join('-')}.json`);
  }
  // Read through the audience (recommendation 5): the reviewer's parser unchanged, a scoped audience's organisation clamped.
  assert.ok(ui.includes('const latest = cAudiencePlanningFilters(audience, address.current()).state;'),'the export reads the newest committed address');
  assert.ok(ui.includes('download(cPlanningExportName(latest), JSON.stringify(cPlanningExport(view, latest, new Date().toISOString(), audience.exportLabel), null, 2));'),'with the same view as the page, and the label printed beside the button');
  assert.match(ui,/if \(!view \|\| !ready\) throw Error\("C_PLANNING_EXPORT"\);/,'nothing is exported without a rendered result');
});

test('R1/R6: the blur and the click of one tap both land in the address; each variant keeps its key across a removal',()=>{
  const R={min:-5000,max:10000,optional:false},start=`${scope()}&c_plan_ids=AA.BB&c_plan_v1=1000`;
  // Next 16 applies a history update to useSearchParams in a transition, so the panel keeps rendering `start` for a while: every
  // handler builds on the tracker's newest address (cPlanningNext(address.current(), change)), as the pins below hold.
  const a=cPlanningAddress(start),writes=[],write=(next,change)=>{a.write(next,change);writes.push(next);};
  // 1. «12,5» typed in Variante 1, then a tap on «Quote uguali fra i candidati»: the blur commits, then the click runs, in one task.
  const blur=cPlanningFieldStep({draft:'12,5',error:false},{type:'commit'},1000,R),i=a.keys(a.current()).indexOf(a.keys(start)[0]);assert.equal(blur.commit,1250);
  write(cPlanningNext(a.current(),p=>({...p,variants:p.variants.map((x,j)=>j===i?{...x,bps:blur.commit}:x)})));
  write(cPlanningNext(a.current(),p=>({...p,rule:'eq'})));
  let q=new URLSearchParams(writes.at(-1));assert.deepEqual([q.get('c_plan_v1'),q.get('c_plan_split')],['1250','eq'],'the typed value survives the click');
  assert.equal(new URLSearchParams(cPlanningNext(start,p=>({...p,rule:'eq'}))).get('c_plan_v1'),'1000','building on the rendered address, as before, drops it');
  // 2. «7» typed, then «Aggiungi variante»; 3. «25» typed, then «Esporta JSON»: the file carries the value of the blur.
  write(cPlanningNext(a.current(),p=>({...p,variants:p.variants.map(x=>({...x,bps:700}))})));write(cPlanningNext(a.current(),p=>({...p,variants:[...p.variants,{bps:0,sharedBps:null,fixedBps:{}}]})),{add:true});
  q=new URLSearchParams(a.current());assert.deepEqual([q.get('c_plan_v1'),q.get('c_plan_v2'),q.get('c_plan_split')],['700','0','eq']);
  write(cPlanningNext(a.current(),p=>({...p,variants:p.variants.map((x,j)=>j?x:{...x,bps:2500})})));
  assert.equal(cPlanningExport(view(),cPlanningFilters(a.current()).state,'2026-10-19T10:00:00Z').assumptions.variants[0].percent,'25');
  // The page renders the writes late, in order or only the last: the address never goes back; an address another section wrote takes over.
  a.rendered(writes[0]);assert.equal(a.current(),writes.at(-1).slice(1));a.rendered(writes[0]);assert.equal(a.current(),writes.at(-1).slice(1),'re-rendering the shown address changes nothing');a.rendered(writes.at(-1));assert.equal(a.current(),writes.at(-1).slice(1));
  const other=`${scope('FY2025','CH')}&c_plan_ids=AA`;a.rendered(other);assert.equal(a.current(),other);
  // R6: removing Variante 1 keeps Variante 2's key, so its card and its own draft stay, and Variante 1's (invalid) draft unmounts with it.
  const b=cPlanningAddress(`?${scope()}&c_plan_ids=AA&c_plan_v1=0&c_plan_v2=0`),[k1,k2]=b.keys(b.current());assert.ok(k1&&k2&&k1!==k2);
  assert.deepEqual(cPlanningFieldStep({draft:'12,',error:false},{type:'commit'},0,R),{draft:'12,',error:true},'Variante 1 holds an invalid draft');
  const removed=cPlanningNext(b.current(),p=>({...p,variants:p.variants.filter((_,j)=>j!==0)}));b.write(removed,{remove:0});
  assert.deepEqual(b.keys(removed),[k2],'the survivor keeps its key before the page renders the removal');b.rendered(removed);assert.deepEqual(b.keys(removed),[k2],'and after');
  const added=cPlanningNext(b.current(),p=>({...p,variants:[...p.variants,{bps:0,sharedBps:null,fixedBps:{}}]}));b.write(added,{add:true});
  const [s1,s2]=b.keys(added);assert.equal(s1,k2);assert.ok(![k1,k2].includes(s2),'a new variant gets a new key, never the removed one');
  const foreign=`${scope()}&c_plan_ids=AA&c_plan_v1=5`;assert.deepEqual(b.keys(foreign),b.keys(foreign),'an address the panel did not write keeps the same keys across renders');
  for(const pin of ['const [address] = useState(() => cPlanningAddress(search)), keys = address.keys(search);','useLayoutEffect(() => { address.rendered(search); }, [address, search]);',
    'const apply = (change: (plan: CPlanningPlan) => CPlanningPlan, mode: Mode, target: Focus = null, shape?: CPlanningAddressChange) => { try { commit(cPlanningNext(address.current(), change), mode, target, shape); }',
    'const variant = (key: string, change: (v: CPlanningVariant) => CPlanningVariant) => { const i = at(key);','<li key={key} className=','<VariantCard key={keys[i] ?? v.index}','onCommit={bps => onChange(key, x => ({ ...x, bps: bps ?? 0 }))}'])assert.ok(ui.includes(pin),pin);
  assert.doesNotMatch(ui,/cPlanningSearch\(search,|\{ \.\.\.plan,|const plan: CPlanningPlan|<li key=\{i\}|key=\{v\.index\}/,'no handler builds on the plan of the render, and no card is keyed by its index');
});

test('navigation: Spazio scenari keeps its inner anchor inside section 5 «Budget e scenari» on every page with six sections (1.2c)',()=>{
  const ids=PILLAR_C_SECTIONS.map(s=>s.id);
  assert.deepEqual(ids,['quadro','destinatari','portafogli-attribuzione','fattori','budget-scenari','priorita-evidenza'],'the six sections');
  assert.ok(!ids.includes('scenari'),'Spazio scenari is a block of section 5, not a navigation entry');
  for(const [file,mount] of [['analytical-workspace.tsx','<PillarCPlanningWorkspace publishedActs={publishedActs} evidenceAnchor={Boolean(workbook)}/>'],['scoped-workspace.tsx','<PillarCPlanningWorkspace publishedActs={publishedActs} />']]){
    const ws=source(`components/dashboard-review/pillar-c/${file}`);
    assert.ok(ws.indexOf('<PillarCSectionFrame {...frameOf(BUDGET)}>')<ws.indexOf(mount)&&ws.indexOf(mount)<ws.indexOf('<PillarCSectionFrame {...frameOf(PRIORITA)}>'),`${file}: inside section 5`);
  }
  assert.match(source('components/dashboard-review/pillar-c/section-navigation.tsx'),/"budget-scenari": Landmark/);
  assert.equal(pillarCSectionAtViewport([{id:'portafogli-attribuzione',top:-900},{id:'budget-scenari',top:-40},{id:'priorita-evidenza',top:900}],150),'budget-scenari');
  assert.match(html(states.observed,null),/<section id="scenari"/);
});

test('O2/UI-16: the dossier keeps its slider card; its link carries the slider value and the workspace reproduces the card',()=>{
  const portfolios=[{id:'AA',label:'Area sintetica A',kind:'area_terapeutica'},{id:'BB',label:'Area sintetica B',kind:'area_terapeutica'}];
  const row=(key,c,year,state='S2',candidates=['AA'])=>({anno:year,mese:1,asl:'AQ',canale:'CO',prodotto_key:key,atc:'TEST',c,attribution_status:state,candidate_portfolios:candidates});
  const rows=[row('900000001','8',2024),row('900000001','10.005',2025),row('900000002','2',2025,'S3',['AA','BB']),row('900000003','-0.75',2025,'S3',['AA','BB'])];
  const p=buildCPortfolioPacket(rows,portfolios,new Map([['900000001','Prodotto sintetico A']]),'1'.repeat(64),'2'.repeat(64),'fictional');
  const v=cPortfolioView(p,'FY2025','AQ','CO','AA','3'.repeat(64));
  const search='c_port_period=FY2025&c_port_org=AQ&c_port_channel=CO&c_port_id=AA&c_plan_ids=BB&c_plan_v1=300_BB.10&c_attr_org=CH';
  const h=renderToStaticMarkup(reviewer(React.createElement(CPortfolioDossierView,{view:v,search})));
  const href=h.match(/<a class="[^"]*" href="([^"]+)" data-c-planning-link="true"><span>Pianifica questo portafoglio nello spazio scenari<\/span>/)[1].replace(/&amp;/g,'&');
  assert.ok(href.endsWith('#scenari'));const q=new URLSearchParams(href.slice(0,href.indexOf('#')));
  assert.equal(q.get('c_plan_ids'),'AA');assert.equal(q.get('c_plan_v1'),'300','at 0% the workspace keeps its own variant, without the other portfolio’s override');assert.equal(q.get('c_port_id'),'AA');assert.equal(q.get('c_attr_org'),'CH');
  assert.match(h,/data-c-planning-link="true"><span>Pianifica questo portafoglio nello spazio scenari<\/span><svg[^>]*>.*?<\/svg><\/a><\/article>/,'R-09: only the link is added to the card, no extra copy');
  assert.doesNotMatch(h,/riproduce i valori di questa scheda|Con una variazione diversa da 0%/);
  // The slider card itself is untouched: same markup, same maths; only its link follows the slider.
  assert.match(h,/Pianificazione sotto ipotesi/);assert.match(h,/data-c-portfolio-scenario="true" data-bps="0"/);
  const zero=cPortfolioPlanning(v,0);assert.match(h,new RegExp(`data-fixed="${zero.fixed.replace('.','\\.')}"`));
  assert.match(h,/<input type="range" aria-label="Variazione ipotizzata del portafoglio" class="mt-4 w-full accent-primary" min="-2000" max="3000" step="50" value="0"\/>/);
  const dossier=source('components/dashboard-review/pillar-c/portfolio-dossier.tsx');
  assert.ok(dossier.includes('const [bps,setBps]=useState(0),scenario=cPortfolioPlanning(view,bps),link=cPortfolioPlanningLink(search,view.dossier.id,scenario?bps:0);'),'the link follows the slider, and carries no percentage when the card has no reference');
  assert.ok(dossier.includes('<span key={link.text}>{link.text}</span>'),'its text is replaced whole when it changes');
  // The link's own text says what it opens: this portfolio and, with a slider value, that percentage, replacing the variants there.
  for(const bps of [-2000,-50,50,1000,3000]){const x=cPortfolioPlanningLink(search,'AA',bps);assert.equal(x.text,`Apri nello spazio scenari questo portafoglio con ${cPlanningPercentLabel(bps)} (sostituisce le varianti già presenti)`);assert.equal(x.href,cPlanningDossierHref(search,'AA',bps));assert.deepEqual(cPlanningCopyLint(x.text),[]);}
  assert.deepEqual(cPortfolioPlanningLink(search,'AA',0),{href:cPlanningDossierHref(search,'AA'),text:L.section.dossierLink});
  assert.deepEqual(cPortfolioPlanningLink(search,'aa',1000),{href:'#scenari',text:L.section.dossierLink},'an invalid portfolio falls back to the section anchor');
  assert.match(renderToStaticMarkup(reviewer(React.createElement(CPortfolioDossierView,{view:v}))),/href="\?c_plan_ids=AA#scenari"/,'without other keys the link carries the portfolio only');
  // The engine helper: a slider value other than 0 becomes the only variant, on the single-portfolio part alone (shared at 0%).
  const ap=buildCAttrPacket(rows,portfolios,new Map(),'1'.repeat(64),'2'.repeat(64),'fictional'),av=cPlanningAccept(rawOf(ap,'FY2025','AQ','CO'),'FY2025','AQ','CO');
  for(const bps of [-2000,-50,50,1000,3000]){
    const link=cPlanningDossierHref(search,'AA',bps),lq=new URLSearchParams(link.slice(0,link.indexOf('#')));
    assert.equal(lq.get('c_plan_v1'),`${bps}_s0`,`${bps}`);assert.equal(lq.get('c_plan_v2'),null);assert.equal(lq.get('c_plan_ids'),'AA');assert.equal(lq.get('c_attr_org'),'CH');
    const slider=cPortfolioPlanning(v,bps),w=cPlanningWorkspace(av,cPlanningFilters(link).state).variants[0];
    assert.equal(cPlanningCompare(w.bounds.reference,slider.fixed),0,`${bps}: reference`);
    assert.equal(cPlanningCompare(w.effect.reference,slider.change),0,`${bps}: change`);
    assert.equal(cPlanningCompare(w.bounds.lower1,slider.lower),0,`${bps}: lower`);assert.equal(cPlanningCompare(w.bounds.upper1,slider.upper),0,`${bps}: upper`);
    assert.equal(w.assumption.sharedBps,0,'the shared spend stays at its observed value, as on the card');
  }
  assert.equal(cPlanningDossierHref(search,'AA',0),cPlanningDossierHref(search,'AA'),'0% is the old link');
  assert.throws(()=>cPlanningDossierHref(search,'AA',20000),e=>e.message==='C_PLANNING_ASSUMPTION');
});

test('the attribution analysis keeps «Nessuna ripartizione uguale o proporzionale viene assunta», scoped to itself',()=>{
  const fixture=buildCAttrPacket([r('100000001','5','S2',['AA']),r('200000001','6','S3',['AA','BB'])],V,new Map(),'1'.repeat(64),'2'.repeat(64),'t');
  const h=renderToStaticMarkup(reviewer(React.createElement(CAttributionView,{view:{schema:'pillar-c-attribution-view-v1',sourceSha256:'1'.repeat(64),classificationSha256:'2'.repeat(64),mappingVersion:'t',sourceSnapshot:'3'.repeat(64),portfolios:fixture.portfolios,scope:fixture.scopes.find(s=>s.period==='FY2025'&&s.org==='AQ'&&s.channel==='CO'),comparison:null}})));
  assert.match(h,/Nessuna ripartizione uguale o proporzionale viene assunta\. Le ripartizioni dichiarate dello spazio scenari restano ipotesi di quella sezione e non modificano questi intervalli\./);
});

test('a percent field keeps a second edit and the text being typed while its own commits are still rendering',()=>{
  const opt={min:-5000,max:10000,optional:false};
  // Commit 12,5 (1250); the page has not rendered it yet (value still 0). A second edit commits 7 against 1250, not against 0.
  const pending=[1250],base=pending[pending.length-1];
  assert.deepEqual(cPlanningFieldStep({draft:'7',error:false},{type:'commit'},base,opt),{draft:'7',error:false,commit:700},'the second edit is committed');
  // The late render of 1250 only acknowledges the first commit and does not replace the draft being typed.
  let sync=cPlanningFieldSync([1250,700],1250);assert.deepEqual(sync,{pending:[700],replace:false});
  sync=cPlanningFieldSync(sync.pending,700);assert.deepEqual(sync,{pending:[],replace:false});
  // A value this field never committed (a reset, another section) replaces the draft.
  assert.deepEqual(cPlanningFieldSync([700],0),{pending:[],replace:true});assert.deepEqual(cPlanningFieldSync([],-300),{pending:[],replace:true});
  assert.ok(ui.includes('const base = pending.length ? pending[pending.length - 1] : value;'));
  assert.ok(ui.includes('cPlanningFieldStep(f, event, base, { min, max, optional })'));
});

test('the recalculation is announced only for the address this workspace wrote; the dossier link moves focus to the workspace',()=>{
  const B=String.fromCharCode(92),bare='.replace(/^'+B+'?/, "")';
  assert.ok(ui.includes('setAnnounceAfter(next'+bare+')'),'the announcement waits for the address this workspace wrote');
  assert.ok(ui.includes('announceAfter === search'+bare),'and is not repeated for another section'+String.fromCharCode(39)+'s URL change');
  assert.ok(ui.includes('<h2 id="scenari-title" tabIndex={-1}'));
  const dossier=source('components/dashboard-review/pillar-c/portfolio-dossier.tsx');
  assert.ok(dossier.includes("getElementById('scenari-title')?.focus({preventScroll:true})"));
});
