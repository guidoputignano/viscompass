// Pillar C organisation-scoped delivery: source pins that keep the scoped path session-only, cache-free and
// free of province keys, and the reviewer path where it was. These complement the behavioural tests.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync,readFileSync,readdirSync,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';

const root=fileURLToPath(new URL('..',import.meta.url));
const read=p=>readFileSync(path.join(root,p),'utf8');
const walk=dir=>readdirSync(path.join(root,dir)).flatMap(n=>{const p=`${dir}/${n}`;return statSync(path.join(root,p)).isDirectory()?walk(p):/\.(ts|tsx)$/.test(n)?[p]:[];});
const PILLAR_C=['lib/dashboard-review/pillar-c','app/api/pillar-c','app/dashboard-review/pillar-c','components/dashboard-review/pillar-c'].flatMap(walk);
const SCOPED=['audience.ts','audience-rules.ts','scoped-units.ts','scoped-storage.ts','scoped-transport.ts','scoped-review.ts','scoped-loader.ts','scoped-route.ts','payload-guard.ts'].map(f=>`lib/dashboard-review/pillar-c/${f}`).concat('components/dashboard-review/pillar-c/scoped-workspace.tsx');

test('no cross-request cache primitive anywhere in Pillar C (cacheComponents would share scoped data across users)',()=>{
  assert.ok(PILLAR_C.length>40);
  for(const file of PILLAR_C)assert.doesNotMatch(read(file),/["']use cache(?::[a-z]+)?["']|unstable_cache|cacheTag|cacheLife/,file);
});

test('the scoped modules never touch the service role, a server cache, a reviewer transport or an environment switch',()=>{
  for(const file of SCOPED){
    const source=read(file);
    assert.doesNotMatch(source,/SUPABASE_SERVICE_ROLE_KEY|createServiceRoleClient|\/service-role"|createServerCache|\/server-cache"|readCReviewStoragePacket|unstable_noStore/,file);
    assert.doesNotMatch(source,/^import (?!type )[^;]*from "@\/lib\/dashboard-review\/pillar-c\/(attribution-loader|portfolio-loader|review-loader|workbook-loader|review-storage|attribution-storage|portfolio-storage|workbook-storage|evidence-server|regional-forecast-loader)"/m,file);
    assert.doesNotMatch(source,/^(?:export )?(?:let|var) |^(?:export )?const \w+ ?= ?new (?:Map|WeakMap|Set)\(/m,`${file}: no module-level mutable state`);
    const env=[...source.matchAll(/process\.env\.(\w+)/g)].map(m=>m[1]);
    assert.deepEqual(env,file.endsWith('/audience.ts')?['VERCEL_ENV']:[],`${file}: the only environment read is the production guard`);
  }
});

test('the scoped transport reads only through the session client it is given, with no-store, from the scoped bucket',()=>{
  const transport=read('lib/dashboard-review/pillar-c/scoped-transport.ts');
  assert.match(transport,/db\.storage\.from\(C_SCOPED_STORAGE\.bucket\)\.download\(path, \{\}, \{ signal: AbortSignal\.timeout\(timeoutMs\), cache: "no-store" \}\)/);
  assert.match(transport,/^import type \{ createClient \} from "@\/lib\/supabase\/server";\r?$/m,'a type only: the transport cannot create a client');
  assert.doesNotMatch(transport,/fetch\(|Authorization|apikey/);
  for(const file of ['scoped-loader.ts','scoped-review.ts','payload-guard.ts','audience-rules.ts'])assert.doesNotMatch(read(`lib/dashboard-review/pillar-c/${file}`),/^import [^;]*"@\/lib\/supabase\//m,file);
  // The effective policy is the latest migration that recreates it (20261023200000 adds the folder «regione»).
  const migration=read('supabase/migrations/20261023200000_pillar_c_scoped_regione_folder.sql');
  const policy=/ and name ~ '(\^v[^']+)'/.exec(migration)[1];
  const {source}=/C_SCOPED_POLICY_NAME = (\/.+\/);/.exec(transport).slice(1).map(s=>({source:s.slice(1,-1).replaceAll('\\/','/')}))[0];
  assert.equal(source,policy,'the transport refuses exactly what the policy refuses');
  assert.match(migration,/'pillar-c-scoped'/);
  assert.equal(/ and name ~ '(\^v[^']+)'/.exec(read('supabase/migrations/20261020120000_pillar_c_scoped_storage.sql'))[1],policy.replace('|regione',''),'the successor only adds the regional folder');
});

test('no province key and no Azienda mapping in the scoped modules (the mapping lives only in the private builder)',()=>{
  for(const file of SCOPED){
    const source=read(file);
    assert.doesNotMatch(source,/["'`](AQ|CH|PE|TE)["'`]/,file);
    assert.doesNotMatch(source,/\b(AQ|CH|PE|TE)\s*[:=]\s*["'`]?asl-|asl-[1-4]["'`]?\s*[:=]\s*["'`](AQ|CH|PE|TE)/,file);
  }
  const guard=read('lib/dashboard-review/pillar-c/payload-guard.ts');
  assert.equal((guard.match(/AQ\|CH\|PE\|TE/g)||[]).length,1,'only the token regex itself names them');
});

test('the pins: scoped bucket and build, and the reviewer pins each index declares as its source',async()=>{
  const storage=read('lib/dashboard-review/pillar-c/scoped-storage.ts');
  const pin=(name)=>new RegExp(`${name}: "([a-f0-9]{64})"`).exec(storage)[1];
  assert.equal(pin('review'),/sha256: "([a-f0-9]{64})"/.exec(read('lib/dashboard-review/pillar-c/review-storage.ts'))[1]);
  assert.equal(pin('attribution'),/index: "([a-f0-9]{64})"/.exec(read('lib/dashboard-review/pillar-c/attribution-storage.ts'))[1]);
  assert.equal(pin('portfolio'),/index: "([a-f0-9]{64})"/.exec(read('lib/dashboard-review/pillar-c/portfolio-storage.ts'))[1]);
  assert.match(storage,/bucket: "pillar-c-scoped",\s+root: "v1",\s+build: "rec5-scoped-v1"/);
  const units=[...storage.matchAll(/"(asl-[1-4]|aggregato)": "([a-f0-9]{64})"/g)].map(m=>m[1]);
  assert.deepEqual(units,['asl-1','asl-2','asl-3','asl-4','aggregato']);
});

const PINS=fileURLToPath(new URL('../../outputs/pillar-c/rec5/PINS.json',import.meta.url));
test('the pins equal the private build receipt (pass/fail only)',{skip:existsSync(PINS)?false:'the private build receipt is not available locally'},()=>{
  const pins=JSON.parse(readFileSync(PINS,'utf8')),storage=read('lib/dashboard-review/pillar-c/scoped-storage.ts');
  assert.equal(pins.schema,'pillar-c-scoped-pins-v1');assert.equal(pins.bucket,'pillar-c-scoped');assert.equal(pins.root,'v1');assert.equal(pins.build,'rec5-scoped-v1');
  for(const [unit,{index}] of Object.entries(pins.units)){
    assert.ok(storage.includes(`"${unit}": "${index.sha256}"`),unit);
    assert.equal(index.path,`v1/${unit}/index-${index.sha256}.json`);
  }
  assert.deepEqual(pins.audiences['azienda:204'],['asl-4','aggregato']);assert.deepEqual(pins.audiences['regione:130'],['asl-1','asl-2','asl-3','asl-4','aggregato']);
  assert.equal(createHash('sha256').update(storage).digest('hex').length,64);
});

test('routes: the reviewer gate is where it was; the scoped branch is inside the non-reviewer block; workbook and evidence stay reviewer-only',()=>{
  for(const [file,loader] of [['app/api/pillar-c/attribution/route.ts','loadCAttrView(true,true,'],['app/api/pillar-c/portfolio/route.ts','loadCPortfolioView(true, true, ']]){
    const s=read(file),gate=s.indexOf('if (!org || !(viewer?.isReviewer || admin)) {'),scoped=s.indexOf('cScopedGET(request, audience,'),forbidden=s.indexOf('"forbidden"'),reviewer=s.indexOf(loader);
    assert.ok(gate>0&&gate<scoped&&scoped<forbidden&&forbidden<reviewer,file);
    assert.match(s,/const audience = org \? await resolvePillarCMemberAudience\(org\) : null;/);
    assert.match(s,/private, no-store, max-age=0/);
  }
  const workbook=read('app/api/pillar-c/workbook/route.ts');
  assert.match(workbook,/!org \|\| !\(viewer\?\.isReviewer \|\| admin\)/);assert.doesNotMatch(workbook,/audience|scoped/i);
  for(const file of ['app/api/pillar-c/evidence/route.ts','app/api/pillar-c/evidence/[id]/route.ts','app/api/pillar-c/evidence/[id]/attachment/route.ts']){
    const s=read(file);assert.match(s,/cEvidenceActor/,file);assert.doesNotMatch(s,/audience|scoped/i,file);
  }
});

test('page: reviewer loaders only after the reviewer gate; the scoped branch never names them',()=>{
  const s=read('app/dashboard-review/pillar-c/page.tsx');
  const member=s.indexOf('if (org && !projectReviewer) {'),resolve=s.indexOf('await resolvePillarCMemberAudience(org)'),gate=s.indexOf('if (!projectReviewer) {');
  assert.ok(member>0&&member<resolve&&resolve<gate);
  for(const name of ['loadCReviewPacket(Boolean(org)','loadCWorkbookIndex(Boolean(org)','loadCExtensionReviewer(Boolean(org)','loadCAdditionsReviewer(Boolean(org)'])assert.ok(s.indexOf(name)>gate,name);
  const scoped=s.slice(s.indexOf('async function scopedPillarC'),s.indexOf('export default async function PillarCPage'));
  assert.ok(scoped.length>200);assert.doesNotMatch(scoped,/loadCReviewPacket|loadCWorkbookIndex|loadCExtensionReviewer|loadCAdditionsReviewer|PillarCAnalyticalWorkspace|workbook/);
  // One session client for the review, the extension and the additions: all read under Storage RLS.
  assert.match(scoped,/const db = await createClient\(\)/);assert.match(scoped,/loadCScopedReview\(audience, db\)/);assert.match(scoped,/loadCExtensionScoped\(audience, db, /);
  assert.match(scoped,/loadCAdditionsScoped\(audience, db, /);
  // Additions (owner decision D24-4): in both branches, checked against the extension's January recipients before any render.
  const reviewer=s.slice(s.indexOf('if (!projectReviewer) {'));
  for(const branch of [scoped,reviewer])assert.equal(branch.split('= cAdditionsWithExtension(added, extension);').length-1,1);
});

test('additions (D24-4): the parser and the pins stay on the server, with no cache, service role or environment switch',()=>{
  for(const file of ['additions-parse.ts','additions-storage.ts'].map(f=>`lib/dashboard-review/pillar-c/${f}`)){
    const source=read(file);
    assert.match(source,/^import "server-only";/,file);
    assert.doesNotMatch(source,/SUPABASE_SERVICE_ROLE_KEY|createServiceRoleClient|process\.env|createServerCache|unstable_noStore/,file);
    assert.doesNotMatch(source,/^(?:export )?(?:let|var) |^(?:export )?const \w+ ?= ?new (?:Map|WeakMap|Set)\(/m,`${file}: no module-level mutable state`);
    assert.doesNotMatch(source,/["'`](AQ|CH|PE|TE)["'`]/,file);
  }
  // The loader: the service role only in the reviewer read, behind the gate; the scoped reads through the session transport.
  const loader=read('lib/dashboard-review/pillar-c/additions-loader.ts');
  assert.match(loader,/^import "server-only";/);
  assert.equal(loader.split('process.env.SUPABASE_SERVICE_ROLE_KEY').length-1,1,'one service-role read');
  assert.ok(loader.indexOf('process.env.SUPABASE_SERVICE_ROLE_KEY')<loader.indexOf('export async function loadCAdditionsReviewer'),'inside the reviewer object reader');
  assert.match(loader,/if \(!approved \|\| !projectReviewer\) return \{ state: "forbidden" \};\r?\n  const read = await remote\(\);/,'the gate before the read');
  const scoped=loader.slice(loader.indexOf('export async function loadCAdditionsScoped'));
  assert.doesNotMatch(scoped,/remote\(|fetch\(|process\.env/);assert.match(scoped,/readCScopedObject\(db, unit, /);assert.match(scoped,/readCScopedRegionalObject\(db, pin\.name, /);
  assert.doesNotMatch(loader,/["'`]use cache|unstable_cache|new Map\(/);
});
