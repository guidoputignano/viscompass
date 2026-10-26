import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {buildCAttrPacket,cAttrAtoms,cAttrDecimal,cAttrPriority,C_ATTR_PERIODS,C_ATTR_ORGS,C_ATTR_CHANNELS} from '../lib/dashboard-review/pillar-c/attribution.ts';
import {loadCAttrView} from '../lib/dashboard-review/pillar-c/attribution-loader.ts';
import {C_ATTR_STORAGE} from '../lib/dashboard-review/pillar-c/attribution-storage.ts';
import {cInsightResetSearch} from '../lib/dashboard-review/pillar-c/insights.ts';
import {C_PLANNING_ADMISSION,C_PLANNING_FORBIDDEN,C_PLANNING_LABELS,C_PLANNING_MATCHED,C_PLANNING_NEGATIONS,C_PLANNING_PARAMS,C_PLANNING_READING,cPlanningSplitStatus,cPlanningStatements,cPlanningPartialText,cPlanningAccept,cPlanningBase,cPlanningBpsToPercent,cPlanningCompare,cPlanningCopyLint,cPlanningDecimal,cPlanningDossierHref,cPlanningExport,cPlanningExportName,cPlanningFilters,cPlanningLabelTexts,cPlanningMoney,cPlanningNumber,cPlanningOutside,cPlanningPercentLabel,cPlanningPercentToBps,cPlanningPlanCheck,cPlanningRanking,cPlanningSearch,cPlanningWorkspace} from '../lib/dashboard-review/pillar-c/planning.ts';

// Synthetic fixture only: small invented euro values, four invented portfolios.
const V=[{id:'AA',label:'Area sintetica A (test)',kind:'area_terapeutica'},{id:'BB',label:'Area sintetica B',kind:'area_terapeutica'},{id:'CC',label:'Area sintetica C',kind:'area_terapeutica'},{id:'DD',label:'Categoria sintetica D',kind:'categoria'}];
const IDS=V.map(p=>p.id);
const r=(key,c,state,candidates,{y=2025,m=3,org='AQ',ch='CO'}={})=>({anno:y,mese:m,asl:org,canale:ch,prodotto_key:key,atc:state==='S5'?'':'TST01',c,attribution_status:state,candidate_portfolios:candidates});
const CORE=[ // FY2025 · AQ · CO, the slice enumerated by brute force
  r('100000001','10.5','S2',['AA']),r('100000001','1.5','S2',['AA'],{m:4}),
  r('100000002','30','S2',['BB']),r('100000003','-5.25','S2',['BB'],{m:7}), // a credit row
  r('100000004','4','S2',['DD']),r('100000004','-4','S2',['DD'],{m:8}),      // rows that net to zero; CC has no S2 row at all
  r('200000001','80','S3',['AA','BB']),r('200000001','-10','S3',['BB','AA'],{m:9}), // mixed-sign entry
  r('200000002','20','S3',['AA','BB','CC']),
  r('200000003','-15','S3',['BB','DD']),r('200000003','-3','S3',['BB','DD'],{m:10}), // entry with net < 0
  r('200000004','7','S3',['CC','DD']),                                                // candidates without positive S2
  r('200000005','5','S3',['AA','CC']),r('200000005','-9','S3',['AA','CC'],{m:11}),   // mixed sign, net < 0
  r('200000006','3.333','S3',['AA','BB','CC','DD']),
  r('300000001','2','S4',[]),r('300000002','-1','S4',[],{m:5}),r('E-synth','6','S5',[]),
];
const SLICES=[
  r('100000001','2','S2',['AA'],{ch:'DD'}),r('200000001','6','S3',['AA','BB'],{ch:'DD'}),r('200000003','-2','S3',['BB','DD'],{ch:'DD'}),r('300000001','1.25','S4',[],{ch:'DD'}),
  r('100000001','1','S2',['AA'],{org:'CH'}),r('100000002','100','S2',['BB'],{org:'CH'}),r('100000006','-3','S2',['CC'],{org:'CH'}),/* negative single-portfolio net */r('200000001','50','S3',['AA','BB'],{org:'CH'}),r('200000002','-6','S3',['AA','BB','CC'],{org:'CH'}),r('200000004','2.5','S3',['CC','DD'],{org:'CH'}),r('E-synth','-0.5','S5',[],{org:'CH'}),
  r('100000003','8','S2',['BB'],{org:'CH',ch:'DD'}),r('200000005','4','S3',['AA','CC'],{org:'CH',ch:'DD'}),r('100000005','9','S2',['CC'],{org:'CH',ch:'DD'}),
];
const HISTORY=[r('100000001','11','S2',['AA'],{y:2024}),r('200000001','40','S3',['AA','BB'],{y:2024}),r('300000001','1','S4',[],{y:2024}),
  r('100000001','3','S2',['AA'],{y:2026,m:2}),r('200000002','1.75','S3',['AA','BB','CC'],{y:2026,m:1}),r('E-synth','0.25','S5',[],{y:2026,m:3})];
const ROWS=[...CORE,...SLICES,...HISTORY];
const packet=buildCAttrPacket(ROWS,V,new Map(ROWS.map(x=>[x.prodotto_key,`Prodotto sintetico ${x.prodotto_key}`])),'1'.repeat(64),'2'.repeat(64),'test-v0.1');
const find=(period,org,channel)=>packet.scopes.find(s=>s.period===period&&s.org===org&&s.channel===channel);
const raw=(period='FY2025',org='AQ',channel='CO')=>JSON.parse(JSON.stringify({schema:'pillar-c-attribution-view-v1',sourceSha256:packet.sourceSha256,classificationSha256:packet.classificationSha256,mappingVersion:packet.mappingVersion,sourceSnapshot:'3'.repeat(64),portfolios:packet.portfolios,scope:find(period,org,channel),comparison:find(C_PLANNING_MATCHED[period],org,channel)??null}));
const view=(period,org,channel)=>cPlanningAccept(raw(period,org,channel),period??'FY2025',org??'AQ',channel??'CO');
const plan=(ids,extra={})=>({ids,variants:[],rule:null,shares:{},...extra});
const variant=(bps,sharedBps=null,fixedBps={})=>({bps,sharedBps,fixedBps});
const code=c=>e=>e instanceof Error&&e.message===c;
const subsets=ids=>Array.from({length:2**ids.length-1},(_,i)=>ids.filter((_,j)=>(i+1)&(1<<j)));

// Independent exact helpers (test side): decimal or "n/d" strings → BigInt fractions in euros.
const frac=s=>{if(s.includes('/')){const [n,d]=s.split('/');return [BigInt(n),BigInt(d)];}const [i,f='']=s.split('.');return [BigInt(i+f),10n**BigInt(f.length)];};
const fadd=(...xs)=>xs.map(x=>typeof x==='string'?frac(x):x).reduce(([n,d],[m,e])=>[n*e+m*d,d*e],[0n,1n]);
const fmul=(x,n,d=1n)=>{const [a,b]=typeof x==='string'?frac(x):x;return [a*n,b*d];};
const feq=(a,b)=>{const [x,y]=typeof a==='string'?frac(a):a,[u,w]=typeof b==='string'?frac(b):b;return x*w===u*y;};
const at25=s=>{const [i,f='']=s.split('.');assert.ok(f.length<=25);return BigInt(i+f.padEnd(25,'0'));};
const rowsOf=(period,org,channel)=>ROWS.filter(x=>{const p=x.anno===2024?['FY2024']:x.anno===2026?['JM2026']:['FY2025',...(x.mese<=5?['JM2025']:[])];return p.includes(period)&&(org==='Regione'||x.asl===org)&&(channel==='Tutti'||x.canale===channel);}).map(x=>({c:cAttrAtoms(x.c),state:x.attribution_status,candidates:[...x.candidate_portfolios].sort()}));

/** Every whole-row vertex: S3 rows go to one of their candidates; under L2 S4/S5 rows go to any portfolio of V. */
function brute(rows,Q,layer,factor=()=>10000n){
  const g=new Set(Q),fixed=rows.filter(x=>x.state==='S2'&&g.has(x.candidates[0])).reduce((s,x)=>s+x.c*factor(x),0n);
  const free=rows.filter(x=>x.state==='S3'||(layer===2&&x.state!=='S2')).map(x=>({v:x.c*factor(x),choices:x.state==='S3'?x.candidates:IDS}));
  let min=null,max=null;const pick=new Array(free.length).fill(0);
  for(;;){let t=fixed;free.forEach((x,i)=>{if(g.has(x.choices[pick[i]]))t+=x.v;});if(min===null||t<min)min=t;if(max===null||t>max)max=t;
    let i=0;while(i<free.length&&++pick[i]===free[i].choices.length){pick[i]=0;i++;}if(i===free.length)break;}
  return {min,max};
}

test('C1 accepts the synthetic view and fails closed on every broken identity',()=>{
  const v=view();assert.equal(v.sourceSnapshot,'3'.repeat(64));
  const broken=[x=>{delete x.sourceSnapshot;},x=>{x.extra=1;},x=>{x.sourceSnapshot='not-a-hash';},x=>{x.scope.org='CH';},x=>{x.comparison.period='JM2025';},x=>{x.schema='pillar-c-attribution-v1';},
    x=>{x.scope.bounds[0].upper1='999';},x=>{x.scope.products[0].candidates=['AA','ZZ'];},x=>{x.scope.total.net='1';}];
  for(const change of broken){const x=raw();change(x);assert.throws(()=>cPlanningAccept(x,'FY2025','AQ','CO'),code('C_PLANNING_VIEW'));}
  // Consistent with the packet parser but not with the product entries or with S2: only C1 can see these.
  const plus=(s,n)=>cAttrDecimal(cAttrAtoms(s)+BigInt(n)*10n**21n);
  const shared=raw(),b=shared.scope.bounds.find(x=>x.id==='CC');for(const k of ['positive','abs','net'])b.shared[k]=plus(b.shared[k],1);b.upper1=plus(b.upper1,1);b.upper2=plus(b.upper2,1);
  assert.throws(()=>cPlanningAccept(shared,'FY2025','AQ','CO'),code('C_PLANNING_BASE'));
  const fixed=raw(),f=fixed.scope.bounds.find(x=>x.id==='CC');for(const k of ['fixed','lower1','upper1','lower2','upper2'])f[k]=plus(f[k],5);
  assert.throws(()=>cPlanningAccept(fixed,'FY2025','AQ','CO'),code('C_PLANNING_BASE'));
  assert.throws(()=>cPlanningBase({...v.scope,bounds:v.scope.bounds.slice(1)},v.portfolios),code('C_PLANNING_BASE'));
  assert.equal(view('JM2026').comparison.period,'JM2025');assert.equal(view('FY2025','CH','DD').comparison,null);
});

test('1. the observed partition has six parts that add up exactly to the scope net, checked against the rows',()=>{
  for(const [period,org,channel] of [['FY2025','AQ','CO'],['FY2025','Regione','Tutti'],['FY2025','CH','CO'],['JM2026','AQ','CO']]){
    const v=view(period,org,channel),rows=rowsOf(period,org,channel);
    for(const Q of subsets(IDS)){
      const g=new Set(Q),p=cPlanningWorkspace(v,plan(Q)).partition,sum=rows.reduce((s,x)=>s+x.c,0n);
      assert.equal(p.rows.length,Q.length+5);assert.deepEqual(p.rows.map(x=>x.part),[...Q.map(()=>'fixed'),'inside','crossing','otherFixed','otherShared','unattributed']);
      assert.equal(p.rows.reduce((s,x)=>s+cAttrAtoms(x.value),0n),sum);assert.equal(cAttrAtoms(p.total),sum);
      const part=x=>x.state==='S2'?(g.has(x.candidates[0])?`fixed|${x.candidates[0]}`:'otherFixed'):x.state!=='S3'?'unattributed':x.candidates.every(c=>g.has(c))?'inside':x.candidates.some(c=>g.has(c))?'crossing':'otherShared';
      for(const row of p.rows)assert.equal(cAttrAtoms(row.value),rows.filter(x=>part(x)===row.key||part(x)===row.part&&row.part!=='fixed').reduce((s,x)=>s+x.c,0n),`${period}|${org}|${channel}|${Q}|${row.key}`);
      assert.equal(cAttrAtoms(p.crossingAbs),rows.filter(x=>part(x)==='crossing').reduce((s,x)=>s+(x.c<0n?-x.c:x.c),0n),'annotation: absolute crossing exposure');
    }
  }
  const p=cPlanningWorkspace(view(),plan(['CC','DD'])).partition;
  assert.deepEqual(p.rows.slice(0,2).map(x=>[x.id,x.value,x.zero]),[['CC','0',true],['DD','0',true]],'no rows and compensated rows share the option (b) label');
  assert.equal(C_PLANNING_LABELS.observed.zeroFixed,'Nessun importo netto associato a una sola area (righe assenti o compensate)');
});

test('1. R1, R3 and R4 (PC-08-A12 item 2): classes 2, 3 and 5 carry S3 exactly, class 6 carries S4 ∪ S5, re-checked on every call',()=>{
  const sum=(list,k)=>list.reduce((s,e)=>s+(k==='n'?BigInt(e.n):cAttrAtoms(e[k])),0n);
  for(const [period,org,channel] of [['FY2025','AQ','CO'],['FY2025','Regione','Tutti'],['FY2025','CH','CO']]){
    const v=view(period,org,channel),s3=v.scope.products.filter(e=>e.state==='S3'),s45=v.scope.products.filter(e=>e.state!=='S3'),st=v.scope.states;
    for(const Q of subsets(IDS)){
      const g=new Set(Q),w=cPlanningWorkspace(v,plan(Q)),cls=e=>e.candidates.every(c=>g.has(c))?2:e.candidates.some(c=>g.has(c))?3:5;
      const by=[2,3,5].map(c=>s3.filter(e=>cls(e)===c));
      for(const k of ['n','net','abs','positive','negative'])assert.equal(by.reduce((t,l)=>t+sum(l,k),0n),k==='n'?BigInt(st.S3.n):cAttrAtoms(st.S3[k]),`${Q} S3 ${k}`);
      for(const k of ['n','net','abs','positive','negative'])assert.equal(sum(s45,k),k==='n'?BigInt(st.S4.n+st.S5.n):cAttrAtoms(st.S4[k])+cAttrAtoms(st.S5[k]),`${Q} S4∪S5 ${k}`);
      assert.deepEqual(['inside','crossing','otherShared'].map(k=>w.partition.rows.find(x=>x.part===k).entries),by.map(l=>l.length),'entries per class');
      assert.equal(cAttrAtoms(w.partition.crossingAbs),sum(by[1],'abs'));
    }
  }
  // The engine checks these identities against the view's own totals on every call, not only at acceptance: a view altered
  // after it was accepted (so C1, which ran once, cannot see it) fails closed in the partition.
  const plus=(s,n)=>cAttrDecimal(cAttrAtoms(s)+BigInt(n)*10n**21n);
  const changes=[x=>{x.scope.states.S3.n+=1;},x=>{x.scope.states.S3.abs=plus(x.scope.states.S3.abs,1);},x=>{x.scope.states.S3.positive=plus(x.scope.states.S3.positive,1);},x=>{x.scope.states.S3.negative=plus(x.scope.states.S3.negative,-1);},
    x=>{x.scope.states.S4.n+=1;},x=>{x.scope.states.S5.abs=plus(x.scope.states.S5.abs,1);},x=>{x.scope.total.net=plus(x.scope.total.net,1);}];
  for(const change of changes){const v=view();assert.doesNotThrow(()=>cPlanningWorkspace(v,plan(['AA','BB'])));change(v);assert.throws(()=>cPlanningWorkspace(v,plan(['AA','BB'])),code('C_PLANNING_PARTITION'));}
});

test('2. joint L1/L2 bounds equal the brute-force min and max over every whole-row vertex',()=>{
  const v=view(),rows=rowsOf('FY2025','AQ','CO');
  for(const Q of subsets(IDS)){
    const b=cPlanningWorkspace(v,plan(Q)).observed,l1=brute(rows,Q,1),l2=brute(rows,Q,2);
    assert.deepEqual([at25(b.lower1),at25(b.upper1)],[l1.min,l1.max],`L1 ${Q}`);
    assert.deepEqual([at25(b.lower2),at25(b.upper2)],[l2.min,l2.max],`L2 ${Q}`);
    assert.equal(at25(b.width1),l1.max-l1.min);assert.equal(b.full,Q.length===IDS.length);
  }
});

test('2. single-portfolio groups equal the packet bounds, the full set collapses, and groups nest inside summed intervals',()=>{
  for(const [period,org,channel] of [['FY2025','AQ','CO'],['FY2025','Regione','Tutti'],['FY2024','AQ','CO'],['JM2026','AQ','CO']]){
    const v=view(period,org,channel);
    for(const b of v.scope.bounds){const o=cPlanningWorkspace(v,plan([b.id])).observed;assert.deepEqual([o.reference,o.lower1,o.upper1,o.lower2,o.upper2],[b.fixed,b.lower1,b.upper1,b.lower2,b.upper2]);}
    const full=cPlanningWorkspace(v,plan(IDS)).observed,s=v.scope.states;
    assert.equal(full.lower1,full.upper1);assert.ok(feq(full.lower1,fadd(s.S2.net,s.S3.net)));assert.equal(full.lower2,full.upper2);assert.ok(feq(full.lower2,v.scope.total.net));
    for(const Q of subsets(IDS)){
      const o=cPlanningWorkspace(v,plan(Q)).observed,m=Q.map(id=>v.scope.bounds.find(b=>b.id===id));
      assert.ok(cPlanningCompare(fadd(...m.map(x=>x.lower1)).join('/'),o.lower1)<=0&&cPlanningCompare(o.upper1,fadd(...m.map(x=>x.upper1)).join('/'))<=0,`nested ${Q}`);
      assert.ok(cPlanningCompare(o.lower1,o.reference)<=0&&cPlanningCompare(o.reference,o.upper1)<=0,'the reference lies inside the interval');
      assert.ok(at25(o.width1)<=m.reduce((t,x)=>t+(cAttrAtoms(x.upper1)-cAttrAtoms(x.lower1))*10000n,0n),`(d) width ${Q}`);
      // (c) at L2: the two outer inequalities also hold.
      assert.ok(cPlanningCompare(fadd(...m.map(x=>x.lower2)).join('/'),o.lower2)<=0&&cPlanningCompare(o.upper2,fadd(...m.map(x=>x.upper2)).join('/'))<=0,`nested at L2 ${Q}`);
      // (c) equality case: when no S3 row has two or more candidates in Q, the group interval is the sum of the individual ones (L1).
      const g=new Set(Q),joint=rowsOf(period,org,channel).some(x=>x.state==='S3'&&x.candidates.filter(c=>g.has(c)).length>=2);
      if(!joint){assert.ok(feq(fadd(...m.map(x=>x.lower1)),o.lower1)&&feq(fadd(...m.map(x=>x.upper1)),o.upper1),`(c) equality ${Q}`);}
    }
  }
  const o=cPlanningWorkspace(view(),plan(['AA','BB'])).observed;
  assert.deepEqual([o.fixed,o.inside,o.reference,o.lower1,o.upper1],['36.75','70','106.75','79.75','135.083'],'{AA,BB} keeps the {AA,BB} entry wholly in the group');
});

test('2. property (f) at the §4.6 canonical vertex: the group and the others receive exactly S2 + S3 (L1) and the scope net (L2)',()=>{
  // The canonical vertex (§4.6, A02 item 2) is a test device, never displayed: each S3 row wholly to the first code of its candidate
  // set (ASCII order), each S4/S5 row wholly to TRV if the vocabulary has it, otherwise to its first code.
  const canon=IDS.includes('TRV')?'TRV':[...IDS].sort()[0];
  const T=(rows,g,layer)=>rows.reduce((t,x)=>t+(x.state==='S2'||x.state==='S3'?(g.has(x.candidates[0])?x.c:0n):layer===2&&g.has(canon)?x.c:0n),0n);
  for(const [period,org,channel] of [['FY2025','AQ','CO'],['FY2025','Regione','Tutti'],['FY2025','CH','CO'],['JM2026','AQ','CO']]){
    const v=view(period,org,channel),rows=rowsOf(period,org,channel),s=v.scope.states,s23=cAttrAtoms(s.S2.net)+cAttrAtoms(s.S3.net),all=cAttrAtoms(v.scope.total.net);
    for(const Q of subsets(IDS)){
      const g=new Set(Q),rest=IDS.filter(id=>!g.has(id)),o=cPlanningWorkspace(v,plan(Q)).observed,t1=T(rows,g,1),t2=T(rows,g,2);
      assert.ok(at25(o.lower1)<=t1*10000n&&t1*10000n<=at25(o.upper1)&&at25(o.lower2)<=t2*10000n&&t2*10000n<=at25(o.upper2),`the vertex is a feasible allocation inside L1 and L2: ${Q}`);
      if(!rest.length){assert.deepEqual([t1,t2],[s23,all],'Q = V receives everything');continue;}
      const c=new Set(rest),oc=cPlanningWorkspace(v,plan(rest)).observed;
      assert.equal(t1+T(rows,c,1),s23,`(f) at L1: ${Q}`);assert.equal(t2+T(rows,c,2),all,`(f) at L2: ${Q}`);
      // Statement 1 for a group: the group's minimum is reached only where the others reach their maximum, and conversely.
      assert.equal(at25(o.lower1)+at25(oc.upper1),s23*10000n);assert.equal(at25(o.upper1)+at25(oc.lower1),s23*10000n);
    }
  }
});

test('2. group bounds are additive across slices for every period: Regione = Σ Aziende and Tutti = Σ channels',()=>{
  const slices=[['AQ','CO'],['AQ','DD'],['CH','CO'],['CH','DD']];
  const measures=o=>[o.reference,o.lower1,o.upper1,o.lower2,o.upper2,o.width1];
  for(const period of C_ATTR_PERIODS)for(const Q of subsets(IDS)){
    const sumOf=list=>list[0].map((_,i)=>fadd(...list.map(x=>x[i])));
    // A slice with no rows in the fixture has no scope object: it contributes zero to every measure.
    const at=(org,channel)=>find(period,org,channel)?measures(cPlanningWorkspace(view(period,org,channel),plan(Q)).observed):['0','0','0','0','0','0'];
    if(period!=='FY2025'){
      if(!find(period,'Regione','Tutti'))continue;
      sumOf(slices.map(([o,c])=>at(o,c))).forEach((x,i)=>assert.ok(feq(x,at('Regione','Tutti')[i]),`${period} Regione|Tutti ${Q} ${i}`));continue;
    }
    const memo=new Map(),atFy=(org,channel)=>{if(!memo.has(org+channel))memo.set(org+channel,at(org,channel));return memo.get(org+channel);};
    sumOf(slices.map(([o,c])=>atFy(o,c))).forEach((x,i)=>assert.ok(feq(x,atFy('Regione','Tutti')[i]),`Regione|Tutti ${Q} ${i}`));
    sumOf([atFy('AQ','CO'),atFy('CH','CO')]).forEach((x,i)=>assert.ok(feq(x,atFy('Regione','CO')[i])));
    sumOf([atFy('AQ','CO'),atFy('AQ','DD')]).forEach((x,i)=>assert.ok(feq(x,atFy('AQ','Tutti')[i])));
    // The same holds under a declared variant applied identically to each slice (item 6 is linear).
    const under=(org,channel)=>{const w=cPlanningWorkspace(view('FY2025',org,channel),plan(Q,{variants:[variant(700,-300,{[Q[0]]:1250})]})).variants[0];return [...measures(w.bounds),w.effect.reference];};
    sumOf(slices.map(([o,c])=>under(o,c))).forEach((x,i)=>assert.ok(feq(x,under('Regione','Tutti')[i]),`under a variant: Regione|Tutti ${Q} ${i}`));
  }
});

test('3. variants scale only the group and the entries touching it; the scope still conserves; brute force agrees',()=>{
  const v=view(),rows=rowsOf('FY2025','AQ','CO'),before=JSON.stringify(v);
  let seed=20261019;const rnd=n=>{seed=(seed*1103515245+12345)%2147483648;return seed%n;};
  for(let t=0;t<200;t++){
    const Q=subsets(IDS)[rnd(15)],g=new Set(Q),bps=rnd(15001)-5000,shared=rnd(3)?null:rnd(15001)-5000,fixedBps={};
    for(const id of Q)if(!rnd(3))fixedBps[id]=rnd(15001)-5000;
    const w=cPlanningWorkspace(v,plan(Q,{variants:[variant(bps,shared,fixedBps)]})),x=w.variants[0],k3=BigInt(10000+(shared??bps));
    const factor=row=>row.state==='S2'?(g.has(row.candidates[0])?BigInt(10000+(fixedBps[row.candidates[0]]??bps)):10000n):row.state==='S3'&&row.candidates.some(c=>g.has(c))?k3:10000n;
    // Conservation through the public parts only: no scope total under assumption is ever returned.
    const scaled=rows.reduce((s,row)=>s+row.c*factor(row),0n),parts=w.partition.rows;
    const untouched=['otherFixed','otherShared','unattributed'].reduce((s,k)=>s+cAttrAtoms(parts.find(p=>p.part===k).value)*10000n,0n);
    assert.equal(at25(x.bounds.fixed)+at25(x.bounds.inside)+at25(x.bounds.crossing.net)+untouched,scaled,`conservation ${t}`);
    assert.equal(at25(x.bounds.fixed),x.members.reduce((s,m)=>s+at25(m.fixed),0n));
    for(const m of x.members){const b=v.scope.bounds.find(y=>y.id===m.id),kf=BigInt(10000+(fixedBps[m.id]??bps));
      assert.deepEqual([at25(m.fixed),at25(m.lower1),at25(m.upper1)],[cAttrAtoms(b.fixed)*kf,cAttrAtoms(b.fixed)*kf+cAttrAtoms(b.shared.negative)*k3,cAttrAtoms(b.fixed)*kf+cAttrAtoms(b.shared.positive)*k3]);}
    assert.equal(at25(x.effect.reference),at25(x.bounds.reference)-at25(w.observed.reference));
    assert.equal(at25(x.effect.lower),at25(x.bounds.lower1)-at25(w.observed.lower1));assert.equal(at25(x.effect.upper),at25(x.bounds.upper1)-at25(w.observed.upper1));
    assert.deepEqual(x.assumption,{bps,sharedBps:shared??bps,fixedBps:Object.fromEntries(Q.map(id=>[id,fixedBps[id]??bps]))});
    if(!x.bounds.full)assert.equal(at25(x.bounds.lower1)-at25(x.bounds.lower2),at25(w.observed.lower1)-at25(w.observed.lower2),'S4/S5 are never varied');
    assert.deepEqual(Object.keys(x),['index','name','assumption','members','bounds','effect'],'no scope total under assumption');
    if(t<12){const l1=brute(rows,Q,1,factor),l2=brute(rows,Q,2,factor);assert.deepEqual([at25(x.bounds.lower1),at25(x.bounds.upper1),at25(x.bounds.lower2),at25(x.bounds.upper2)],[l1.min,l1.max,l2.min,l2.max],`scaled brute force ${t}`);}
  }
  const zero=cPlanningWorkspace(v,plan(['AA','BB'],{variants:[variant(0)]})).variants[0];
  assert.deepEqual(Object.values(zero.effect),['0','0','0','0','0']);
  const up=cPlanningWorkspace(v,plan(['AA','BB'],{variants:[variant(1000),variant(-2000,500,{BB:-1})]}));
  assert.deepEqual([up.variants[0].bounds.reference,up.variants[0].effect.reference],['117.425','10.675']);
  assert.deepEqual(up.variants[1].members.map(m=>m.fixed),['9.6','24.747525']);assert.equal(up.variants[1].bounds.inside,'73.5');
  assert.equal(up.variants.length,2);assert.deepEqual(up.variants.map(x=>x.name),['Variante 1','Variante 2']);
  assert.equal(JSON.stringify(v),before,'the view is never mutated');
  for(const bad of [variant(1.5),variant(10001),variant(-5001),variant(NaN),variant('100'),variant(0,0.5),variant(0,null,{CC:10}),variant(0,null,{AA:20000}),{bps:0,sharedBps:null},{...variant(0),extra:1}])
    assert.throws(()=>cPlanningWorkspace(v,plan(['AA','BB'],{variants:[bad]})),code('C_PLANNING_ASSUMPTION'));
  assert.throws(()=>cPlanningWorkspace(v,plan(['AA'],{variants:[variant(0),variant(0),variant(0)]})),code('C_PLANNING_ASSUMPTION'));
  for(const ids of [[],['AA','AA'],['AA','ZZ'],['aa'],['A1','A2','A3','A4','A5','A6','A7'],'AA'])assert.throws(()=>cPlanningWorkspace(v,plan(ids)),code('C_PLANNING_GROUP'));
  assert.deepEqual(Object.keys(up.variants[0].bounds),['fixed','inside','reference','referenceZero','crossing','lower1','upper1','width1','lower2','upper2','full']);
  // A12 item 9: a reference made only of single-portfolio parts that are exactly 0 reads as such, observed and under a variant.
  for(const ids of [['CC'],['DD']]){const z=cPlanningWorkspace(v,plan(ids,{variants:[variant(1000)]}));assert.deepEqual([z.observed.reference,z.observed.referenceZero,z.variants[0].bounds.reference,z.variants[0].bounds.referenceZero],['0',true,'0',true],`${ids}`);}
  assert.equal(cPlanningWorkspace(v,plan(['CC','DD'])).observed.referenceZero,false,'an entry that stays in the group is not a single-portfolio part');
  assert.equal(cPlanningWorkspace(v,plan(['AA'])).observed.referenceZero,false);
});

test('4. split rules: exact rationals, conservation, always inside the range, uncovered entries keep their range',()=>{
  const v=view(),Q=['AA','BB'];
  const eq=cPlanningWorkspace(v,plan(Q,{rule:'eq'})),b=eq.split.observed;
  assert.equal(b.lower,'664499/6000');assert.equal(b.upper,b.lower);assert.equal(b.complete,true);assert.equal(cPlanningMoney(b.lower,2),'110,75 €');
  assert.ok(feq(fadd(b.covered.group,b.covered.outside),b.covered.net),'group share + outside share = shared net');
  assert.ok(cPlanningCompare(eq.observed.lower1,b.lower)<=0&&cPlanningCompare(b.upper,eq.observed.upper1)<=0);
  assert.deepEqual(eq.observed,cPlanningWorkspace(v,plan(Q)).observed,'a split never changes the group interval');
  // Σ over a partition of V of the group values = S2 + S3 net (R-EQ covers every entry).
  const s=v.scope.states,parts=[['AA','BB'],['CC','DD']].map(q=>cPlanningWorkspace(v,plan(q,{rule:'eq'})).split.observed.lower);
  assert.ok(feq(fadd(...parts),fadd(s.S2.net,s.S3.net)));
  // R-PROP: {CC,DD} has no positive single-portfolio part, so it stays unallocated, and counts once in the scope identity.
  const prop=[['AA','CC'],['BB','DD']].map(q=>cPlanningWorkspace(v,plan(q,{rule:'prop'})));
  for(const w of prop){assert.equal(w.split.observed.complete,false);assert.equal(w.split.observed.uncovered.entries,1);assert.equal(w.split.observed.uncovered.net,'7');}
  assert.ok(feq(fadd(...prop.flatMap(w=>[w.observed.reference,w.split.observed.covered.group]),'7'),fadd(s.S2.net,s.S3.net)));
  const cc=cPlanningWorkspace(v,plan(['CC'],{rule:'prop'})).split.observed;
  assert.deepEqual([cc.lower,cc.upper,cc.complete,cc.covered.group,cc.uncovered.positive],['0','7',false,'0','7'],'zero-sum entry resta non ripartita and keeps its range');
  // A negative single-portfolio net weighs max(F,0) = 0: CC (F = -3 in CH·CO) takes no proportional share, and {CC,DD} stays unallocated.
  const neg=cPlanningWorkspace(view('FY2025','CH','CO'),plan(['CC'],{rule:'prop'}));
  assert.equal(neg.members[0].fixed,'-3');assert.deepEqual([neg.split.observed.covered.group,neg.split.observed.uncovered.entries,neg.split.observed.uncovered.net,neg.split.observed.complete],['0',1,'2.5',false]);
  // R-USER: one set with a share, the others unset.
  const user=cPlanningWorkspace(v,plan(Q,{rule:'user',shares:{'AA+BB+CC':5000,'AA+CC+DD':2500}}));
  const u=user.split.observed;
  assert.deepEqual([u.lower,u.upper,u.complete,u.covered.entries,u.covered.group,u.uncovered.entries,u.uncovered.sets],['89.75','125.083',false,1,'10',3,3]);
  assert.deepEqual(user.split.unusedShares,['AA+CC+DD']);
  const all=cPlanningWorkspace(v,plan(Q,{rule:'user',shares:{'AA+BB+CC':10000,'AA+BB+CC+DD':0,'AA+CC':0,'BB+DD':10000}})).split.observed;
  assert.equal(all.complete,true);assert.equal(all.lower,all.upper);assert.ok(feq(all.lower,fadd('106.75','20','-18')));
  assert.equal(cPlanningWorkspace(v,plan(Q,{rule:'user'})).split.observed.lower,eq.observed.lower1,'no shares: the declared split is the whole range');
  // Under a uniform variant every part of the group scales by the same factor.
  const up=cPlanningWorkspace(v,plan(Q,{rule:'eq',variants:[variant(1000)]}));
  assert.ok(feq(up.split.variants[0].lower,fmul(b.lower,11n,10n)));
  for(const rule of ['eq','prop','user'])for(const q of subsets(IDS)){
    const w=cPlanningWorkspace(v,plan(q,{rule,variants:[variant(700,-300),variant(-1200)],shares:Object.fromEntries(w0(q).map((k,i)=>[k,i*1700%10001]))}));
    for(const [band,bounds] of [[w.split.observed,w.observed],...w.split.variants.map((x,i)=>[x,w.variants[i].bounds])]){
      assert.ok(cPlanningCompare(bounds.lower1,band.lower)<=0&&cPlanningCompare(band.lower,band.upper)<=0&&cPlanningCompare(band.upper,bounds.upper1)<=0,`${rule} ${q} inside`);
      assert.ok(feq(fadd(band.covered.group,band.covered.outside),band.covered.net));
      assert.equal(band.complete,band.uncovered.entries===0);assert.equal(band.covered.entries+band.uncovered.entries,w.partition.crossingEntries);
    }
  }
  function w0(q){return cPlanningWorkspace(v,plan(q)).crossingSets.map(x=>x.set);}
});

test('4. R-EQ and R-USER are additive across slices; R-PROP is not (documented counter-example)',()=>{
  const Q=['AA'],slices=[['AQ','CO'],['AQ','DD'],['CH','CO'],['CH','DD']];
  const band=(rule,org,channel,shares={})=>cPlanningWorkspace(view('FY2025',org,channel),plan(Q,{rule,shares})).split.observed;
  for(const rule of ['eq','user']){const shares=rule==='user'?{'AA+BB':2500,'AA+BB+CC':10000,'AA+CC':5000}:{};
    assert.ok(feq(fadd(...slices.map(([o,c])=>band(rule,o,c,shares).lower)),band(rule,'Regione','Tutti',shares).lower),rule);
    assert.ok(feq(fadd(...slices.map(([o,c])=>band(rule,o,c,shares).upper)),band(rule,'Regione','Tutti',shares).upper),rule);}
  assert.ok(!feq(fadd(band('prop','AQ','CO').lower,band('prop','CH','CO').lower),band('prop','Regione','CO').lower),'proportional weights depend on the slice');
  assert.equal(C_PLANNING_LABELS.split.propAdditive,'La ripartizione proporzionale non è additiva tra Aziende e canali.');
});

test('exact display: one rounding, half away from zero, including fractions',()=>{
  assert.deepEqual(['1/3','2/3','-2/3','200/3','-1/3'].map(x=>cPlanningDecimal(x,2)),['0,33','0,67','-0,67','66,67','-0,33']);
  assert.deepEqual([cPlanningDecimal('200/3'),cPlanningDecimal('-1/3'),cPlanningDecimal('1.005',2),cPlanningDecimal('-1.005',2),cPlanningMoney('1234.5')],['67','0','1,01','-1,01','1.235 €']);
  assert.equal(cPlanningCompare('1/3','0.3333333333333333333333333'),1);assert.equal(cPlanningCompare('-2/4','-0.5'),0);
  assert.throws(()=>cPlanningDecimal('1e3'),code('C_PLANNING_AMOUNT'));
  assert.ok(Math.abs(cPlanningNumber('664499/6000')-110.7498333)<1e-6);assert.equal(cPlanningNumber('-12.5'),-12.5);
});

test('5. the shared-product ranking is cAttrPriority on the boundary-crossing entries, read as «fino a»',()=>{
  const v=view('FY2025','Regione','Tutti');
  for(const Q of subsets(IDS)){
    const g=new Set(Q),crossing=v.scope.products.filter(e=>e.state==='S3'&&e.candidates.some(c=>g.has(c))&&!e.candidates.every(c=>g.has(c)));
    const ranked=cPlanningRanking(v,Q),w=cPlanningWorkspace(v,plan(Q));
    assert.deepEqual(ranked,cAttrPriority({...v.scope,products:crossing},'S3','',v.portfolios));assert.deepEqual(w.ranking,ranked);
    assert.ok(feq(ranked.total,w.observed.width1),'the maximum total reduction is the group width');
    for(let i=1;i<ranked.rows.length;i++)assert.ok(cAttrAtoms(ranked.rows[i-1].abs)>=cAttrAtoms(ranked.rows[i].abs));
  }
  assert.equal(cPlanningRanking(v,IDS).count,0);assert.equal(cPlanningRanking(v,IDS).n80,null);
  assert.match(C_PLANNING_LABELS.ranking.reduction,/fino a$/);
  assert.equal(C_PLANNING_LABELS.ranking.title,'Revisione delle indicazioni del prodotto: riduzione massima dell’intervallo del gruppo');
  const sets=cPlanningWorkspace(view(),plan(['AA','BB'],{shares:{'AA+CC':1234}})).crossingSets;
  assert.deepEqual(sets.map(x=>[x.set,x.abs,x.share]),[['BB+DD','18',null],['AA+CC','14',1234],['AA+BB+CC','20',null],['AA+BB+CC+DD','3.333',null]].sort((a,b)=>Number(b[1])-Number(a[1])||(a[0]<b[0]?-1:1)));
});

test('6. URL codec: round trip, strict fallback, percent ↔ bps exact, and no other parameter is touched',()=>{
  const other='c_port_period=JM2026&c_port_org=TE&c_port_channel=DD&c_port_id=BB&c_attr_org=CH&c_forecast_series=A&cw_tab=2&c_budget_org=PE';
  const p={ids:['BB','AA','CC'],variants:[variant(250,-1000,{CC:5,AA:-75}),variant(-5000)],rule:'user',shares:{'AA+DD':5000,'BB+DD':0,'CC+DD':10000}};
  const search=cPlanningSearch(`?${other}`,p),q=new URLSearchParams(search);
  assert.deepEqual(cPlanningFilters(search),{state:{period:'JM2026',org:'TE',channel:'DD',...p,variants:[variant(250,-1000,{AA:-75,CC:5}),variant(-5000)]},invalid:[]});
  assert.equal(q.get('c_plan_ids'),'BB.AA.CC');assert.equal(q.get('c_plan_v1'),'250_s-1000_AA.-75_CC.5');assert.equal(q.get('c_plan_shares'),'AA-DD.5000_BB-DD.0_CC-DD.10000');
  assert.doesNotMatch(search,/%/,'URL-safe characters only');
  const kept=[...new URLSearchParams(other)],after=[...q].filter(([k])=>!k.startsWith('c_plan_'));assert.deepEqual(after,kept);
  assert.ok([...q.keys()].filter(k=>k.startsWith('c_plan_')).every(k=>C_PLANNING_PARAMS.includes(k)));
  const bare=cPlanningSearch('?x=1',plan(['AA']));assert.equal(bare,'?x=1&c_plan_ids=AA');assert.doesNotMatch(bare,/c_port_/,'the dossier scope is never written');
  assert.equal(cPlanningSearch(search,plan(['AA'])),`?${other}&c_plan_ids=AA`,'cleared keys are removed');
  assert.deepEqual(cPlanningFilters('').state,{period:'FY2025',org:'Regione',channel:'Tutti',ids:['ONC'],variants:[],rule:null,shares:{}});
  assert.deepEqual(cPlanningFilters('?c_port_id=BB').state.ids,['BB']);
  const bad=[['c_plan_ids=aa','c_plan_ids'],['c_plan_ids=AA.AA','c_plan_ids'],['c_plan_ids=A1.A2.A3.A4.A5.A6.A7','c_plan_ids'],['c_plan_ids=AA&c_plan_v1=1.5','c_plan_v1'],['c_plan_ids=AA&c_plan_v1=10001','c_plan_v1'],['c_plan_ids=AA&c_plan_v1=-0','c_plan_v1'],['c_plan_ids=AA&c_plan_v1=007','c_plan_v1'],
    ['c_plan_ids=AA&c_plan_v1=100_s','c_plan_v1'],['c_plan_ids=AA&c_plan_v1=100_CC.5','c_plan_v1'],['c_plan_ids=AA.BB&c_plan_v1=100_BB.5_AA.3','c_plan_v1'],['c_plan_ids=AA&c_plan_v2=100','c_plan_v2'],['c_plan_ids=AA&c_plan_split=all','c_plan_split'],
    ['c_plan_ids=AA.BB&c_plan_shares=AA-BB.5000','c_plan_shares'],['c_plan_ids=AA&c_plan_shares=BB-AA.10','c_plan_shares'],['c_plan_ids=AA&c_plan_shares=AA-CC.10001','c_plan_shares'],['c_plan_ids=AA&c_plan_shares=AA-CC.1_AA-CC.2','c_plan_shares'],['c_plan_ids=AA&c_plan_shares=','c_plan_shares']];
  for(const [s,key] of bad){const f=cPlanningFilters(`?c_port_id=DD&${s}`);assert.deepEqual(f.invalid,[key],s);assert.doesNotThrow(()=>cPlanningPlanCheck(f.state));}
  assert.deepEqual(cPlanningFilters('?c_port_id=DD&c_plan_ids=aa').state.ids,['DD'],'an invalid group falls back to the dossier portfolio');
  for(const broken of [plan([]),plan(['AA'],{variants:[variant(1.5)]}),plan(['AA'],{variants:[variant(0,null,{BB:1})]}),plan(['AA','BB'],{shares:{'AA+BB':1}}),plan(['AA'],{shares:{'CC+AA':1}}),plan(['AA'],{rule:'all'}),{...plan(['AA']),hidden:1},plan(['AA'],{variants:[variant(0),variant(0),variant(0)]})])
    assert.throws(()=>cPlanningSearch('',broken));
  for(let b=-5000;b<=10000;b++)assert.equal(cPlanningPercentToBps(cPlanningBpsToPercent(b)),b);
  assert.deepEqual(['12,5','-3.25','+4 %','0,05','−7','100','-50'].map(x=>cPlanningPercentToBps(x)),[1250,-325,400,5,-700,10000,-5000]);
  for(const x of ['1,234','abc','100,01','-50,01','','1e2','12,'])assert.throws(()=>cPlanningPercentToBps(x),code('C_PLANNING_ASSUMPTION'));
  assert.equal(cPlanningPercentToBps('50',0,10000),5000);assert.throws(()=>cPlanningPercentToBps('-1',0,10000));
  assert.deepEqual([cPlanningPercentLabel(250),cPlanningPercentLabel(-5),cPlanningPercentLabel(0),cPlanningPercentLabel(5000,false)],['+2,5%','-0,05%','0%','50%']);
  const href=cPlanningDossierHref(search,'CC'),h=new URLSearchParams(href.slice(0,href.indexOf('#')));
  assert.ok(href.endsWith('#scenari'));assert.equal(h.get('c_plan_ids'),'CC');assert.equal(h.get('c_plan_v1'),'250_s-1000_CC.5');assert.equal(h.get('c_plan_shares'),'CC-DD.10000');assert.equal(h.get('c_attr_org'),'CH');
});

test('7. the JSON export carries the label, the source identity, every assumption and, labelled, only the values the page shows',()=>{
  const L=C_PLANNING_LABELS,v=view(),before=JSON.stringify(v),state={period:'FY2025',org:'AQ',channel:'CO',ids:['AA','BB'],variants:[variant(1000,null,{BB:-250})],rule:'user',shares:{'AA+BB+CC':5000}};
  const x=cPlanningExport(v,state,'2026-10-19T10:00:00.000Z'),w=cPlanningWorkspace(v,state);
  assert.deepEqual(Object.keys(x),['schema','mode','status','confidentiality','exportedAt','source','scope','group','assumptions','results','statements']);
  assert.deepEqual([x.schema,x.mode,x.status,x.confidentiality],['pillar-c-planning-scenarios-v1','local-export-only','bozza-locale','Riservato ai revisori del progetto · contiene aggregati di più Aziende']);
  assert.deepEqual(x.source,{sourceSha256:'1'.repeat(64),classificationSha256:'2'.repeat(64),mappingVersion:'test-v0.1',mappingStatus:'bozza',sourceSnapshot:'3'.repeat(64)});
  assert.deepEqual(x.scope,{period:'FY2025',org:'AQ',channel:'CO',months:12,duration:'Per un periodo della stessa durata del periodo di base.'});
  assert.deepEqual(x.group,[{id:'AA',label:'Area sintetica A (test)'},{id:'BB',label:'Area sintetica B'}]);
  assert.deepEqual(x.assumptions,{variants:[{name:'Variante 1',percent:'10',sharedPercent:'10',fixedPercent:{AA:'10',BB:'-2.5'}}],split:{rule:'user',admission:C_PLANNING_ADMISSION,sharesPercent:{'AA+BB+CC':'50'}}});
  // Observed layer, as on the page: the partition rows under their labels, the joint interval, its width and reference, L2 and the members.
  const o=x.results.observed;assert.deepEqual(Object.keys(x.results),['observed','variants','split']);
  assert.deepEqual(Object.keys(o),['layer','partition','total','crossingAbs','reference','interval','width','l2','members']);assert.equal(o.layer,L.observed.chip);
  assert.deepEqual(o.partition,w.partition.rows.map(r=>({part:r.part,id:r.id,label:L.observed[r.part],value:r.value,entries:r.entries})));
  assert.deepEqual([o.total,o.crossingAbs,o.reference,o.width],[{label:L.observed.total,value:w.partition.total},{label:L.observed.crossingAbs,value:w.partition.crossingAbs},{label:L.bounds.reference,value:w.observed.reference},{label:L.bounds.width,value:w.observed.width1}]);
  assert.deepEqual([o.interval,o.l2],[{label:L.bounds.joint,lower:w.observed.lower1,upper:w.observed.upper1},{label:L.bounds.l2,lower:w.observed.lower2,upper:w.observed.upper2}]);
  assert.deepEqual(o.members,w.members.map(m=>({id:m.id,label:L.bounds.member,lower:m.lower1,upper:m.upper1})));
  // Values under assumption, as on each variant card: reference, interval, L2 line, effect and members, with the card's caption.
  const [xv]=x.results.variants,[wv]=w.variants;
  assert.deepEqual(Object.keys(xv),['name','layer','caption','reference','interval','l2','effect','members']);
  assert.deepEqual([xv.name,xv.layer,xv.caption],['Variante 1',L.variants.chip,L.variants.compact]);
  assert.deepEqual([xv.reference,xv.interval,xv.l2,xv.effect],[{label:L.variants.reference,value:wv.bounds.reference},{label:L.variants.interval,lower:wv.bounds.lower1,upper:wv.bounds.upper1},{label:L.bounds.l2,lower:wv.bounds.lower2,upper:wv.bounds.upper2},{label:L.variants.effect,value:wv.effect.reference}]);
  assert.deepEqual(xv.members,wv.members.map(m=>({id:m.id,label:L.variants.members,lower:m.lower1,upper:m.upper1,fixed:{label:L.variants.fixedPart,value:m.fixed}})));
  // The split result only, each row labelled «Ripartizione dichiarata (ipotesi)» (PC-08-A13 items 4 and 7).
  const R='Ripartizione dichiarata (ipotesi)';
  assert.deepEqual(x.results.split,{label:R,rule:'user',ruleLabel:L.split.user,coveredEntries:1,uncoveredEntries:3,observed:{label:R,lower:w.split.observed.lower,upper:w.split.observed.upper,complete:false},variants:[{name:'Variante 1',label:R,lower:w.split.variants[0].lower,upper:w.split.variants[0].upper,complete:false}]});
  // Never: the outside remainder of a split, the uncovered envelopes, the crossing parts or endpoint differences under assumption,
  // and no scope total under the assumption (shown values can still add up to one in particular cases, as on the page).
  const text=JSON.stringify(x),amounts=[];JSON.stringify(x.results,(k,val)=>{if(typeof val==='string'&&/^-?\d/.test(val))amounts.push(val);return val;});
  assert.doesNotMatch(text,/"(outside|covered|uncovered|crossing|negative|positive|inside|bounds|unusedShares|lower1|upper1|lower2|upper2|width1|full|scopeTotal)":/);
  const total=at25(wv.bounds.reference)+at25(wv.bounds.crossing.net)+['otherFixed','otherShared','unattributed'].reduce((s,k)=>s+at25(w.partition.rows.find(p=>p.part===k).value)*10000n,0n);
  for(const a of amounts)assert.ok(!feq(a,[total,10n**25n])&&!feq(a,wv.bounds.crossing.net)&&!feq(a,w.split.observed.covered.outside)&&!feq(a,w.split.observed.uncovered.negative),`not exported: ${a}`);
  assert.ok(amounts.length>20&&amounts.every(a=>/^-?\d+(?:\.\d+)?$|^-?\d+\/\d+$/.test(a)),'exact decimal (or exact fraction) strings');
  assert.deepEqual(x.statements,cPlanningStatements(w),'the statements of the page, in its order');
  for(const s of [L.statements.extremes,L.statements.notConfidence,L.variants.scenario,L.variants.compact,L.split.statement,L.split.inside,L.split.userNote])assert.ok(x.statements.includes(s),s);
  assert.deepEqual(JSON.parse(JSON.stringify(x)),x,'plain JSON: strings, integers, booleans and null only');
  for(const k of new Set(ROWS.map(x=>x.prodotto_key)))assert.ok(!text.includes(k),`no product rows (${k})`);
  assert.doesNotMatch(text,/Prodotto sintetico|TST01/);assert.doesNotMatch(text,/"(ranking|crossingSets|products|comparison)"/);
  // No split result where the page shows none: nothing to split, or a rule that covers nothing (the declared rule stays an assumption).
  for(const [st,status,line] of [[{...state,ids:['AA','BB','CC','DD'],rule:'eq',shares:{}},'nothing',L.split.nothing],[{...state,shares:{}},'uncovered',L.split.noneCovered]]){
    const e=cPlanningExport(v,st,'2026-10-19T10:00:00Z');assert.equal(cPlanningSplitStatus(cPlanningWorkspace(v,st)),status);
    assert.equal(e.results.split,null,status);assert.equal(e.assumptions.split.rule,st.rule);
    assert.ok(e.statements.includes(line)&&!e.statements.includes(L.split.statement)&&!e.statements.includes(L.split.inside),status);
  }
  // A zero single-portfolio part reads as on the page: no amount, the A12 item 9 note.
  const z=cPlanningExport(v,{...state,ids:['CC'],variants:[variant(1000)],rule:null,shares:{}},'2026-10-19T10:00:00Z'),note={value:null,note:L.observed.zeroFixed};
  assert.deepEqual([z.results.observed.partition[0],z.results.observed.reference,z.results.variants[0].reference],[{part:'fixed',id:'CC',label:L.observed.fixed,entries:null,...note},{label:L.bounds.reference,...note},{label:L.variants.reference,...note}]);
  assert.deepEqual([z.results.observed.members,z.results.variants[0].members,z.results.split],[[],[],null],'one portfolio: its own interval is the group interval');
  assert.deepEqual(cPlanningExport(v,{...state,rule:'eq'},'2026-10-19T10:00:00Z').assumptions.split,{rule:'eq',admission:C_PLANNING_ADMISSION,sharesPercent:{}});
  assert.deepEqual(cPlanningExport(v,{...state,rule:null,shares:{}},'2026-10-19T10:00:00Z').assumptions.split,{rule:null,admission:null,sharesPercent:{}});
  assert.throws(()=>cPlanningExport(v,{...state,org:'CH'},'2026-10-19T10:00:00Z'),code('C_PLANNING_EXPORT'));
  assert.throws(()=>cPlanningExport(v,state,'yesterday'),code('C_PLANNING_EXPORT'));
  assert.throws(()=>cPlanningExport({...v,sourceSnapshot:undefined},state,'2026-10-19T10:00:00Z'),code('C_PLANNING_EXPORT'));
  assert.ok(cPlanningExport(view('JM2026'),{...state,period:'JM2026'},'2026-10-19T10:00:00Z').statements.includes(cPlanningPartialText('JM2026')));
  assert.ok(!x.statements.some(s=>s.startsWith('(')),'the partial-period banner never appears without the period name');
  assert.equal(cPlanningExportName(state),'vis-scenari-FY2025-AQ-CO-AA-BB.json');
  assert.equal(JSON.stringify(v),before);
});

test('8. labels pass the copy lint; forbidden words appear only inside allowlisted negation sentences',()=>{
  const texts=cPlanningLabelTexts();assert.ok(texts.length>100);
  for(const t of texts)assert.deepEqual(cPlanningCopyLint(t),[],t);assert.deepEqual(cPlanningCopyLint(texts.join(' ')),[]);
  for(const term of ['risparmio','budget','scostamento','previsione aziendale','intervallo di confidenza','probabilit','reparto','area clinica','costo netto','persone trattate','pazienti','demo','tetto','sforament','obiettiv','verificat','dimostra','spesa netta','attribuzione clinica'])assert.ok(C_PLANNING_FORBIDDEN.includes(term),term);
  for(const s of C_PLANNING_NEGATIONS){assert.ok(texts.includes(s),s);assert.match(s,/(^|[^a-zà-ú])(non|nessun[oa]?|né)([^a-zà-ú]|$)/i,s);}
  const hits=texts.filter(t=>C_PLANNING_FORBIDDEN.some(f=>t.toLocaleLowerCase('it').includes(f)));
  assert.deepEqual([...hits].sort(),[...C_PLANNING_NEGATIONS].sort(),'every label with a forbidden word is an allowlisted negation');
  assert.deepEqual(cPlanningCopyLint('Il risparmio stimato del gruppo.').map(x=>x.term),['risparmio','risparmi']);
  assert.deepEqual(cPlanningCopyLint('Budget del portafoglio').map(x=>x.term),['budget']);
  assert.deepEqual(cPlanningCopyLint('Modalità DEMO').map(x=>x.term),['demo']);
  assert.deepEqual(cPlanningCopyLint(`${C_PLANNING_LABELS.statements.notMoney} Mostra il budget.`).map(x=>x.term),['budget']);
  // Caps, targets, overruns, verification claims, net spend and an affirmative clinical attribution are caught (the public doc says so).
  for(const [s,term] of [['Tetto di spesa del gruppo','tetto'],['Due tetti di spesa','tetti'],['Sforamento rispetto al riferimento','sforament'],['Obiettivo di spesa del portafoglio','obiettiv'],['Valori verificati','verificat'],['Spesa netta del gruppo','spesa netta'],['Le spese nette del gruppo','spese nette'],['La regola dimostra la ripartizione','dimostra'],['Attribuzione clinica del gruppo','attribuzione clinica'],['La spesa associata solo a quest’area è un’attribuzione clinica.','attribuzione clinica']])
    assert.deepEqual(cPlanningCopyLint(s).map(x=>x.term),[term],s);
  assert.deepEqual(cPlanningCopyLint(C_PLANNING_LABELS.variants.scenario),[],'«tetto» only inside the registered scenario caption');
  assert.deepEqual(cPlanningCopyLint(C_PLANNING_LABELS.section.mapping),[],'the mapping banner negates «attribuzione clinica» and is allowlisted');
  assert.deepEqual(cPlanningCopyLint(C_PLANNING_LABELS.section.mapping.replace('non un’attribuzione','un’attribuzione')).map(x=>x.term),['attribuzione clinica'],'an altered banner is not');
  assert.deepEqual(cPlanningCopyLint('<p class="x">Intervallo condizionale: non &#x27;è&#x27; un intervallo di confidenza e non esprime una probabilità.</p>').map(x=>x.term),['intervallo di confidenza','probabilit'],'an altered negation is not allowlisted');
  assert.deepEqual(cPlanningCopyLint('<p class="x">Ripartizione dichiarata (ipotesi): non è un dato osservato né un&#x27;attribuzione clinica e non <!-- -->esprime una probabilità.</p>'),[]);
  const L=C_PLANNING_LABELS,all=texts.join('\n');
  for(const s of ['Gli estremi dei singoli portafogli non sono raggiungibili contemporaneamente','Gli arrotondamenti possono non sommare','Scenario (ipotesi dichiarata) — non è una previsione','Ripartizione dichiarata (ipotesi)','resta non ripartita','restano non ripartite','fino a','Riservato ai revisori del progetto · contiene aggregati di più Aziende','non risparmio','Fuori da questa sezione','Ipotesi avanzate'])assert.ok(all.includes(s),s);
  assert.match(L.section.duration,/per un periodo della stessa durata del periodo di base/i);assert.ok(L.variants.compact.includes(L.section.durationInline),'the compact caption carries the time reading');
  assert.doesNotMatch(all,/20\d\d|punti base|Ripeti la variazione osservata/,'no calendar-year label, no «punti base», no observed-change preset');
  // F7: a review that places the product wholly outside the group narrows the interval too (A12 item 10).
  assert.equal(L.ranking.note,'Solo una revisione delle indicazioni che porta il prodotto tutto dentro o tutto fuori dal gruppo restringe l’intervallo: la riduzione indicata è un massimo.');
  // UI-07: the separation sentence says what a split result is (reference + declared group share) and never that nothing adds up.
  assert.doesNotMatch(L.section.separation,/non si sommano/);assert.match(L.section.separation,/nessun valore osservato viene modificato/);assert.doesNotMatch(L.section.separation,/grafico/,"not every layer has a chart in every state");assert.match(L.split.exposure,/osservata/);assert.match(L.section.separation,/aggiunge alla parte del gruppo che non dipende dalla ripartizione la quota dichiarata/);
  assert.equal('linear' in L.variants,false,'F8: no claim that the width ignores the variation');
  assert.deepEqual(C_PLANNING_READING,[L.statements.extremes,L.statements.conservation,L.statements.contains,L.statements.notConfidence,L.bounds.caption,L.statements.rounding,L.section.mapping,L.statements.exact,L.statements.notMoney]);
});

test('F3: the page-level «Azzera» (cInsightResetSearch) also clears every c_plan_* key and keeps unrelated ones',()=>{
  const q=new URLSearchParams(cInsightResetSearch('?c_port_org=TE&c_port_id=CC&c_plan_ids=CC.DD&c_plan_v1=2500&c_plan_v2=-100&c_plan_split=user&c_plan_shares=AA-CC.5000&cw_tab=2&unrelated=keep'));
  for(const k of [...C_PLANNING_PARAMS,'c_port_org','c_port_id','cw_tab'])assert.equal(q.has(k),false,k);
  assert.deepEqual([...q],[['unrelated','keep']]);
});

test('«Fuori da questa sezione»: keyed on org|period|channel, status only, never an amount',()=>{
  const acts=new Set(['TE|FY2024|CO','TE|FY2024|DD']);
  const out=(org,period,channel)=>cPlanningOutside({org,period,channel},acts);
  assert.deepEqual([out('TE','FY2024','CO').status,out('TE','FY2024','DPC').status,out('TE','FY2024','Tutti').status,out('AQ','FY2024','CO').status,out('TE','FY2025','CO').status],['act','none','act','none','none']);
  assert.deepEqual([out('Regione','FY2024','Tutti').status,out('Regione','FY2024','Tutti').orgs,out('Regione','FY2024','DPC').status],['within',['TE'],'none']);
  assert.equal(out('TE','FY2024','CO').key,'TE|FY2024|CO');
  for(const o of [out('TE','FY2024','CO'),out('Regione','FY2024','Tutti'),out('AQ','FY2025','Tutti')]){const t=[...o.budget,...o.regional].join(' ');assert.doesNotMatch(t,/\d|€/);assert.deepEqual(cPlanningCopyLint(t),[]);}
  for(const k of ['Regione|FY2024|CO','TE|FY2026|CO','TE|FY2024|Tutti',3])assert.throws(()=>cPlanningOutside({org:'TE',period:'FY2024',channel:'CO'},[k]),code('C_PLANNING_ACTS'));
});

test('the attribution view carries the immutable shard index as a required sourceSnapshot; the engine stays browser-safe',()=>{
  const loader=readFileSync(new URL('../lib/dashboard-review/pillar-c/attribution-loader.ts',import.meta.url),'utf8');
  assert.match(loader,/export type CAttrView = \{[^}]*sourceSnapshot: string;/);assert.match(loader,/sourceSnapshot:C_ATTR_STORAGE\.index,/);
  const engine=readFileSync(new URL('../lib/dashboard-review/pillar-c/planning.ts',import.meta.url),'utf8'),imports=engine.match(/^import .*$/gm);
  assert.deepEqual(imports.map(l=>l.match(/from "([^"]+)"/)[1]),['@/lib/dashboard-review/pillar-c/attribution','@/lib/dashboard-review/pillar-c/attribution-loader','@/lib/dashboard-review/pillar-c/workbook']);
  assert.match(imports[1],/^import type /,'the server-only loader is imported for its type only');
  assert.doesNotMatch(engine,/server-only|node:|CForecast|selectCForecast|parseCForecast|regional-forecast|forecast-section|CBudget|selectCReview|localStorage|fetch\(/);
});

const ROOT=path.resolve(process.env.PILLAR_C_ATTRIBUTION_ROOT||fileURLToPath(new URL('../../outputs/pillar-c/attribution-dashboard-20261018/',import.meta.url)));
const INDEX=path.join(ROOT,'index.json');
const pinned=existsSync(INDEX)&&createHash('sha256').update(readFileSync(INDEX)).digest('hex')===C_ATTR_STORAGE.index;
test('on the pinned private shards every scope passes C1 and the group identities (pass/fail only, no figures)',{skip:pinned?false:'the pinned private attribution index is not available locally'},async()=>{
  let scopes=0;
  for(const period of C_ATTR_PERIODS)for(const org of C_ATTR_ORGS)for(const channel of C_ATTR_CHANNELS){
    const loaded=await loadCAttrView(true,true,period,org,channel,{root:ROOT});assert.ok(loaded.state==='ready');
    assert.ok(loaded.view.sourceSnapshot===C_ATTR_STORAGE.index);
    const v=cPlanningAccept(JSON.parse(JSON.stringify(loaded.view)),period,org,channel),ids=v.portfolios.map(p=>p.id),st=v.scope.states;
    const canon=ids.includes('TRV')?'TRV':[...ids].sort()[0]; // the §4.6 / A02 item 2 canonical vertex, a test device only
    for(const b of v.scope.bounds){const o=cPlanningWorkspace(v,plan([b.id])).observed;assert.ok(o.lower1===b.lower1&&o.upper1===b.upper1&&o.lower2===b.lower2&&o.upper2===b.upper2,'single = L1/L2');}
    for(let i=0;i<ids.length;i+=5){const q=[ids[i],ids[(i+7)%ids.length],ids[(i+13)%ids.length]],m=q.map(id=>v.scope.bounds.find(b=>b.id===id)),g=new Set(q);
      const w=cPlanningWorkspace(v,plan(q,{rule:i%2?'prop':'eq',variants:[variant(350,-120)]})),o=w.observed;
      assert.ok(cPlanningCompare(fadd(...m.map(x=>x.lower1)).join('/'),o.lower1)<=0&&cPlanningCompare(o.upper1,fadd(...m.map(x=>x.upper1)).join('/'))<=0,'nested');
      assert.ok(at25(o.width1)<=m.reduce((t,x)=>t+(cAttrAtoms(x.upper1)-cAttrAtoms(x.lower1))*10000n,0n),'(d) width');
      const t1=m.reduce((t,x)=>t+cAttrAtoms(x.fixed),0n)+v.scope.products.filter(e=>e.state==='S3'&&g.has([...e.candidates].sort()[0])).reduce((t,e)=>t+cAttrAtoms(e.net),0n),t2=t1+(g.has(canon)?cAttrAtoms(st.S4.net)+cAttrAtoms(st.S5.net):0n);
      assert.ok(at25(o.lower1)<=t1*10000n&&t1*10000n<=at25(o.upper1)&&at25(o.lower2)<=t2*10000n&&t2*10000n<=at25(o.upper2),'(f) the canonical vertex lies inside L1 and L2');
      assert.ok(cPlanningCompare(o.lower1,w.split.observed.lower)<=0&&cPlanningCompare(w.split.observed.upper,o.upper1)<=0,'split inside');}
    scopes++;
  }
  assert.ok(scopes===80);
});
