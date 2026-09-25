import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {itNumberFormat,itNumber} from '../lib/format/it-number.ts';
import {formatEur,formatNumber,formatPercent} from '../lib/dashboard-review/format.ts';

// The hazard: Italian sets minimumGroupingDigits = 2, so with useGrouping
// "auto" a four-digit number keeps its separator on one ICU build and drops it
// on another. Server and browser disagree, React reports a hydration mismatch,
// and it only shows up for some visitors. These tests pin the decision and,
// more usefully, stop it drifting back one formatter at a time.

test('four-digit values are grouped, which is the whole point',()=>{
  // The exact case that diverges between ICU builds.
  assert.equal(itNumber(8744),'8.744');
  assert.equal(itNumber(1000),'1.000');
  assert.equal(itNumber(9999),'9.999');
  // Three digits never group in any build; five-plus always do.
  assert.equal(itNumber(999),'999');
  assert.equal(itNumber(10000),'10.000');
});

test('the pin cannot be switched off by a caller',()=>{
  // useGrouping is applied last precisely so these cannot restore "auto".
  assert.equal(itNumber(8744,{useGrouping:false}),'8.744');
  assert.equal(itNumber(8744,{useGrouping:'auto'}),'8.744');
  assert.equal(itNumber(8744,{useGrouping:'min2'}),'8.744');
  // ES2023 normalises the resolved value: true becomes 'always'. What matters
  // is only that it is never 'auto' or 'min2', which are the ICU-dependent ones.
  const resolved=itNumberFormat({useGrouping:false}).resolvedOptions().useGrouping;
  assert.ok(resolved===true||resolved==='always',
    `useGrouping resolved to ${JSON.stringify(resolved)}; must never be auto or min2`);
});

test('caller options are otherwise respected',()=>{
  assert.equal(itNumber(8744.567,{maximumFractionDigits:2}),'8.744,57');
  assert.equal(itNumber(8744,{minimumFractionDigits:1,maximumFractionDigits:1}),'8.744,0');
  assert.equal(itNumber(0.0731,{style:'percent',maximumFractionDigits:1}),'7,3%');
  assert.equal(itNumber(0.05,{style:'percent',signDisplay:'exceptZero'}),'+5%');
  assert.match(itNumber(8744,{style:'currency',currency:'EUR',maximumFractionDigits:0}),/^8\.744\s*€$/);
});

test('a year through this formatter would be wrong, which is why years stay raw',()=>{
  // Documented in lib/format/it-number.ts. Chart X axes use dataKey="year" with
  // no tickFormatter and tables print {r.year}; this asserts the reason.
  assert.equal(itNumber(2025),'2.025');
  assert.equal(String(2025),'2025');
});

test('the shared formatters produce grouped output',()=>{
  assert.match(formatEur(8744),/8\.744/);
  assert.equal(formatNumber(8744,0),'8.744');
  assert.match(formatPercent(87.44),/8\.744/);
});

test('no it-IT formatter bypasses the helper',()=>{
  // The drift guard. Adding `new Intl.NumberFormat("it-IT", …)` anywhere else
  // reintroduces the hazard silently, because it only misbehaves when the
  // server's ICU and the visitor's disagree — which no local run reproduces.
  const roots=['components','lib','app'];
  const files=[];
  const walk=(d)=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){
    const p=path.join(d,e.name);
    if(e.isDirectory())walk(p); else if(/\.tsx?$/.test(e.name))files.push(p);}};
  roots.forEach(r=>fs.existsSync(r)&&walk(r));

  const bal=(src,open)=>{let d=0;for(let i=open;i<src.length;i++){
    if(src[i]==='(')d++;else if(src[i]===')'){d--;if(!d)return src.slice(open+1,i);}}return '';};

  const offenders=[];
  for(const f of files){
    if(f.replace(/\\/g,'/').endsWith('lib/format/it-number.ts')) continue;  // the helper itself
    const src=fs.readFileSync(f,'utf8');
    for(const m of src.matchAll(/new Intl\.NumberFormat|\.toLocaleString/g)){
      const open=src.indexOf('(',m.index+m[0].length-1);
      if(open===-1)continue;
      const a=bal(src,open);
      if(!/^\s*['"]it-IT['"]/.test(a))continue;
      // Compact notation is exempt: grouping is not meaningful for "1,2 Mln".
      if(/notation:\s*['"]compact/.test(a))continue;
      if(/useGrouping/.test(a))continue;   // explicitly pinned in place
      offenders.push(`${f.replace(/\\/g,'/')}:${src.slice(0,m.index).split('\n').length}`);
    }
  }
  assert.deepEqual(offenders,[],
    `these format it-IT numbers without pinning useGrouping — route them through itNumberFormat:\n  ${offenders.join('\n  ')}`);
});
