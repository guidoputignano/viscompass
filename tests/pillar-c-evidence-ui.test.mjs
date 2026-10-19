import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRequire,register} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {attributionFixture} from './fixtures/pillar-c-attribution.mjs';
import {PILLAR_C_ALL_SECTIONS,pillarCSectionAtViewport} from '../lib/dashboard-review/pillar-c/section-navigation.ts';
import {C_EVIDENCE_MAX_FILE} from '../lib/dashboard-review/pillar-c/evidence-priority.ts';
const root=fileURLToPath(new URL('..',import.meta.url));
register('data:text/javascript,'+encodeURIComponent(`
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
let sucrase;
export function initialize({pkg}){sucrase=createRequire(pkg)('sucrase');}
export async function resolve(specifier,context,next){return next(specifier==='next/navigation'?'next/navigation.js':specifier,context);}
export async function load(url,context,next){
 if(url.startsWith('file:')&&url.endsWith('.tsx')){const file=fileURLToPath(url);return {format:'module',source:sucrase.transform(readFileSync(file,'utf8'),{transforms:['typescript','jsx'],jsxRuntime:'automatic',production:true,filePath:file}).code,shortCircuit:true};}
 return next(url,context);
}`),{data:{pkg:pathToFileURL(`${root}package.json`).href}});
const req=createRequire(`${root}package.json`),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const {PillarCEvidenceCase,cEvidenceErrorText,cEvidenceReadText,cEvidenceCloseMissing,cEvidenceEventLines}=await import('../components/dashboard-review/pillar-c/evidence-workflow.tsx');
const {CAttributionView}=await import('../components/dashboard-review/pillar-c/attribution-analysis.tsx');
const source=file=>fs.readFileSync(fileURLToPath(new URL(`../${file}`,import.meta.url)),'utf8').replace(/\r\n/g,'\n');
const workflow=source('components/dashboard-review/pillar-c/evidence-workflow.tsx');

// Invented identities and products only.
const A='00000000-0000-4000-8000-00000000000a',B='00000000-0000-4000-8000-00000000000b';
const owners=[{id:A,label:'Referente sintetico A'},{id:B,label:'Referente sintetico B'}];
const baseCase=(patch={})=>({id:'00000000-0000-4000-8000-0000000000c1',source:{product_label:'Prodotto sintetico 1'},source_group:'1'.repeat(64),product_key:'900000001',state:'unassigned',revision:1,cycle_start_revision:1,decision_revision:null,follow_up_revision:null,owner_id:null,responsible_org_code:null,assigned_role:null,due_date:null,decision:null,decision_note:null,follow_up_owner_id:null,follow_up_due_date:null,follow_up_note:null,follow_up_outcome:null,created_at:'2026-10-19T10:00:00Z',updated_at:'2026-10-19T10:00:00Z',closed_at:null,...patch});
const attachment={id:'00000000-0000-4000-8000-0000000000f1',case_id:'00000000-0000-4000-8000-0000000000c1',file_name:'riepilogo-aggregato.csv',media_type:'text/csv',byte_size:2048,sha256:'e'.repeat(64),created_at:'2026-10-19T10:30:00Z'};
const html=(c,{attachments=[],events=[],current}={})=>renderToStaticMarkup(React.createElement(PillarCEvidenceCase,{detail:{case:c,attachments,events,current},owners,busy:false,onSave:async()=>true}));
const followUp=baseCase({state:'follow_up',revision:6,owner_id:A,assigned_role:'Farmacia',due_date:'2026-11-30',decision:'remains_uncertain',decision_note:'Motivazione',decision_revision:5,follow_up_owner_id:A,follow_up_due_date:'2026-12-01',follow_up_note:'Chiedere il centro di costo',follow_up_revision:6});

test('the attachment limit is 4 MB everywhere the reviewer reads it, and every API error code has truthful copy',()=>{
  assert.equal(C_EVIDENCE_MAX_FILE,4*1024*1024,'Vercel rejects function bodies above 4.5 MB');
  assert.match(workflow,/PDF, CSV o TXT fino a 4 MB\./);assert.doesNotMatch(workflow,/5 MB/);
  assert.match(workflow,/f\.size>C_EVIDENCE_MAX_FILE/,'the size is checked before any upload');
  const codes=['invalid','file','file_too_large','forbidden','actor','not_found','conflict','archived','owner','validation','unavailable'];
  const texts=codes.map(cEvidenceErrorText);
  assert.equal(new Set(texts).size,codes.length,'each code has its own message');
  assert.match(cEvidenceErrorText('file_too_large'),/4 MB/);assert.match(cEvidenceErrorText('file'),/fino a 4 MB/);
  assert.match(cEvidenceErrorText('actor'),/account non è abilitato/);
  assert.match(cEvidenceErrorText('archived'),/versione precedente.*sola lettura/);
  assert.match(cEvidenceErrorText('unavailable'),/nessuna modifica è stata confermata/);
  assert.equal(cEvidenceErrorText('something-new'),cEvidenceErrorText('unavailable'),'an unknown failure never claims that nothing changed');
  assert.doesNotMatch(cEvidenceErrorText('conflict'),/altra persona/,'a stale revision may be the reviewer’s own earlier save');
  assert.match(cEvidenceReadText('forbidden'),/revisori e amministratori/);
  // Non-JSON platform errors are mapped from the status, not parsed blindly.
  assert.match(workflow,/response\.json\(\)\.catch\(\(\)=>null\)/);assert.match(workflow,/response\.status===413\?"file_too_large"/);
});

test('closing names every missing precondition; trimmed drafts match the stored follow-up',()=>{
  const draft={owner:A,date:'2026-12-01',note:'Chiedere il centro di costo',outcome:''};
  assert.deepEqual(cEvidenceCloseMissing(followUp,0,draft,owners).map(m=>m.id),['attach','outcome']);
  assert.deepEqual(cEvidenceCloseMissing(followUp,1,{...draft,note:'Chiedere il centro di costo\n',outcome:'Fatto'},owners),[],'a trailing newline is not an unsaved change');
  assert.deepEqual(cEvidenceCloseMissing(followUp,1,{...draft,note:'Altro',outcome:'Fatto'},owners).map(m=>m.id),['save']);
  assert.deepEqual(cEvidenceCloseMissing(followUp,1,{...draft,outcome:'Fatto'},[owners[1]]).map(m=>m.id),['owner']);
  const page=html(followUp);
  assert.match(page,/Per chiudere servono almeno un documento allegato, un seguito salvato e un riscontro/);
  assert.match(page,/<li>Allega almeno un documento[^<]*<\/li><li>Compila il riscontro del seguito\.<\/li>/);
  assert.match(page,/<button type="button" disabled="" aria-describedby="[^"]+-close"[^>]*>.*?Chiudi la verifica<\/button>/);
  // Client sends trimmed text; whitespace-only notes cannot be submitted.
  for(const expr of ['note:note.trim()','note:followNote.trim(),outcome:outcome.trim()','{outcome:outcome.trim()}','{note:reopen.trim()}','role:role.trim()','disabled={busy||!note.trim()','disabled={busy||!followNote.trim()}','disabled={busy||!reopen.trim()}'])assert.ok(workflow.includes(expr),expr);
});

test('decision rules are stated before the reviewer meets them; reassigning an in-review case needs explicit confirmation',()=>{
  const page=html(baseCase({state:'in_review',revision:3,owner_id:A,assigned_role:'Farmacia',due_date:'2026-11-30'}));
  assert.match(page,/<option value="evidence_sufficient" disabled="">Evidenza ritenuta sufficiente per la verifica<\/option>/);
  assert.match(page,/«Evidenza ritenuta sufficiente per la verifica» richiede almeno un documento allegato/);
  assert.match(page,/Riassegna la verifica/);assert.match(page,/riporta la verifica allo stato «Assegnata»/);
  assert.match(page,/<button disabled="" class="[^"]*" type="submit"><span>Riassegna e torna ad «Assegnata»<\/span><\/button>/,'disabled until the confirmation is ticked');
  const withFile=html(baseCase({state:'in_review',revision:4,owner_id:A,assigned_role:'Farmacia',due_date:'2026-11-30'}),{attachments:[attachment]});
  assert.match(withFile,/<option value="evidence_sufficient">Evidenza ritenuta sufficiente/);
  const assigned=html(baseCase({state:'assigned',revision:2,owner_id:A,assigned_role:'Farmacia',due_date:'2026-11-30'}));
  assert.doesNotMatch(assigned,/riporta la verifica allo stato/);assert.match(assigned,/Salva assegnazione/);
  assert.match(page,/<h3 tabindex="-1"/,'the case heading takes focus when a case opens or saves');
});

test('after a reopen the previous cycle is labelled as such, not as the current decision',()=>{
  const reopened=baseCase({state:'in_review',revision:9,cycle_start_revision:9,owner_id:A,decision:'evidence_sufficient',decision_note:'Motivazione',decision_revision:5,follow_up_owner_id:A,follow_up_due_date:'2026-12-01',follow_up_note:'Chiedere il centro di costo',follow_up_outcome:'Fatto',follow_up_revision:6});
  const page=html(reopened,{attachments:[attachment]});
  assert.match(page,/Decisione del ciclo precedente \(superata dalla riapertura\)/);
  assert.match(page,/Seguito del ciclo precedente \(Referente sintetico A, 01\/12\/2026\): Chiedere il centro di costo/);
  assert.match(page,/Riscontro del ciclo precedente: Fatto/);
  assert.doesNotMatch(page,/>Decisione registrata</);
  assert.match(page,/<option value="remains_uncertain" selected="">/,'the new cycle starts from «ancora incerta»');
  const current=html(followUp);assert.match(current,/>Decisione registrata</);assert.doesNotMatch(current,/ciclo precedente/);
});

test('a case from an earlier priority snapshot is read only but keeps documents and history',()=>{
  const events=[{id:1,case_id:followUp.id,action:'assign',actor_id:A,created_at:'2026-10-19T10:00:00Z',revision:2,detail:{payload:{owner_id:B,role:'Farmacia ospedaliera',due_date:'2026-11-30'}}},{id:2,case_id:followUp.id,action:'attach',actor_id:B,created_at:'2026-10-19T11:00:00Z',revision:3,detail:{payload:{file_name:'riepilogo-aggregato.csv',storage_path:'x/y',sha256:'e'.repeat(64),attachment_id:'z'}}}];
  const page=html(followUp,{attachments:[attachment],events,current:false});
  assert.match(page,/data-current="false"/);assert.match(page,/Versione precedente della priorità · sola lettura/);
  assert.doesNotMatch(page,/<form|<input|<textarea|<select|Chiudi la verifica|Allega evidenza/);
  assert.match(page,/href="\/api\/pillar-c\/evidence\/[^"]+\/attachment\?attachment=[^"]+"/);
  assert.match(page,/Referente: Referente sintetico B\nRuolo o ufficio: Farmacia ospedaliera\nScadenza: 30\/11\/2026/);
  assert.match(page,/Documento: riepilogo-aggregato\.csv/);assert.doesNotMatch(page,/x\/y|e{64}/,'no storage path or hash in the visible history');
  assert.match(page,/19\/10\/2026, 12:00 · Referente sintetico A · versione 2/,'history time is pinned to Europe/Rome');
  assert.match(workflow,/Verifiche di una versione precedente della priorità \(sola lettura\)/);
  assert.match(workflow,/readOnly=detail\.current===false/);
});

test('history lines name the owner, role, due date and file, never raw identifiers',()=>{
  const name=id=>owners.find(o=>o.id===id)?.label??'Account non più nella rosa';
  assert.deepEqual(cEvidenceEventLines({action:'followup',detail:{payload:{owner_id:A,due_date:'2026-12-01',note:'Passo',outcome:''}}},name),['Responsabile del seguito: Referente sintetico A','Data del seguito: 01/12/2026','Prossimo passo: Passo']);
  assert.deepEqual(cEvidenceEventLines({action:'record_decision',detail:{payload:{decision:'needs_local_allocation',note:'Motivo'}}},name),['Decisione: Serve una ripartizione locale','Motivazione: Motivo']);
  assert.deepEqual(cEvidenceEventLines({action:'create',detail:{source:{product_key:'900000001'}}},name),[]);
});

test('every changing label is its own keyed element or single text child, so Chrome translation cannot leave it stale',()=>{
  for(const expr of ['<span key={c?"open":"prepare"}>{c?"Apri":"Prepara verifica"}</span>','<span key={busy?"busy":"idle"}>{busy?"Lettura della coda…":"Apri la coda condivisa"}</span>','{notice&&notice.tone!=="error"&&<span key={notice.id}>{notice.text}</span>}','{notice?.tone==="error"&&<span key={notice.id}>{notice.text}</span>}','<span key={superseded?"previous":"current"}>','{missing.map(m=><li key={m.id}>{m.text}</li>)}','<span key={fileError}>{fileError}</span>','{`${workspace.priority.count} voci prodotto`}'])assert.ok(workflow.includes(expr),expr);
  const DRIVEN=String.raw`\{(?:busy|notice|c\?|c\.|detail\.|workspace\.|archived|fileError|missing|superseded|inReview|readOnly|row\b|r\.)[^{}]*\}`;
  const TEXT=String.raw`[^<>{}\`\n]*[^<>{}\`\s][^<>{}\`\n]*`;
  assert.doesNotMatch(workflow,new RegExp(`>${TEXT}${DRIVEN}`));assert.doesNotMatch(workflow,new RegExp(`${DRIVEN}${TEXT}<`));
  // Formatting is pinned, never the visitor's locale defaults.
  assert.doesNotMatch(workflow,/\.toLocale(?:Date|Time)?String\(/);
  assert.match(workflow,/new Intl\.DateTimeFormat\("it-IT",\{[^}]*timeZone:"Europe\/Rome"\}\)/);
});

test('saves apply the returned case at once, keep focus in the editor and announce the outcome; open buttons wait for a save',()=>{
  assert.match(workflow,/apply\(saved\);\s*try\{await refresh\(saved\.id\);say\(/);
  assert.match(workflow,/Il salvataggio è confermato, ma l’aggiornamento della coda non è riuscito/);
  assert.match(workflow,/<p role="status"/);assert.match(workflow,/<p role="alert"/);
  assert.match(workflow,/heading\.current\?\.focus\(/);assert.match(workflow,/scrollIntoView\?\.\(\{block:"start"\}\)/);
  assert.match(workflow,/<button type="button" className=\{button\} disabled=\{busy\} onClick=\{\(\)=>void open\(r\)\}>/);
  assert.match(workflow,/if\(select\|\|selected\.current===id\)/,'a late read for another case never replaces the open one');
});

test('the queue is its own anchored, navigable section and states its boundaries',()=>{
  assert.match(workflow,/<section id="evidence-workflow" aria-labelledby="c-evidence-title" className="scroll-mt-6 space-y-5 xl:scroll-mt-56"/);
  assert.doesNotMatch(workflow.replace(/xl:scroll-mt-56/g,''),/scroll-mt-56/,'no 14rem offset outside the sticky xl layout');
  assert.match(workflow,/<h2 id="c-evidence-title"/);
  assert.match(workflow,/nessuna email automatica/);assert.match(workflow,/non la quota di attribuzione clinica/);
  assert.doesNotMatch(workflow,/\bdemo\b|dimostra|verificat|email inviat|inviat[ao] per email/i);
  const ids=PILLAR_C_ALL_SECTIONS.map(s=>s.id),at=ids.indexOf('evidence-workflow');
  assert.deepEqual(ids.slice(at-1,at+2),['priorita','evidence-workflow','evidenza']);
  assert.equal(new Set(ids).size,ids.length);
  assert.deepEqual(PILLAR_C_ALL_SECTIONS.filter(s=>s.number).map(s=>s.number),Array.from({length:14},(_,i)=>String(i+1).padStart(2,'0')),'workbook numbering stays 01–14');
  assert.equal(PILLAR_C_ALL_SECTIONS[at].number,'');
  assert.equal(pillarCSectionAtViewport([{id:'priorita',top:-900},{id:'evidence-workflow',top:-20},{id:'evidenza',top:900}],150,false,PILLAR_C_ALL_SECTIONS),'evidence-workflow');
  const page=source('components/dashboard-review/pillar-c/analytical-workspace.tsx');
  assert.ok(page.indexOf('section="priorita" /><PillarCEvidenceWorkflow />')>0&&page.indexOf('<PillarCEvidenceWorkflow />')<page.indexOf('<section id="evidenza"'));
  assert.match(source('components/dashboard-review/pillar-c/section-navigation.tsx'),/"evidence-workflow": ClipboardList/);
});

test('the attribution panel offers the queue as its own fixed perimeter, never as the current selection',()=>{
  const packet=attributionFixture();
  const view=(org,channel)=>({schema:'pillar-c-attribution-view-v1',mappingVersion:packet.mappingVersion,portfolios:packet.portfolios,scope:packet.scopes.find(s=>s.period==='FY2025'&&s.org===org&&s.channel===channel),comparison:null});
  const reference=renderToStaticMarkup(React.createElement(CAttributionView,{view:view('Regione','Tutti')}));
  assert.match(reference,/<a href="#evidence-workflow"[^>]*>Assegna le verifiche nella coda condivisa · priorità fissa: anno 2025, aggregato regionale, tutti i canali →<\/a>/);
  const other=renderToStaticMarkup(React.createElement(CAttributionView,{view:view('AQ','CO')}));
  assert.doesNotMatch(other,/Assegna le verifiche/);
  assert.match(other,/La coda condivisa delle verifiche usa una priorità fissa \(anno 2025, aggregato regionale, tutti i canali, condivisi ed evidenza insufficiente\) e non segue questa selezione/);
  assert.match(source('components/dashboard-review/pillar-c/attribution-analysis.tsx'),/scope\.period==="FY2025"&&scope\.org==="Regione"&&scope\.channel==="Tutti"&&pool==="therapeutic"&&query\.trim\(\)===""/);
});

test('unsaved decision and follow-up text survives the remount that follows an attachment, and saved text is not resurrected',()=>{
  const render=(c,draft,attachments=[])=>renderToStaticMarkup(React.createElement(PillarCEvidenceCase,{detail:{case:c,attachments,events:[],current:true},owners,busy:false,onSave:async()=>true,draft}));
  const reviewing=baseCase({state:'in_review',revision:4,owner_id:A,responsible_org_code:'SYN',assigned_role:'Farmacia',due_date:'2026-11-30'});
  // The editor is keyed by revision, so an attachment remounts it: the draft is what brings the typed text back.
  const after=render({...reviewing,revision:5},{decision:'needs_local_allocation',note:'Bozza non salvata della motivazione'},[attachment]);
  assert.match(after,/Bozza non salvata della motivazione<\/textarea>/);
  assert.match(after,/<option value="needs_local_allocation" selected="">/);
  assert.match(render(followUp,{outcome:'Riscontro in bozza'},[attachment]),/Riscontro in bozza<\/textarea>/);
  // Without a draft the fields start from the saved row.
  assert.doesNotMatch(render({...reviewing,revision:5},undefined,[attachment]),/Bozza non salvata/);
  assert.match(workflow,/"Decisione registrata",\["decision","note"\]\)/,'a recorded decision clears its draft');
  assert.match(workflow,/"Seguito salvato",FOLLOW_DRAFTS\)/);assert.match(workflow,/"Verifica chiusa",FOLLOW_DRAFTS\)/);
  assert.match(workflow,/if\(clear\?\.length\)setDrafts\([^\n]*\n\s*apply\(saved\);/,'drafts are cleared in the same batch as the saved row');
  assert.match(workflow,/failed==="archived"&&selected\.current\)void refresh\(selected\.current\)/,'a 409 archived re-reads the case so it turns read only');
  assert.doesNotMatch(workflow,/mappatura pubblicata/,'the mapping is a draft, not published');
});
