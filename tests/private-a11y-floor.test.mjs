// The private area's accessibility floor (XC-X5.1, XC-X5.3, PB-P14.1, PB-P1.2), checked in the source so a new
// component cannot quietly fall below it. The contrast and target sizes as drawn are measured in the live pass.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const read=p=>readFileSync(join(root,p),'utf8').replace(/\r\n/g,'\n');
const walk=d=>readdirSync(join(root,d)).flatMap(n=>{const p=`${d}/${n}`;return statSync(join(root,p)).isDirectory()?walk(p):/\.tsx$/.test(n)?[p]:[];});
const PRIVATE=['app/dashboard-review','components/dashboard-review','components/admin','components/access'].flatMap(walk);

test('no private text below 11 px',()=>{
  assert.ok(PRIVATE.length>40,'the private sources are found');
  for(const f of PRIVATE)assert.doesNotMatch(read(f),/text-\[(?:[0-9]|10)(?:\.\d+)?px\]/,f);
});

test('text on a filled teal sits on the strong shade, never on the brand teal',()=>{
  for(const f of [...PRIVATE,'components/ui/button.tsx','components/ui/badge.tsx','components/ui/checkbox.tsx']){
    const s=read(f);
    assert.doesNotMatch(s,/(?:^|[\s"'`:])bg-primary text-primary-foreground/,f);
    // A dense hover fill under white text; the light tints (/5, /10) carry dark or teal text.
    assert.doesNotMatch(s,/hover:bg-primary\/[5-9]\d\b/,f);
  }
});

test('the private shell darkens teal text and fills; the public pages keep the brand token',()=>{
  const css=read('app/globals.css');
  const root_=css.slice(css.indexOf(':root {'),css.indexOf('.dark {'));
  assert.match(root_,/--primary: 174 66% 36%;/);assert.match(root_,/--primary-text: 174 66% 36%;/);assert.match(root_,/--primary-strong: 174 66% 36%;/);
  assert.match(css,/\.vis-private \{\n\s+--primary-text: 174 66% 28%;\n\s+--primary-strong: 174 66% 28%;\n\s+\}/);
  assert.match(css,/\.dark \.vis-private \{[^}]*--primary-text: 174 75% 45%;/);
  assert.match(css,/\.dark \.vis-private \{[^}]*--primary-foreground: 199 57% 10%;/);
  assert.match(read('tailwind.config.ts'),/textColor: \{\n\s+primary: \{\n\s+DEFAULT: "hsl\(var\(--primary-text\)\)"/);
  assert.match(read('components/dashboard-review/nav.tsx'),/className=\{`vis-private flex min-h-svh/);
  assert.match(read('components/access/access-portal.tsx'),/className="vis-private min-h-svh/);
});

test('the loading state is announced, and its skeleton is decoration',()=>{
  const s=read('app/dashboard-review/loading.tsx');
  assert.match(s,/<p role="status"[^>]*>\s*Caricamento dell’analisi in corso/);
  assert.match(s,/<div aria-hidden="true" className="[^"]*motion-safe:animate-pulse/);
  assert.doesNotMatch(s,/(?<!motion-safe:)animate-pulse/);
});

test('every private module page has a title of its own',()=>{
  const titles={};
  for(const d of readdirSync(join(root,'app/dashboard-review'))){
    const f=`app/dashboard-review/${d}/page.tsx`;
    let s;try{s=read(f);}catch{continue;}
    if(/^\s*redirect\(/m.test(s)||/^"use client";/.test(s))continue;
    const m=s.match(/export const metadata: Metadata = \{\n\s+title: "([^"]+)"/);
    assert.ok(m,`${f} exports a title`);
    assert.match(m[1],/ \| VIS$/,f);
    titles[m[1]]=(titles[m[1]]||0)+1;
  }
  assert.ok(Object.keys(titles).length>=8,'the module pages are found');
  for(const [t,n] of Object.entries(titles))assert.equal(n,1,`${t} is unique`);
});
