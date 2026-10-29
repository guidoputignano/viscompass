// PILLAR C SIX-SECTION NAVIGATION, commits 1.2a and 1.2c of docs/PILLAR_C_SIX_SECTIONS_20261022.md.
// 1.2a added the six-entry list and the compact bar PillarCSectionBar beside the old lists and the old component; 1.2c
// deleted the old lists, the old component and the workbook dependency, renamed the list PILLAR_C_SECTIONS, moved the
// fallback to "quadro" and gave the bar an optional list of the sections a page renders (forecast_only renders section 5
// only). Pure-function checks on the lib, server-side renders of the bar (react-dom/server through the same sucrase
// loader as shell-navigation) and source pins. Synthetic geometry only: no organisation, no spend figure, no real value.
import test from 'node:test';
import assert from 'node:assert/strict';
import {register,createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';

const root=fileURLToPath(new URL('..',import.meta.url));
const read=p=>readFileSync(`${root}${p}`,'utf8').replace(/\r\n/g,'\n');

register('data:text/javascript,'+encodeURIComponent(`
import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';
let sucrase;export function initialize({pkg}){sucrase=createRequire(pkg)('sucrase');}
const nav='data:text/javascript,'+encodeURIComponent('export function usePathname(){return "/dashboard-review/pillar-c"}export function useRouter(){return {push(){},refresh(){},replace(){}}}export function useSearchParams(){return new URLSearchParams("")}');
export async function resolve(s,c,n){if(s==='next/navigation')return {url:nav,shortCircuit:true};return n(s==='next/link'?s+'.js':s,c);}
export async function load(u,c,n){if(u.startsWith('file:')&&u.endsWith('.tsx')){const f=fileURLToPath(u);return {format:'module',source:sucrase.transform(readFileSync(f,'utf8'),{transforms:['typescript','jsx'],jsxRuntime:'automatic',production:true,filePath:f}).code,shortCircuit:true};}return n(u,c);}
`),{data:{pkg:pathToFileURL(`${root}package.json`).href}});
const req=createRequire(`${root}package.json`),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const h=React.createElement,render=el=>renderToStaticMarkup(el);
const LIB_EXPORTS=await import('../lib/dashboard-review/pillar-c/section-navigation.ts'),{PILLAR_C_SECTIONS,pillarCSectionAtViewport}=LIB_EXPORTS;
const NAV_EXPORTS=await import('../components/dashboard-review/pillar-c/section-navigation.tsx'),{PillarCSectionBar}=NAV_EXPORTS;

const LIB='lib/dashboard-review/pillar-c/section-navigation.ts';
const COMPONENT='components/dashboard-review/pillar-c/section-navigation.tsx';

// The six sections of the design record, section 1, verbatim: id, numeral, title, question.
const SIX=[
  ['quadro','1','Quadro decisionale','La spesa è cambiata perché più persone sono state trattate o perché i prodotti costano di più, e di quanto?'],
  ['destinatari','2','Assistiti e utilizzo','Quante persone trattate raggiunge la spesa e con quale utilizzo?'],
  ['portafogli-attribuzione','3','Portafogli e attribuzione','Quanto spende ciascun raggruppamento terapeutico e quanta spesa resta condivisa o incerta?'],
  ['fattori','4','Fattori di spesa','Come cambia la spesa nel tempo e quali prodotti spiegano la variazione?'],
  ['budget-scenari','5','Budget e scenari','Che cosa dicono gli atti di budget, le ipotesi dichiarate e la previsione regionale?'],
  ['priorita-evidenza','6','Priorità ed evidenza','Che cosa verificare per primo e su quali fonti si basano le analisi?'],
];
const SIX_IDS=SIX.map(([id])=>id);
// The old six-entry list as it stood until 1.2c (ids, two-digit numbers, labels, descriptions); deleted in 1.2c. Kept
// here so that no description text and no old id can come back.
const OLD_SECTIONS=[
  {id:'spesa',number:'01',label:'Spesa',description:'Andamento e importi'},
  {id:'cambiamento',number:'02',label:'Variazioni',description:'Confronti nel tempo'},
  {id:'pianificazione',number:'03',label:'Budget',description:'Piani e allocazioni'},
  {id:'numerosita',number:'04',label:'Numerosità',description:'Scenari CO'},
  {id:'previsione',number:'05',label:'Previsione',description:'Regionale, fonte pubblica'},
  {id:'evidenza',number:'06',label:'Evidenza',description:'Fonti e metodo'},
];
const OLD_SCOPED_IDS=['portafogli','scenari','spesa','attribuzione','cambiamento','pianificazione','numerosita','previsione','evidenza'];
// The nine scoped entries and the seventeen reviewer entries as they stood until 1.2c (both deleted in 1.2c).
const OLD_SCOPED=[
  {id:'portafogli',label:'Dossier',description:'Portafogli e prossimi passi',number:''},
  {id:'scenari',label:'Scenari',description:'Ipotesi e intervalli per portafogli',number:''},
  {id:'spesa',number:'01',label:'Spesa',description:'Andamento e importi'},
  {id:'attribuzione',number:'02',label:'Attribuzione',description:'Copertura e incertezza'},
  {id:'cambiamento',number:'03',label:'Variazioni',description:'Confronti nel tempo'},
  {id:'pianificazione',number:'04',label:'Budget',description:'Atti pubblicati e allocazioni'},
  {id:'numerosita',number:'05',label:'Numerosità',description:'Scenari CO'},
  {id:'previsione',number:'06',label:'Previsione',description:'Regionale, fonte pubblica'},
  {id:'evidenza',number:'07',label:'Evidenza',description:'Fonti e metodo'},
];
const OLD_ALL=[
  ['portafogli','','Dossier','Portafogli e prossimi passi'],
  ['scenari','','Scenari','Ipotesi e intervalli per portafogli'],
  ['spesa','01','Spesa','Importi e copertura'],
  ['composizione','02','Composizione','ATC e portafogli'],
  ['attribuzione','03','Attribuzione','Copertura e incertezza'],
  ['cambiamento','04','Variazioni','Prodotti e contributi'],
  ['costi','05','Prezzo, volume e mix','Supporto e scomposizioni'],
  ['confronti','06','Confronti','Indici e comparabilità'],
  ['attivita','07','Attività e contesto','Fonti pubbliche e territori'],
  ['pianificazione','08','Budget','Atti, ipotesi e allocazioni'],
  ['numerosita','09','Numerosità','Scenari CO'],
  ['tendenze','10','Andamenti','Variazioni e tendenze'],
  ['previsione','11','Previsione','Previsioni e scenari'],
  ['sensibilita','12','Sensibilità','Ipotesi alternative'],
  ['priorita','13','Priorità','Domande di revisione'],
  ['evidence-workflow','','Verifiche','Coda condivisa 2025'],
  ['evidenza','14','Evidenza','Fonti e tracciabilità'],
];
// What a scoped render must never emit (tests/pillar-c-scoped-ui.test.mjs REVIEWER_ONLY, the id part), and the
// words no Pillar C surface may carry.
const REVIEWER_ONLY=/id="evidence-workflow"|href="#evidence-workflow"|href="#costi"|id="(composizione|costi|confronti|attivita|tendenze|sensibilita|priorita)"/;
const NEVER=/NaN|Infinity|undefined|\b[Dd]emo\b|[Dd]imostra|[Vv]erificat|in arrivo/;

/** The anchors of a rendered fragment: href, attributes, and the text a screen reader gets (svg and aria-hidden spans removed). */
function anchors(html){
  return [...html.matchAll(/<a\s([^>]*)>([\s\S]*?)<\/a>/g)].map(([,attrs,inner])=>({
    href:attrs.match(/href="([^"]*)"/)?.[1]??null,
    current:attrs.match(/aria-current="([^"]*)"/)?.[1]??null,
    classes:attrs.match(/class="([^"]*)"/)?.[1]??'',
    text:inner.replace(/<svg[\s\S]*?<\/svg>/g,'').replace(/<span aria-hidden="true"[^>]*>[^<]*<\/span>/g,'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim(),
    attrs,
  }));
}

test('PILLAR_C_SECTIONS: six entries in page order with numerals "1" to "6", titles and questions verbatim, unique ids, none reused from the old lists',()=>{
  assert.deepEqual(PILLAR_C_SECTIONS.map(s=>[s.id,s.number,s.label,s.question]),SIX);
  assert.deepEqual(PILLAR_C_SECTIONS.map(s=>s.number),['1','2','3','4','5','6']);
  assert.equal(new Set(SIX_IDS).size,6);
  for(const s of PILLAR_C_SECTIONS)assert.deepEqual(Object.keys(s).sort(),['id','label','number','question'],s.id);
  const old=new Set([...OLD_SECTIONS.map(s=>s.id),...OLD_SCOPED_IDS,...OLD_ALL.map(([id])=>id)]);
  for(const id of SIX_IDS)assert.ok(!old.has(id),`${id} is a new anchor, not an old one`);
  for(const [id,,label,question]of SIX){
    assert.doesNotMatch(label+question,NEVER,id);
    assert.doesNotMatch(label+question,/\b(AQ|CH|PE|TE)\b|ASL\s?[1-4]|13020[1-4]/,id);
  }
});

test('pillarCSectionAtViewport follows the reading line, quadro first; at the bottom the last present section wins; the default list is the six',()=>{
  const positions=PILLAR_C_SECTIONS.map((s,i)=>({id:s.id,top:i*900-1000}));
  for(const list of [[PILLAR_C_SECTIONS],[]]){
    const at=(p,line,bottom=false)=>pillarCSectionAtViewport(p,line,bottom,...list);
    assert.equal(at(positions,180),'destinatari');
    assert.equal(at(positions,800),'portafogli-attribuzione');
    assert.equal(at(positions.map(p=>({...p,top:p.top-2000})),180),'fattori');
    assert.equal(at(positions,180,true),'priorita-evidenza');
    assert.equal(at([{id:'quadro',top:-40},{id:'destinatari',top:600}],180),'quadro');
    // Old inner anchors are ignored; a short final section still becomes current at the bottom.
    assert.equal(at([{id:'spesa',top:-900},{id:'quadro',top:-40}],180),'quadro');
    assert.equal(at([{id:'quadro',top:-5000},{id:'priorita-evidenza',top:350}],180,true),'priorita-evidenza');
    assert.equal(at([{id:'quadro',top:-100},{id:'fattori',top:NaN}],180),'quadro');
  }
});

test('1.2c: one list; the old lists, the old types, the workbook dependency and the word audience are gone; the fallback is quadro',()=>{
  assert.deepEqual(Object.keys(LIB_EXPORTS).sort(),['PILLAR_C_SECTIONS','pillarCSectionAtViewport']);
  const lib=read(LIB);
  for(const name of ['PILLAR_C_ALL_SECTIONS','PILLAR_C_SCOPED_SECTIONS','PILLAR_C_SIX_SECTIONS','PillarCNavSection','PillarCSixSection','C_WORKBOOK_SECTIONS','CWorkbookSectionId','workbook'])assert.doesNotMatch(lib,new RegExp(String.raw`\b${name}\b(?!_)`),name);
  assert.doesNotMatch(lib,/^import /m,'the lib imports nothing');
  assert.equal(pillarCSectionAtViewport([],180),'quadro');
  assert.equal(pillarCSectionAtViewport([{id:'quadro',top:500}],180),'quadro');
  assert.equal(pillarCSectionAtViewport([{id:'spesa',top:-40}],180),'quadro','an old inner anchor is not a section');
  assert.equal(pillarCSectionAtViewport([{id:'budget-scenari',top:400}],180),'quadro','below the line on a section-5-only page: the bar clamps it (test 6)');
});

test('PillarCSectionBar renders one nav with six pill links in order: numeral hidden, icon hidden, label visible, quadro current',()=>{
  const html=render(h(PillarCSectionBar));
  assert.match(html,/^<nav aria-label="Sezioni dell’analisi Pillar C" class="[^"]*">/);
  assert.equal((html.match(/<nav /g)||[]).length,1);
  const [navClass]=html.match(/class="[^"]*"/);
  // Below md a scroll-snap row; from md a grid with wrapping labels, three columns until xl brings six (six columns
  // under the 256 px sidebar leave no room for a label before xl); sticky at xl.
  for(const cls of['flex','snap-x','snap-mandatory','overflow-x-auto','md:grid','md:grid-cols-3','md:snap-none','md:overflow-visible','xl:grid-cols-6','xl:sticky','xl:top-3','xl:z-20'])assert.match(navClass,new RegExp(`[" ]${cls.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}[" ]`),cls);
  assert.doesNotMatch(navClass,/md:grid-cols-6|lg:grid-cols-6/);
  const links=anchors(html);
  assert.deepEqual(links.map(a=>a.href),SIX_IDS.map(id=>`#${id}`));
  assert.deepEqual(links.map(a=>a.text),SIX.map(([,,label])=>label));
  assert.deepEqual(links.map(a=>a.current),['location',null,null,null,null,null]);
  for(const a of links){
    for(const cls of['min-h-11','min-w-0','snap-start','md:shrink','xl:text-[13px]','focus-visible:ring-2','motion-safe:transition-[color,background-color,border-color,box-shadow]','motion-safe:duration-200'])assert.ok((` ${a.classes} `).includes(` ${cls} `),`${a.href}: ${cls}`);
    assert.doesNotMatch(a.attrs,/tabindex=/i,'anchors are natively focusable; no tabindex');
  }
  // The label truncates only in the row; in the grid it wraps (leading-4 keeps two lines inside the 44 px pill).
  assert.equal((html.match(/<span class="truncate md:overflow-visible md:whitespace-normal md:leading-4">/g)||[]).length,6);
  assert.ok((` ${links[0].classes} `).includes(' bg-primary-strong '),'the current entry is filled');
  for(const a of links.slice(1))assert.ok(!(` ${a.classes} `).includes(' bg-primary-strong '),`${a.href}: not filled`);
  // Numerals: six aria-hidden spans "1" to "6"; icons: six svgs, every one aria-hidden.
  assert.deepEqual([...html.matchAll(/<span aria-hidden="true" class="[^"]*">(\d)<\/span>/g)].map(m=>m[1]),['1','2','3','4','5','6']);
  assert.equal((html.match(/<svg/g)||[]).length,6);
  assert.equal((html.match(/<svg[^>]*aria-hidden="true"/g)||[]).length,6);
});

test('PillarCSectionBar carries no description, question or select, no bare transition, no positive tabindex, no reviewer-only id and no forbidden word',()=>{
  const html=render(h(PillarCSectionBar));
  const text=html.replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim();
  assert.doesNotMatch(html,/<select|<option|<label|Vai alla sezione/);
  for(const [,,,question]of SIX)assert.ok(!text.includes(question),'the question is not rendered in the bar');
  for(const s of [...OLD_SECTIONS,...OLD_SCOPED])assert.ok(!text.includes(s.description),`${s.description}: no description text`);
  assert.doesNotMatch(html,/(?<!motion-safe:)\btransition-/,'every transition is motion-safe');
  assert.doesNotMatch(html,/(?<!motion-safe:)\bduration-/,'every duration is motion-safe');
  assert.doesNotMatch(html,/tabindex="[1-9]/i);
  assert.doesNotMatch(html,REVIEWER_ONLY);
  assert.doesNotMatch(html,NEVER);
  assert.doesNotMatch(html,/(^|[^A-Za-z])(AQ|CH|PE|TE)([^A-Za-z]|$)|ASL\s?[1-4]|13020[1-4]|Regione/);
  assert.ok(!/<a\s[^>]*>[^<]*\d/.test(html.replace(/<span aria-hidden="true"[^>]*>\d<\/span>/g,'')),'the numeral is the only digit in a link, and it is hidden');
  assert.ok(text.length<200,'the bar is a compact row of labels');
});

test('1.2c: the old strip, its select and the old component are gone; with `available` the bar links only the sections the page renders',()=>{
  assert.deepEqual(Object.keys(NAV_EXPORTS),['PillarCSectionBar']);
  const component=read(COMPONENT);
  assert.doesNotMatch(component,/PillarCSectionNavigation|Vai alla sezione|<select|min-h-\[88px\]|extended|ArrowUpRight/);
  // Every section listed: byte-identical to the default render (the reviewer and the organisation-scoped pages).
  assert.equal(render(h(PillarCSectionBar,{available:SIX_IDS})),render(h(PillarCSectionBar)));
  // forecast_only: one link, current from the server render; five plain entries in their place, each with its statement.
  const html=render(h(PillarCSectionBar,{available:['budget-scenari']}));
  assert.deepEqual(anchors(html).map(a=>[a.href,a.current,a.text]),[['#budget-scenari','location','Budget e scenari']]);
  assert.deepEqual([...html.matchAll(/<(a|span) [^>]*class="[^"]*\bmin-h-11\b[^"]*"/g)].map(m=>m[1]),['span','span','span','span','a','span']);
  const plain=[...html.matchAll(/<span class="([^"]*\bmin-h-11\b[^"]*)">([\s\S]*?<span class="sr-only">([^<]*)<\/span>)<\/span>/g)];
  assert.equal(plain.length,5);
  for(const [,cls,inner,statement] of plain){
    assert.equal(statement,', sezione non disponibile in questa pagina');
    assert.ok((` ${cls} `).includes(' text-muted-foreground '),cls);
    assert.doesNotMatch(cls,/hover:|focus-visible:|bg-primary|transition/,cls);
    assert.doesNotMatch(inner,/href|tabindex|aria-current/);
  }
  assert.deepEqual(plain.map(([,,inner])=>inner.replace(/<svg[\s\S]*?<\/svg>/g,'').replace(/<span aria-hidden="true"[^>]*>\d<\/span>/,'').replace(/<span class="sr-only">[^<]*<\/span>/,'').replace(/<[^>]+>/g,'')),SIX.filter(([id])=>id!=='budget-scenari').map(([,,label])=>label));
  assert.deepEqual([...html.matchAll(/<span aria-hidden="true" class="[^"]*">(\d)<\/span>/g)].map(m=>m[1]),['1','2','3','4','5','6']);
  assert.equal((html.match(/<svg[^>]*aria-hidden="true"/g)||[]).length,6);
  assert.doesNotMatch(html,/tabindex/i);
  // Two sections listed: the first listed one is current until the reader scrolls; the others are plain.
  assert.deepEqual(anchors(render(h(PillarCSectionBar,{available:['fattori','budget-scenari']}))).map(a=>[a.href,a.current]),[['#fattori','location'],['#budget-scenari',null]]);
});

test('source pins: the six-entry icons map, the bar, its scroll-spy and its activation; no labels, no loader, no organisation, no audience',()=>{
  const lib=read(LIB),component=read(COMPONENT);
  // The icons map: the six sections only (1.2c pruned the seventeen old entries and their imports).
  assert.ok(component.includes('const icons = { quadro: LayoutDashboard, destinatari: UsersRound, "portafogli-attribuzione": BriefcaseBusiness, fattori: ChartNoAxesCombined, "budget-scenari": Landmark, "priorita-evidenza": ListChecks };'));
  assert.ok(component.includes('import { BriefcaseBusiness, ChartNoAxesCombined, Landmark, LayoutDashboard, ListChecks, UsersRound } from "lucide-react";'));
  assert.ok(component.includes('export function PillarCSectionBar({ className, available = SECTION_IDS }: { className?: string; available?: readonly PillarCSectionId[] }) {'));
  assert.ok(component.includes('const SECTION_IDS: readonly PillarCSectionId[] = PILLAR_C_SECTIONS.map((s) => s.id);'));
  assert.ok(component.includes('const UNAVAILABLE_ENTRY = ", sezione non disponibile in questa pagina";'));
  assert.ok(component.includes('  const current = available.includes(active) ? active : available[0];'));
  assert.ok(component.includes('const Icon = icons[id], selected = current === id;'));
  assert.ok(component.includes('if (!available.includes(id)) return <span key={id} className="flex min-h-11 '));
  // The bar's activation (the scenari-link mechanism: prevent the default jump, push the hash once, scroll, move focus to
  // the frame's h2) and its scroll-spy wiring (rAF-coalesced; scroll, resize, hashchange and popstate; cleanup removes
  // all four and cancels the frame; the reading line never sits above the sections' own scroll margin).
  const bar=component.slice(component.indexOf('export function PillarCSectionBar'));
  assert.ok(bar.includes('onClick={(e) => { e.preventDefault(); setActive(id); const hash = `#${id}`; if (window.location.hash !== hash) window.history.pushState(null, "", `${window.location.pathname}${window.location.search}${hash}`); document.getElementById(id)?.scrollIntoView({ block: "start" }); document.getElementById(`${id}-title`)?.focus({ preventScroll: true }); }}'));
  for(const ev of['scroll','resize','hashchange','popstate']){assert.ok(bar.includes(`window.addEventListener("${ev}", schedule`),ev);assert.ok(bar.includes(`window.removeEventListener("${ev}", schedule)`),ev);}
  assert.ok(bar.includes('window.addEventListener("scroll", schedule, { passive: true });'));
  assert.ok(bar.includes('const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };'));
  assert.ok(bar.includes('window.cancelAnimationFrame(frame);'));
  assert.ok(bar.includes('const margin = first ? parseFloat(getComputedStyle(first).scrollMarginTop) || 0 : 0;\n      const line = Math.max(Math.min(180, window.innerHeight * 0.25), margin + 1);\n      const next = pillarCSectionAtViewport(positions, line, atBottom, PILLAR_C_SECTIONS);\n      setActive(next);'));
  assert.ok(bar.includes('useState<PillarCSectionId>("quadro")'));
  assert.ok(!bar.includes('replaceState'),'the bar pushes a history entry like a native anchor; it never replaces one');
  assert.ok(lib.includes('export const PILLAR_C_SECTIONS = [\n  { id: "quadro", number: "1", label: "Quadro decisionale", '));
  assert.ok(lib.includes('export type PillarCSectionId = (typeof PILLAR_C_SECTIONS)[number]["id"];'));
  assert.ok(lib.includes('export type PillarCSection = { id: PillarCSectionId; number: string; label: string; question: string };'));
  assert.ok(lib.includes('  sections: readonly { id: PillarCSectionId }[] = PILLAR_C_SECTIONS,\n): PillarCSectionId {'));
  assert.ok(lib.includes('  let current: PillarCSectionId = "quadro";'));
  // What neither file may carry (owner rules; tests/pillar-c-review 538, -scoped-ui 134, -scoped-client-graph 88–107).
  for(const [file,source]of[[LIB,lib],[COMPONENT,component]]){
    assert.doesNotMatch(source,/verificat|\bdemo\b|dimostra|in arrivo/i,file);
    assert.doesNotMatch(source,/fetch\(|process\.env|C_ORG_LABELS|C_ORGS|C_ATTR_ORGS/,file);
    assert.doesNotMatch(source,/["'`](AQ|CH|PE|TE)["'`]|ASL\s?[1-4]|13020[1-4]/,file);
    assert.doesNotMatch(source,/tabIndex=\{?[1-9]/,file);
    assert.doesNotMatch(source,/^import [^;]*(audience-context|audience-view|audience-rules|reviewer-labels|-loader|-storage|pillar-c\/insights|reset-search|supabase)/m,file);
    assert.doesNotMatch(source,/^(?:export )?(?:let|var) |^(?:export )?const \w+ ?= ?new (?:Map|WeakMap|Set)\(/m,`${file}: no module-level mutable state`);
  }
  assert.doesNotMatch(component,/audience/i,'the component file never names an audience');
  // 1.2c deleted the lib's one mention (the comment of the scoped list): the word appears in neither file.
  assert.equal((lib.match(/audience/gi)||[]).length,0);
  assert.equal((lib.match(/\u00a0/g)||[]).length,0,'no invisible no-break space in the lib');
  assert.equal((component.match(/\u00a0/g)||[]).length,0,'no invisible no-break space in the component');
});
