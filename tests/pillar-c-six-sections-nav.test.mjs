// PILLAR C SIX-SECTION NAVIGATION, commit 1.2a of docs/PILLAR_C_SIX_SECTIONS_20261022.md (additive).
// The six-entry list PILLAR_C_SIX_SECTIONS and the compact bar PillarCSectionBar are added beside the old lists and
// the old component, which stay byte-identical and are pinned here as such (the icons map keeps its old entries and
// gains the six new ids, since the id union now includes them). Pure-function checks on the lib, one
// server-side render of the bar (react-dom/server through the same sucrase loader as shell-navigation) and source pins
// on the two edited files. Synthetic geometry only: no organisation, no spend figure, no real value appears here.
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
const {PILLAR_C_SIX_SECTIONS,PILLAR_C_SECTIONS,PILLAR_C_ALL_SECTIONS,PILLAR_C_SCOPED_SECTIONS,pillarCSectionAtViewport}=await import('../lib/dashboard-review/pillar-c/section-navigation.ts');
const {PillarCSectionBar,PillarCSectionNavigation}=await import('../components/dashboard-review/pillar-c/section-navigation.tsx');

const LIB='lib/dashboard-review/pillar-c/section-navigation.ts';
const COMPONENT='components/dashboard-review/pillar-c/section-navigation.tsx';

// The six sections of the design record, section 1, verbatim: id, numeral, title, question.
const SIX=[
  ['quadro','1','Quadro decisionale','La spesa è cambiata perché più persone sono state trattate o perché i prodotti costano di più, e di quanto?'],
  ['destinatari','2','Destinatari e utilizzo','Quante persone trattate raggiunge la spesa e con quale utilizzo?'],
  ['portafogli-attribuzione','3','Portafogli e attribuzione','Quanto spende ciascun raggruppamento terapeutico e quanta spesa resta condivisa o incerta?'],
  ['fattori','4','Fattori di spesa','Come cambia la spesa nel tempo e quali prodotti spiegano la variazione?'],
  ['budget-scenari','5','Budget e scenari','Che cosa dicono gli atti di budget, le ipotesi dichiarate e la previsione regionale?'],
  ['priorita-evidenza','6','Priorità ed evidenza','Che cosa verificare per primo e su quali fonti si basano le analisi?'],
];
const SIX_IDS=SIX.map(([id])=>id);
// The old six-entry list as it stands in 1.2a (ids, two-digit numbers, labels, descriptions); deleted only in 1.2c.
const OLD_SECTIONS=[
  {id:'spesa',number:'01',label:'Spesa',description:'Andamento e importi'},
  {id:'cambiamento',number:'02',label:'Variazioni',description:'Confronti nel tempo'},
  {id:'pianificazione',number:'03',label:'Budget',description:'Piani e allocazioni'},
  {id:'numerosita',number:'04',label:'Numerosità',description:'Scenari CO'},
  {id:'previsione',number:'05',label:'Previsione',description:'Regionale, fonte pubblica'},
  {id:'evidenza',number:'06',label:'Evidenza',description:'Fonti e metodo'},
];
const OLD_SCOPED_IDS=['portafogli','scenari','spesa','attribuzione','cambiamento','pianificazione','numerosita','previsione','evidenza'];
// The nine scoped entries and the seventeen reviewer entries as they stand in 1.2a (both deleted in 1.2c).
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

test('PILLAR_C_SIX_SECTIONS: six entries in page order with numerals "1" to "6", titles and questions verbatim, unique ids, none reused from the old lists',()=>{
  assert.deepEqual(PILLAR_C_SIX_SECTIONS.map(s=>[s.id,s.number,s.label,s.question]),SIX);
  assert.deepEqual(PILLAR_C_SIX_SECTIONS.map(s=>s.number),['1','2','3','4','5','6']);
  assert.equal(new Set(SIX_IDS).size,6);
  for(const s of PILLAR_C_SIX_SECTIONS)assert.deepEqual(Object.keys(s).sort(),['id','label','number','question'],s.id);
  const old=new Set([...PILLAR_C_SECTIONS,...PILLAR_C_ALL_SECTIONS,...PILLAR_C_SCOPED_SECTIONS].map(s=>s.id));
  for(const id of SIX_IDS)assert.ok(!old.has(id),`${id} is a new anchor, not an old one`);
  for(const [id,,label,question]of SIX){
    assert.doesNotMatch(label+question,NEVER,id);
    assert.doesNotMatch(label+question,/\b(AQ|CH|PE|TE)\b|ASL\s?[1-4]|13020[1-4]/,id);
  }
});

test('pillarCSectionAtViewport with the six list follows the reading line, quadro first; at the bottom the last present section wins',()=>{
  const positions=PILLAR_C_SIX_SECTIONS.map((s,i)=>({id:s.id,top:i*900-1000}));
  assert.equal(pillarCSectionAtViewport(positions,180,false,PILLAR_C_SIX_SECTIONS),'destinatari');
  assert.equal(pillarCSectionAtViewport(positions,800,false,PILLAR_C_SIX_SECTIONS),'portafogli-attribuzione');
  assert.equal(pillarCSectionAtViewport(positions.map(p=>({...p,top:p.top-2000})),180,false,PILLAR_C_SIX_SECTIONS),'fattori');
  assert.equal(pillarCSectionAtViewport(positions,180,true,PILLAR_C_SIX_SECTIONS),'priorita-evidenza');
  assert.equal(pillarCSectionAtViewport([{id:'quadro',top:-40},{id:'destinatari',top:600}],180,false,PILLAR_C_SIX_SECTIONS),'quadro');
  // Old inner anchors are ignored when the six list is given; a short final section still becomes current at the bottom.
  assert.equal(pillarCSectionAtViewport([{id:'spesa',top:-900},{id:'quadro',top:-40}],180,false,PILLAR_C_SIX_SECTIONS),'quadro');
  assert.equal(pillarCSectionAtViewport([{id:'quadro',top:-5000},{id:'priorita-evidenza',top:350}],180,true,PILLAR_C_SIX_SECTIONS),'priorita-evidenza');
  assert.equal(pillarCSectionAtViewport([{id:'quadro',top:-100},{id:'fattori',top:NaN}],180,false,PILLAR_C_SIX_SECTIONS),'quadro');
});

test('the old lists, the default list and the "spesa" fallback are untouched in 1.2a (re-pinned to quadro in 1.2c)',()=>{
  assert.deepEqual(PILLAR_C_SECTIONS.map(s=>({...s})),OLD_SECTIONS);
  assert.deepEqual(PILLAR_C_SCOPED_SECTIONS.map(s=>s.id),OLD_SCOPED_IDS);
  assert.deepEqual(PILLAR_C_SCOPED_SECTIONS.map(s=>({...s})),OLD_SCOPED);
  assert.deepEqual(PILLAR_C_ALL_SECTIONS.map(s=>[s.id,s.number,s.label,s.description]),OLD_ALL);
  assert.equal(PILLAR_C_ALL_SECTIONS.length,17);
  assert.equal(pillarCSectionAtViewport([],180),'spesa');
  assert.equal(pillarCSectionAtViewport([{id:'quadro',top:-40}],180),'spesa','quadro is not in the default list yet');
  assert.equal(pillarCSectionAtViewport([{id:'quadro',top:500}],180,false,PILLAR_C_SIX_SECTIONS),'spesa','the bar narrows the fallback to quadro until 1.2c');
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
  assert.ok((` ${links[0].classes} `).includes(' bg-primary '),'the current entry is filled');
  for(const a of links.slice(1))assert.ok(!(` ${a.classes} `).includes(' bg-primary '),`${a.href}: not filled`);
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
  for(const s of OLD_SECTIONS)assert.ok(!text.includes(s.description),`${s.description}: no description text`);
  assert.doesNotMatch(html,/(?<!motion-safe:)\btransition-/,'every transition is motion-safe');
  assert.doesNotMatch(html,/(?<!motion-safe:)\bduration-/,'every duration is motion-safe');
  assert.doesNotMatch(html,/tabindex="[1-9]/i);
  assert.doesNotMatch(html,REVIEWER_ONLY);
  assert.doesNotMatch(html,NEVER);
  assert.doesNotMatch(html,/(^|[^A-Za-z])(AQ|CH|PE|TE)([^A-Za-z]|$)|ASL\s?[1-4]|13020[1-4]|Regione/);
  assert.ok(!/<a\s[^>]*>[^<]*\d/.test(html.replace(/<span aria-hidden="true"[^>]*>\d<\/span>/g,'')),'the numeral is the only digit in a link, and it is hidden');
  assert.ok(text.length<200,'the bar is a compact row of labels');
});

test('the old component renders as before on both paths, and the six ids do not reach it',()=>{
  const compact=render(h(PillarCSectionNavigation));
  assert.deepEqual(anchors(compact).map(a=>a.href),OLD_SECTIONS.map(s=>`#${s.id}`));
  assert.doesNotMatch(compact,/<select|#quadro|#destinatari|#fattori|#budget-scenari|#priorita-evidenza|#portafogli-attribuzione/);
  assert.match(compact,/min-h-\[88px\]/);
  for(const s of OLD_SECTIONS)assert.ok(compact.includes(s.description),s.description);
  const extended=render(h(PillarCSectionNavigation,{extended:true}));
  assert.match(extended,/<select aria-label="Vai alla sezione Pillar C"/);
  assert.deepEqual(anchors(extended).slice(0,2).map(a=>a.href),['#portafogli','#scenari']);
  assert.doesNotMatch(extended,/#quadro|#destinatari|#fattori|#budget-scenari|#priorita-evidenza|#portafogli-attribuzione/);
  const scoped=render(h(PillarCSectionNavigation,{extended:true,list:PILLAR_C_SCOPED_SECTIONS}));
  assert.deepEqual(anchors(scoped).map(a=>a.href),OLD_SCOPED_IDS.map(id=>`#${id}`));
});

test('source pins: the old lists and component are byte-identical and the icons map keeps its old entries verbatim; the added code imports no labels, no loader and names no organisation',()=>{
  const lib=read(LIB),component=read(COMPONENT);
  // The icons map: the seventeen old entries verbatim (tests/pillar-c-planning-ui and -evidence-ui pin two of them), then the six
  // new ids appended, because the union now includes them and the old component's lookup `icons[id]` must stay total.
  assert.ok(component.includes('const icons = { portafogli: BriefcaseBusiness, scenari: GitBranch, spesa: WalletCards, cambiamento: ChartNoAxesCombined, pianificazione: Landmark, numerosita: UsersRound, previsione: TrendingUp, evidenza: FileCheck2, composizione: ChartPie, attribuzione: Network, costi: Layers, confronti: Scale, attivita: Activity, tendenze: GitCompareArrows, sensibilita: SlidersHorizontal, priorita: ListChecks, "evidence-workflow": ClipboardList, quadro: LayoutDashboard, destinatari: UsersRound, "portafogli-attribuzione": BriefcaseBusiness, fattori: ChartNoAxesCombined, "budget-scenari": Landmark, "priorita-evidenza": ListChecks };'));
  // The old component signature and body opening, verbatim.
  assert.ok(component.includes('export function PillarCSectionNavigation({ extended = false, list }: { extended?: boolean; list?: readonly PillarCNavSection[] }) {\n  const [active, setActive] = useState<PillarCSectionId>(extended ? "portafogli" : "spesa");\n  const sections = list ?? (extended ? PILLAR_C_ALL_SECTIONS : PILLAR_C_SECTIONS);'));
  assert.ok(component.includes('export function PillarCSectionBar({ className }: { className?: string }) {'));
  // The bar's activation (the scenari-link mechanism: prevent the default jump, push the hash once, scroll, move focus to
  // the frame's h2) and its scroll-spy wiring (rAF-coalesced; scroll, resize, hashchange and popstate; cleanup removes
  // all four and cancels the frame; the reading line never sits above the sections' own scroll margin).
  const bar=component.slice(component.indexOf('export function PillarCSectionBar'));
  assert.ok(bar.includes('onClick={(e) => { e.preventDefault(); setActive(id); const hash = `#${id}`; if (window.location.hash !== hash) window.history.pushState(null, "", `${window.location.pathname}${window.location.search}${hash}`); document.getElementById(id)?.scrollIntoView({ block: "start" }); document.getElementById(`${id}-title`)?.focus({ preventScroll: true }); }}'));
  for(const ev of['scroll','resize','hashchange','popstate']){assert.ok(bar.includes(`window.addEventListener("${ev}", schedule`),ev);assert.ok(bar.includes(`window.removeEventListener("${ev}", schedule)`),ev);}
  assert.ok(bar.includes('window.addEventListener("scroll", schedule, { passive: true });'));
  assert.ok(bar.includes('const schedule = () => { if (!frame) frame = window.requestAnimationFrame(update); };'));
  assert.ok(bar.includes('window.cancelAnimationFrame(frame);'));
  assert.ok(bar.includes('const margin = first ? parseFloat(getComputedStyle(first).scrollMarginTop) || 0 : 0;\n      const line = Math.max(Math.min(180, window.innerHeight * 0.25), margin + 1);\n      const next = pillarCSectionAtViewport(positions, line, atBottom, PILLAR_C_SIX_SECTIONS);'));
  assert.ok(bar.includes('useState<PillarCSixSectionId>("quadro")'));
  assert.ok(!bar.includes('replaceState'),'the bar pushes a history entry like a native anchor; it never replaces one');
  assert.ok(lib.includes('export const PILLAR_C_SECTIONS = [\n  { id: "spesa", number: "01", label: "Spesa", description: "Andamento e importi" },'));
  assert.ok(lib.includes('export const PILLAR_C_SIX_SECTIONS = ['));
  assert.ok(lib.includes('export type PillarCSectionId = CWorkbookSectionId | "portafogli" | "scenari" | "evidence-workflow" | PillarCSixSectionId;'));
  assert.ok(lib.includes('  sections: readonly { id: PillarCSectionId }[] = PILLAR_C_SECTIONS,\n): PillarCSectionId {'));
  assert.ok(lib.includes('  let current: PillarCSectionId = "spesa";'));
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
  // The lib's one pre-existing mention (the PILLAR_C_SCOPED_SECTIONS comment) stays the only one: the added block adds none.
  assert.equal((lib.match(/audience/gi)||[]).length,1);
  assert.equal((lib.match(/\u00a0/g)||[]).length,0,'no invisible no-break space in the lib');
  assert.equal((component.match(/\u00a0/g)||[]).length,0,'no invisible no-break space in the component');
});
