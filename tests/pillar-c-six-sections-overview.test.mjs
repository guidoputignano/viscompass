// PILLAR C, SECTION 1 «QUADRO DECISIONALE» (commit 1.2a of the six-section work, 22 October 2026).
// PillarCDecisionOverview renders the three decision cards, the chosen
// comparison as one keyed text, the regional reference card with the 80-percent
// band beside the annual point and the link to section 5, and the «Vai a»
// links. Server-side render only (react-dom/server) with the same sucrase
// loader as shell-navigation; every value below is invented (fictional
// organisations and round amounts), never a real spend figure. The source
// pins keep the file free of any reader-group word, loader, chart library
// and toggle.
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
export async function load(u,c,n){if(u.startsWith('file:')&&u.endsWith('.tsx')){const f=fileURLToPath(u);return {format:'module',source:sucrase.transform(readFileSync(f,'utf8'),{transforms:['typescript','jsx'],jsxRuntime:'automatic',production:true,filePath:f}).code,shortCircuit:true};}return n(u,c);}
`),{data:{pkg:pathToFileURL(`${root}package.json`).href}});
const req=createRequire(`${root}package.json`),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const {PillarCDecisionOverview}=await import('../components/dashboard-review/pillar-c/decision-overview.tsx');
// The shared detectors of the payload guard, so that this file names no token it forbids.
const {C_PROVINCE_TOKEN,C_PLACE_NAME,C_NSIS_CODE}=await import('../lib/dashboard-review/pillar-c/payload-guard.ts');
const h=React.createElement,render=el=>renderToStaticMarkup(el);
/** Visible text of a fragment, entities decoded, whitespace collapsed. */
const text=html=>html.replace(/<[^>]*>/g,' ').replace(/&#x27;/g,'’').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
/** The anchors of a fragment: href and inner text. */
const anchors=html=>[...html.matchAll(/<a\s([^>]*)>([\s\S]*?)<\/a>/g)].map(([,attrs,inner])=>({href:attrs.match(/href="([^"]*)"/)?.[1]??null,label:text(inner),attrs}));
const NEVER=/NaN|Infinity|undefined|\b[Dd]emo\b|[Dd]imostra|[Vv]erificat|in arrivo/;

// Invented values only: a fictional organisation, round amounts, no real figure.
const CARDS=[
  {title:'Variazione contabile',value:'+1.000,00\u00a0€',detail:'Azienda sintetica Alfa · tutti i canali · 2024–2025'},
  {title:'Contributo dei prodotti presenti nei due periodi',value:'+600,00\u00a0€',detail:'Contributo alla variazione, non un effetto causale o clinico.'},
  {title:'Persone trattate osservate',value:'Non disponibili',detail:'Gli scenari CO stimano il denominatore; non misurano più persone trattate.'},
];
const COMPARISON='Confronto: 2024 → 2025';
const REGIONAL={annual:'9.000,00\u00a0€',band:'8.000,00\u00a0€ – 10.000,00\u00a0€',href:'#budget-scenari'};
const LINKS=[
  {href:'#portafogli-attribuzione',label:'Portafogli e attribuzione'},
  {href:'#fattori',label:'Fattori di spesa'},
  {href:'#budget-scenari',label:'Budget e scenari'},
];
const overview=(props={})=>render(h(PillarCDecisionOverview,{cards:CARDS,comparison:COMPARISON,regional:REGIONAL,links:LINKS,...props}));

test('three cards in order, each with its title, value and detail as single text children',()=>{
  const html=overview();
  assert.doesNotMatch(html,NEVER);
  const cards=[...html.matchAll(/<div class="rounded-xl bg-secondary\/40 p-4">([\s\S]*?)<\/div>/g)].map(m=>m[1]);
  assert.equal(cards.length,3);
  cards.forEach((card,i)=>{
    assert.equal(card,`<p class="text-xs text-muted-foreground">${CARDS[i].title}</p><p class="mt-2 text-xl font-semibold">${CARDS[i].value}</p><p class="mt-2 text-xs text-muted-foreground">${CARDS[i].detail}</p>`);
  });
  assert.match(html,/^<div class="rounded-2xl border border-primary\/20 bg-card p-5 md:p-6"><div class="grid gap-4 md:grid-cols-3">/);
  // No heading (the frame owns the h2), no chart, no control: the overview is read-only.
  assert.doesNotMatch(html,/<h[1-6]|<svg|<select|<button|<input|tabindex|aria-pressed/);
});

test('the comparison is one text child of its own paragraph, keyed on its content so a changed filter remounts it',()=>{
  const html=overview();
  assert.ok(html.includes(`</div><p class="mt-4 text-xs text-muted-foreground">${COMPARISON}</p>`));
  assert.equal(overview({comparison:'Confronto: Gen–mag 2025 → 2026'}).includes('<p class="mt-4 text-xs text-muted-foreground">Confronto: Gen–mag 2025 → 2026</p>'),true);
  const src=read('components/dashboard-review/pillar-c/decision-overview.tsx');
  assert.match(src,/<p key=\{comparison\} className="mt-4 text-xs text-muted-foreground">\{comparison\}<\/p>/);
});

test('the regional card states the exact title, the annual point, the 80 % band and links to section 5',()=>{
  const html=overview();
  const card=html.match(/<div class="mt-5 rounded-xl bg-secondary\/50 p-4">([\s\S]*?)<\/div>/)?.[1];
  assert.ok(card,'regional card present');
  assert.ok(card.startsWith('<p class="text-xs text-muted-foreground">Previsione regionale 2026 · stima annua indicativa</p>'));
  // One paragraph holds the annual point, then the band label, then the band, in that order and with nothing between
  // them; the caveat line follows at once.
  assert.ok(card.includes(`<p class="mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1"><span class="text-xl font-semibold tabular-nums">${REGIONAL.annual}</span><span class="text-xs text-muted-foreground">Fascia annua indicativa · 80\u00a0%</span><span class="text-sm font-medium tabular-nums">${REGIONAL.band}</span></p><p class="mt-1 text-[11px] text-muted-foreground">Riferimento regionale, non budget approvato</p>`));
  const link=anchors(card);
  assert.equal(link.length,1);
  assert.equal(link[0].href,'#budget-scenari');
  assert.equal(link[0].label,'Apri la previsione regionale');
  assert.match(link[0].attrs,/class="[^"]*\bmin-h-11\b/);
  // The href is the prop, not a hard-coded anchor: another target renders another href with the same label.
  const other=anchors(overview({regional:{...REGIONAL,href:'#altro'}}).match(/<div class="mt-5 rounded-xl bg-secondary\/50 p-4">([\s\S]*?)<\/div>/)[1]);
  assert.deepEqual(other.map(a=>[a.href,a.label]),[['#altro','Apri la previsione regionale']]);
  assert.ok(read('components/dashboard-review/pillar-c/decision-overview.tsx').includes('<a href={regional.href} className='));
  assert.equal(text(html).indexOf(COMPARISON)<text(html).indexOf('Previsione regionale 2026'),true,'the comparison precedes the regional card');
});

test('without a forecast the regional card is absent and nothing stands in for it',()=>{
  for(const html of [overview({regional:null}),overview({regional:undefined})]){
    assert.doesNotMatch(html,NEVER);
    assert.doesNotMatch(html,/Previsione regionale|Fascia annua|Riferimento regionale|Apri la previsione|bg-secondary\/50|—|–\s*$/);
    assert.equal(anchors(html).length,3);
    const visible=text(html);
    assert.equal((visible.match(/Non disponibil/g)??[]).length,CARDS.filter(c=>/Non disponibil/.test(c.value+c.detail)).length,'only the caller’s own card wording may say «Non disponibile»');
    // Exactly the cards, the comparison and the links remain, in that order.
    assert.ok(html.includes(`<p class="mt-4 text-xs text-muted-foreground">${COMPARISON}</p><div class="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-sm"><a href="#portafogli-attribuzione"`));
  }
});

test('three «Vai a» links to the sections, in the given order, each a 44 px target',()=>{
  const html=overview();
  const links=anchors(html).filter(a=>a.label.startsWith('Vai a '));
  assert.deepEqual(links.map(a=>[a.href,a.label]),LINKS.map(l=>[l.href,`Vai a ${l.label}`]));
  for(const a of links) assert.match(a.attrs,/class="[^"]*\bmin-h-11\b/);
  assert.doesNotMatch(html,/tabindex="[1-9]/);
  // The link row is the last child of the overview.
  assert.match(html,/<div class="mt-5 flex flex-wrap gap-x-3 gap-y-1 text-sm">(<a [^>]*>Vai a [^<]*<\/a>){3}<\/div><\/div>$/);
});

test('a custom className merges into the wrapper; the three cards are a tuple at the type level',()=>{
  const html=overview({className:'mt-6'});
  assert.match(html,/^<div class="rounded-2xl border border-primary\/20 bg-card p-5 md:p-6 mt-6">/);
  const src=read('components/dashboard-review/pillar-c/decision-overview.tsx');
  assert.match(src,/cards: readonly \[PillarCDecisionCard, PillarCDecisionCard, PillarCDecisionCard\];/);
});

test('source pins: no reader-group word, no loader, no chart library, no toggle, no hooks, no fetch, no placeholder wording',()=>{
  const src=read('components/dashboard-review/pillar-c/decision-overview.tsx');
  // The reader-group word is assembled at runtime so that neither new file spells it.
  assert.doesNotMatch(src,new RegExp(['audi','ence'].join(''),'i'));
  assert.doesNotMatch(src,/C_ORG_LABELS|C_ORGS|C_ATTR_ORGS/);
  assert.doesNotMatch(src,/from "[^"]*(reviewer-labels|loader|\/insights|reset-search|scoped-review|pillar-c\/review|recharts|insight-chart|pillar-c\/charts|lucide-react|next\/)/);
  assert.doesNotMatch(src,/LocalToggle|aria-pressed|<button|<select|<input|onChange|onClick/);
  assert.doesNotMatch(src,/"use client"|useState|useEffect|useMemo|useRef|useId|fetch\(/);
  assert.doesNotMatch(src,/verificat|\bdemo\b|dimostra|in arrivo/i);
  // No province token, place name, NSIS code, unit label or the reviewer's whole-region key (the shared detectors
  // of the payload guard, plus two patterns assembled at runtime so that this file names none of them).
  assert.doesNotMatch(src,C_PROVINCE_TOKEN);
  assert.doesNotMatch(src,C_PLACE_NAME);
  assert.doesNotMatch(src,C_NSIS_CODE);
  assert.doesNotMatch(src,/ASL\s?[1-4]/i);
  assert.doesNotMatch(src,new RegExp(['Regi','one'].join(''),'i'));
  assert.doesNotMatch(src,/tabIndex=\{[1-9]/);
  assert.doesNotMatch(src,/transition-/);
  // The no-break space before «%» is written as its escape, never as the invisible character or an ordinary space.
  assert.doesNotMatch(src,/\u00a0|\d %/);
  assert.ok(src.includes('{"Fascia annua indicativa · 80\\u00a0%"}'));
  assert.ok(src.includes('>Previsione regionale 2026 · stima annua indicativa</p>'));
  assert.ok(src.includes('>Riferimento regionale, non budget approvato</p>'));
  assert.ok(src.includes('>Apri la previsione regionale</a>'));
  assert.ok(src.includes('{`Vai a ${link.label}`}'));
  // Exactly one import, the class merger.
  assert.deepEqual([...src.matchAll(/^import .*$/gm)].map(m=>m[0]),['import { cn } from "@/lib/utils";']);
  // Mounted by the reviewer workspace (1.2b) and the organisation-scoped workspace (1.2c); the forecast_only page has no
  // section 1, so the regional workspace never mounts it.
  assert.match(read('components/dashboard-review/pillar-c/scoped-workspace.tsx'),/from "@\/components\/dashboard-review\/pillar-c\/decision-overview"/);
  assert.doesNotMatch(read('components/dashboard-review/pillar-c/regional-forecast-workspace.tsx'),/decision-overview/);
  assert.match(read('components/dashboard-review/pillar-c/analytical-workspace.tsx'),/from "@\/components\/dashboard-review\/pillar-c\/decision-overview"/);
});
