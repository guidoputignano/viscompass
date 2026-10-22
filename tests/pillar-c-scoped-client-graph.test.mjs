// Review finding UI-4: the province-to-pseudonym vocabulary (AQ/CH/PE/TE as keys of «ASL 1–4», or paired with
// them) must not reach any client bundle that the organisation-scoped audiences of /dashboard-review/pillar-c
// download. Next.js puts every client component a route's server modules import, and everything those import
// statically, into the route's entry chunks, which every visitor of the route loads; a dynamic import() inside a
// client module becomes its own chunk, fetched only where it renders. So this test rebuilds that graph from the
// sources with the TypeScript parser:
//   1. the server side of the route (root layout, dashboard-review layout, loading, error, the page), followed
//      until each "use client" module, which is a client root;
//   2. the static closure of the client roots (type-only imports are erased and not followed; a dynamic import()
//      is recorded as an async boundary and not followed);
// and asserts that no module of that closure has a province key as an object key, pairs a province token with an
// «ASL n» literal in one statement, or names C_ORG_LABELS; that the reviewer-only modules are outside it; and that
// the reviewer workspace is reached only through its dynamic wrapper. The detector is shown to find the
// vocabulary where it does live (reviewer-labels.ts and insights.ts; analytical-workspace.tsx names C_ORG_LABELS).
// The built chunks were also checked after `next build --webpack` (see the review record); this test is the
// deterministic, build-free guard.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {existsSync,readFileSync,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('..',import.meta.url));
const ts=createRequire(`${root}package.json`)('typescript');
const rel=f=>path.relative(root,f).split(path.sep).join('/');
const abs=r=>path.join(root,...r.split('/'));
const CODE=['.ts','.tsx','.mjs','.js','.jsx'];

/** A project module, or null for a package or a non-code file (CSS, images): those carry no project vocabulary. */
function resolveSpec(from,spec){
  let base;
  if(spec.startsWith('@/'))base=path.join(root,spec.slice(2));
  else if(spec.startsWith('.'))base=path.resolve(path.dirname(from),spec);
  else return null;
  if(existsSync(base)&&statSync(base).isFile())return CODE.includes(path.extname(base))?base:null;
  for(const e of CODE)if(existsSync(base+e))return base+e;
  for(const e of CODE)if(existsSync(path.join(base,`index${e}`)))return path.join(base,`index${e}`);
  throw new Error(`unresolved ${spec} from ${rel(from)}`);
}

const parsed=new Map();
function parse(file){
  if(parsed.has(file))return parsed.get(file);
  const sf=ts.createSourceFile(file,readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true,/x$/.test(file)?ts.ScriptKind.TSX:ts.ScriptKind.TS);
  const first=sf.statements[0];
  const info={file,sf,client:!!first&&ts.isExpressionStatement(first)&&ts.isStringLiteral(first.expression)&&first.expression.text==='use client',imports:[],dynamic:[]};
  const visit=node=>{
    if(ts.isImportDeclaration(node)){
      const c=node.importClause,named=c?.namedBindings&&ts.isNamedImports(c.namedBindings)?c.namedBindings.elements:null;
      const typeOnly=!!c&&(c.isTypeOnly||(!c.name&&!!named&&named.length>0&&named.every(e=>e.isTypeOnly)));
      if(!typeOnly)info.imports.push(node.moduleSpecifier.text);
    }else if(ts.isExportDeclaration(node)&&node.moduleSpecifier){
      const named=node.exportClause&&ts.isNamedExports(node.exportClause)?node.exportClause.elements:null;
      if(!(node.isTypeOnly||(!!named&&named.length>0&&named.every(e=>e.isTypeOnly))))info.imports.push(node.moduleSpecifier.text);
    }else if(ts.isCallExpression(node)&&node.expression.kind===ts.SyntaxKind.ImportKeyword&&node.arguments[0]&&ts.isStringLiteralLike(node.arguments[0])){
      info.dynamic.push(node.arguments[0].text);
    }
    ts.forEachChild(node,visit);
  };
  visit(sf);
  parsed.set(file,info);
  return info;
}

const ROUTE=['app/layout.tsx','app/dashboard-review/layout.tsx','app/dashboard-review/loading.tsx','app/dashboard-review/error.tsx','app/dashboard-review/pillar-c/page.tsx'];
function routeClientGraph(){
  const server=new Set(),roots=new Set();
  const walkServer=f=>{
    if(server.has(f))return;server.add(f);
    const m=parse(f);
    if(m.client){roots.add(f);return;}
    for(const s of [...m.imports,...m.dynamic]){const r=resolveSpec(f,s);if(r)walkServer(r);}
  };
  for(const r of ROUTE)walkServer(abs(r));
  const entry=new Set(),boundaries=[];
  const walkClient=f=>{
    if(entry.has(f))return;entry.add(f);
    const m=parse(f);
    for(const s of m.imports){const r=resolveSpec(f,s);if(r)walkClient(r);}
    for(const s of m.dynamic){const r=resolveSpec(f,s);if(r)boundaries.push([rel(f),rel(r)]);}
  };
  for(const f of roots)walkClient(f);
  return {roots:[...roots].map(rel).sort(),entry:[...entry].map(rel).sort(),boundaries};
}

// ------------------------------------------------------------------ the detector
const PROVINCE_KEY=/^(AQ|CH|PE|TE)$/;
const PROVINCE_TOKEN=/(^|[^A-Za-z])(AQ|CH|PE|TE)([^A-Za-z]|$)/;
const PSEUDONYM=/ASL\s?[1-4](?![0-9])/;
const keyText=n=>!n?null:ts.isIdentifier(n)||ts.isStringLiteralLike(n)||ts.isNumericLiteral(n)?n.text:ts.isComputedPropertyName(n)&&ts.isStringLiteralLike(n.expression)?n.expression.text:null;
/** The text a literal contributes; a regular expression's word boundaries are read as boundaries. */
function literalText(node){
  if(ts.isRegularExpressionLiteral(node))return node.text.replace(/\\[bB]/g,' ');
  if(ts.isStringLiteralLike(node)||ts.isTemplateHead(node)||ts.isTemplateMiddle(node)||ts.isTemplateTail(node)||ts.isJsxText(node))return node.text;
  return null;
}
const isStatementLike=n=>ts.isStatement(n)||ts.isClassElement(n)||ts.isSourceFile(n);
/** Every way a module can carry the province-to-pseudonym vocabulary at run time (comments and types excluded). */
function findings(file){
  const {sf}=parse(file),out=[],literals=[];
  const visit=node=>{
    if(ts.isObjectLiteralElementLike(node)&&node.parent&&ts.isObjectLiteralExpression(node.parent)&&!ts.isSpreadAssignment(node)){
      const key=keyText(node.name);
      if(key&&PROVINCE_KEY.test(key))out.push(`object key ${key}`);
    }
    if(ts.isIdentifier(node)&&node.text==='C_ORG_LABELS')out.push('C_ORG_LABELS');
    const text=literalText(node);
    if(text!==null)literals.push([node,text]);
    if(ts.isTypeNode(node))return;
    ts.forEachChild(node,visit);
  };
  visit(sf);
  // A province token and an «ASL n» literal in one statement: a replace chain, a ternary, a tuple, a labelled button.
  const statementOf=n=>{let p=n.parent;while(p&&!isStatementLike(p))p=p.parent;return p;};
  const pseudonymsIn=new Map();
  for(const [node,text] of literals)if(PSEUDONYM.test(text)){const s=statementOf(node);pseudonymsIn.set(s,true);}
  for(const [node,text] of literals){
    const m=text.match(PROVINCE_TOKEN);
    if(!m)continue;
    let s=statementOf(node);
    while(s&&!ts.isSourceFile(s)){if(pseudonymsIn.has(s)){out.push(`${m[2]} paired with an ASL pseudonym (line ${sf.getLineAndCharacterOfPosition(node.getStart()).line+1})`);break;}s=statementOf(s);}
  }
  return [...new Set(out)];
}

const REVIEWER_ONLY=['components/dashboard-review/pillar-c/analytical-workspace.tsx','components/dashboard-review/pillar-c/insight-panels.tsx',
  'lib/dashboard-review/pillar-c/insights.ts','lib/dashboard-review/pillar-c/insight-charts.ts','lib/dashboard-review/pillar-c/reviewer-labels.ts'];

test('the detector finds the province vocabulary where it lives, and only there',()=>{
  assert.deepEqual(findings(abs('lib/dashboard-review/pillar-c/reviewer-labels.ts')).sort(),['C_ORG_LABELS','object key AQ','object key CH','object key PE','object key TE']);
  assert.ok(findings(abs('lib/dashboard-review/pillar-c/insights.ts')).some(f=>/^AQ paired with an ASL pseudonym/.test(f)),'the replace chain of cInsightText');
  assert.ok(findings(abs('lib/dashboard-review/pillar-c/insights.ts')).includes('C_ORG_LABELS'));
  const reviewer=findings(abs('components/dashboard-review/pillar-c/analytical-workspace.tsx'));
  assert.deepEqual(reviewer,['C_ORG_LABELS'],JSON.stringify(reviewer)); // 1.2b removed the only literal pairing (the preset buttons); labels go through the map
  assert.ok(findings(abs('lib/dashboard-review/pillar-c/insights.ts')).some(f=>/^TE paired with an ASL pseudonym/.test(f)),'the replace chain of cInsightText');
  // Synthetic shapes: each is found, and an array of keys or a key compared with a period is not a mapping.
  let probes=0;
  const probe=src=>{const f=path.join(root,'tests',`.detector-probe-${probes++}.tsx`);
    parsed.set(f,{file:f,sf:ts.createSourceFile(f,src,ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),client:false,imports:[],dynamic:[]});return findings(f);};
  assert.deepEqual(probe('export const m={"TE":"x"};'),['object key TE']);
  assert.deepEqual(probe('export const m={["PE"]:1};'),['object key PE']);
  assert.deepEqual(probe('export const m=new Map([["CH","ASL 2"]]);'),['CH paired with an ASL pseudonym (line 1)']);
  assert.deepEqual(probe('export const f=(o:string)=>o==="AQ"?"ASL 1":o;'),['AQ paired with an ASL pseudonym (line 1)']);
  assert.deepEqual(probe("export const f=(s:string)=>s.replace(/\\bTE\\b/g,'ASL 4');"),['TE paired with an ASL pseudonym (line 1)']);
  assert.deepEqual(probe('export const B=()=><button onClick={()=>go("TE")}>Budget · ASL 4</button>;function go(_:string){}'),['TE paired with an ASL pseudonym (line 1)']);
  assert.deepEqual(probe('export const K=["Regione","AQ","CH","PE","TE"];export const ok=(o:string,p:string)=>o==="TE"&&p==="FY2024";export const L="ASL 1–4";'),[]);
  assert.deepEqual(probe('type T={AQ:string};export const x:T|null=null;'),[],'types are erased');
});

test('UI-4: no module of the route’s entry chunks carries a province key or its pseudonym',()=>{
  const graph=routeClientGraph();
  // Sanity: the graph is the real one.
  for(const r of ['components/dashboard-review/pillar-c/scoped-workspace.tsx','components/dashboard-review/pillar-c/reviewer-workspace.tsx','components/dashboard-review/pillar-c/regional-forecast-workspace.tsx'])
    assert.ok(graph.roots.includes(r),`client root ${r}`);
  for(const m of ['components/dashboard-review/pillar-c/review-blocks.tsx','components/dashboard-review/pillar-c/change-bridge.tsx','lib/dashboard-review/pillar-c/chart-kinds.ts',
    'lib/dashboard-review/pillar-c/reset-search.ts','lib/dashboard-review/pillar-c/audience-view.ts','lib/dashboard-review/pillar-c/review.ts','components/dashboard-review/pillar-c/planning-workspace.tsx'])
    assert.ok(graph.entry.includes(m),`entry module ${m}`);
  assert.ok(graph.entry.length>30,`${graph.entry.length} modules`);
  // The reviewer-only modules are outside the entry, and the reviewer workspace is reached only through its wrapper.
  for(const m of REVIEWER_ONLY)assert.ok(!graph.entry.includes(m),`${m} is in the scoped audiences' entry chunks`);
  assert.deepEqual(graph.boundaries.filter(([,to])=>to==='components/dashboard-review/pillar-c/analytical-workspace.tsx'),
    [['components/dashboard-review/pillar-c/reviewer-workspace.tsx','components/dashboard-review/pillar-c/analytical-workspace.tsx']]);
  assert.ok(!graph.roots.includes('components/dashboard-review/pillar-c/analytical-workspace.tsx'),'the page never imports the reviewer workspace directly');
  // No module of the entry carries the vocabulary in any form.
  const found=graph.entry.map(m=>[m,findings(abs(m))]).filter(([,f])=>f.length);
  assert.deepEqual(found,[],'province keys or pseudonym pairs in the entry chunks');
});

test('points 15-16: the guard vocabulary and the extension parsers stay on the server',()=>{
  // payload-guard.ts holds the place names, Azienda codes and reviewer-only key names; extension-parse.ts imports it.
  const graph=routeClientGraph();
  assert.ok(graph.entry.includes('components/dashboard-review/pillar-c/extension-sections.tsx'),'the extension blocks are client modules');
  assert.ok(graph.entry.includes('lib/dashboard-review/pillar-c/extension.ts'),'their browser-safe types and labels');
  for(const m of ['components/dashboard-review/pillar-c/extension-reviewer.tsx','lib/dashboard-review/pillar-c/payload-guard.ts','lib/dashboard-review/pillar-c/extension-parse.ts','lib/dashboard-review/pillar-c/extension-loader.ts','lib/dashboard-review/pillar-c/extension-storage.ts'])
    assert.ok(!graph.entry.includes(m),`${m} is in the route's client entry`);
});

test('UI-4: the scoped workspace names organisations only through the audience the server sends',()=>{
  const source=readFileSync(abs('components/dashboard-review/pillar-c/scoped-workspace.tsx'),'utf8');
  assert.match(source,/from "@\/components\/dashboard-review\/pillar-c\/review-blocks"/);
  assert.doesNotMatch(source,/analytical-workspace|pillar-c\/insights"|reviewer-labels|C_ORG_LABELS|C_ORGS|C_ATTR_ORGS/);
  assert.match(source,/const label = \(key: string\) => cAudienceLabel\(audience, key\) \?\? "";/);
  // review-blocks.tsx reads values only: no organisation key, label or audience at all.
  assert.doesNotMatch(readFileSync(abs('components/dashboard-review/pillar-c/review-blocks.tsx'),'utf8'),/C_ORG|audience|\.org\b|Regione|"(AQ|CH|PE|TE)"/);
});
