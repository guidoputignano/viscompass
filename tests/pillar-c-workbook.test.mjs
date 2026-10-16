import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {C_WORKBOOK_HASH,C_WORKBOOK_SECTIONS,cWorkbookDecimal,cWorkbookLabel,cWorkbookRows,cWorkbookPlotRows,cWorkbookComparableColumns,cWorkbookLabelColumn,cWorkbookAxisLabel,parseCWorkbookIndex,parseCWorkbookSection} from '../lib/dashboard-review/pillar-c/workbook.ts';
import {loadCWorkbookIndex,loadCWorkbookSection} from '../lib/dashboard-review/pillar-c/workbook-loader.ts';
import {PILLAR_C_ALL_SECTIONS,pillarCSectionAtViewport} from '../lib/dashboard-review/pillar-c/section-navigation.ts';

const meta=()=>({id:'TEST-1',title:'Invented test only',section:'spesa',tier:'Fonte pubblica',qualifier:'—',grain:'anno',ranges:['Example!A1:C4'],availability:'snapshot',reason:null,sourceState:'review'});
const fixture=()=>({schema:'pillar-c-workbook-section-v1',workbookSha256:C_WORKBOOK_HASH,section:'spesa',formats:{0:'General',3:'#,##0',164:'#,##0.00 "€"',167:'0.0%'},outputs:[{...meta(),tables:[{sheet:'Example',range:'A1:C4',startColumn:1,columns:['Anno','Unità','Spesa (€)'],headerRow:1,rows:[[['2024',0],'A',['1.005',164]],[['2025',0],'B',null],[['2026',0],'A',['0',164]]],sourceRows:[2,3,4],notes:[],numericColumns:[2]}]}]});
const indexFor=p=>({schema:'pillar-c-workbook-index-v1',workbookSha256:C_WORKBOOK_HASH,outputs:[meta()],sections:{spesa:{sha256:createHash('sha256').update(JSON.stringify(p)).digest('hex'),bytes:Buffer.byteLength(JSON.stringify(p)),outputs:1}}});

test('all extended sections have unique anchors and follow their actual reading order',()=>{
  assert.equal(C_WORKBOOK_SECTIONS.length,14);assert.equal(new Set(C_WORKBOOK_SECTIONS.map(x=>x[0])).size,14);
  assert.equal(PILLAR_C_ALL_SECTIONS.at(-1).id,'evidenza');
  assert.equal(pillarCSectionAtViewport([{id:'spesa',top:-600},{id:'composizione',top:-100},{id:'attribuzione',top:300}],150,false,PILLAR_C_ALL_SECTIONS),'composizione');
});
test('exact workbook decimals retain cent ties, signs, large amounts and exponent values',()=>{
  for(const [input,p,percent,want] of [['1.005',2,false,'1,01'],['-1.005',2,false,'-1,01'],['1234567890123.005',2,false,'1.234.567.890.123,01'],['3.6398317899999998E-2',1,true,'3,6'],['0',2,false,'0,00'],['-0.004',2,false,'0,00']]) assert.equal(cWorkbookDecimal(input,p,percent),want);
  assert.equal(cWorkbookLabel(null,{0:'General'}),'—');assert.equal(cWorkbookLabel('n.a.',{0:'General'}),'n.a.');
  assert.equal(cWorkbookLabel(['0',164],{164:'#,##0.00 "€"'}),'0,00 €');
  assert.equal(cWorkbookLabel(['35.4',172],{172:'0.0" %"'}),'35,4 %');
  assert.equal(cWorkbookLabel(['2025',0],{0:'General'},'Anno'),'2025');
  assert.equal(cWorkbookLabel(['8744',0],{0:'General'},'Record'),'8.744');
});
test('strict section admits exact strings, keeps zero distinct and rejects injected fields',()=>{
  const p=fixture(),index=parseCWorkbookIndex(indexFor(p));const result=parseCWorkbookSection(p,'spesa',index);
  assert.equal(result.outputs[0].tables[0].rows[1][2],null);assert.equal(result.outputs[0].tables[0].rows[2][2][0],'0');
  for(const mutate of [p=>p.privateRows=[1],p=>p.section='outside',p=>p.outputs[0].tables[0].rows[0][2]=['NaN',164],p=>p.outputs[0].tables[0].sourceRows[0]=0,p=>p.outputs[0].tables[0].range='A1:Z900',p=>p.outputs[0].tables[0].numericColumns=[99],p=>p.outputs[0].tables[0].rows[0][2]=['1',999]]){
    const x=fixture();mutate(x);assert.throws(()=>parseCWorkbookSection(x,'spesa',index),/INVALID/);
  }
});
test('filters intersect, preserve missing cells and provide tie-stable numeric ordering',()=>{
  const table=fixture().outputs[0].tables[0];
  assert.deepEqual(cWorkbookRows(table,'A',{1:'A'},2,'asc').map(r=>r.sourceRow),[4,2]);
  assert.equal(cWorkbookRows(table,'B',{},2,'desc')[0].cells[2],null);
  assert.equal(cWorkbookRows(table,'not found',{},null,'asc').length,0);
  assert.equal(cWorkbookRows(table,'',{1:'B'},null,'asc').length,1);
});

test('plots preserve real zeros, line gaps, exact years and text-only support blocks',()=>{
  const p=fixture(),t=p.outputs[0].tables[0],rows=cWorkbookRows(t,'',{},null,'asc');
  const line=cWorkbookPlotRows(t,rows,p.formats,2,0,2,'line');
  assert.deepEqual(line.map(r=>r.value),[1.005,null,0]);
  assert.deepEqual(line.map(r=>r.name),['2024','2025','2026']);
  assert.equal(cWorkbookPlotRows(t,rows,p.formats,2,0,2,'bar').length,2);
  assert.deepEqual(cWorkbookPlotRows({...t,numericColumns:[]},rows,p.formats,-1,0,-1,'bar'),[]);
});

test('percentage axes use percentage units and overlays refuse mixed raw scales',()=>{
  const t={...fixture().outputs[0].tables[0],columns:['Label','Share','Share 2','Euros','Literal percent'],numericColumns:[1,2,3,4],rows:[['X',['0.25',167],['0.4',167],['10',164],['25',172]]],sourceRows:[2]};
  const formats={167:'0.0%',164:'#,##0.00 "€"',172:'0.0" %"'};
  assert.deepEqual(cWorkbookComparableColumns(t,1,formats),[2]);
  assert.equal(cWorkbookAxisLabel(0.25,t,1,formats),'25,0 %');
  assert.equal(cWorkbookAxisLabel(25,t,4,formats),'25,0 %');
  const plotted=cWorkbookPlotRows(t,cWorkbookRows(t,'',{},null,'asc'),formats,1,0,2,'bar',2);
  assert.equal(plotted[0].other,0.4);assert.equal(plotted[0].otherExact,'40,0 %');
});

test('automatic chart labels use categories, not a year-bearing numerical measure',()=>{
  const t={...fixture().outputs[0].tables[0],columns:['Codice','Categoria','Righe (n) · Anno 2024','G⁺ (€) · Anno 2024'],numericColumns:[2,3]};
  assert.equal(cWorkbookLabelColumn(t),1);
  assert.equal(cWorkbookLabelColumn(fixture().outputs[0].tables[0]),0);
});
test('unapproved and ordinary identities are refused before any artifact read',async()=>{
  let reads=0;const reader=async()=>{reads++;return null;};
  for(const [approved,reviewer] of [[false,false],[false,true],[true,false]]){
    assert.equal((await loadCWorkbookIndex(approved,reviewer,{},reader)).state,'forbidden');
    assert.equal((await loadCWorkbookSection('spesa',approved,reviewer,{},reader)).state,'forbidden');
  }
  assert.equal(reads,0);
});
test('tampering and unavailable transport fail without fallback',async()=>{
  assert.equal((await loadCWorkbookIndex(true,true,{},async()=>new TextEncoder().encode('{}'))).state,'invalid');
  assert.equal((await loadCWorkbookIndex(true,true,{},async()=>null)).state,'invalid');
});
test('private API repeats live role checks and never becomes a public path',()=>{
  const route=readFileSync(new URL('../app/api/pillar-c/workbook/route.ts',import.meta.url),'utf8');
  assert.match(route,/!org \|\| !\(viewer\?\.isReviewer \|\| admin\)/);assert.match(route,/private, no-store/);
  const page=readFileSync(new URL('../app/dashboard-review/pillar-c/page.tsx',import.meta.url),'utf8');
  assert.ok(page.indexOf('if (org && !projectReviewer)')<page.indexOf('loadCWorkbookIndex(Boolean(org)'));
});
