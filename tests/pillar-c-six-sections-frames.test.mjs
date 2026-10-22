// THE SECTION FRAMES AND THE PAGE SCOPE BAR (commit 1.2a of the six-section work,
// docs/PILLAR_C_SIX_SECTIONS_20261022.md §4.1). Server-side renders of PillarCSectionFrame, PillarCScopeLine,
// PillarCSectionEmpty and PillarCScopeBar with react-dom/server and the same sucrase loader as shell-navigation,
// then source pins that keep both files presentation-only: no organisation vocabulary, nothing imported from the
// Pillar C libs, no URL write, keyed or single-child changing text. Every value below is invented (fictional
// organisations and labels); no spend figure appears.
import test from 'node:test';
import assert from 'node:assert/strict';
import {register,createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';

const root=fileURLToPath(new URL('..',import.meta.url));
const read=p=>readFileSync(`${root}${p}`,'utf8').replace(/\r\n/g,'\n');
/** The source without its comments, for pins on what the code does rather than on what the comments say. */
const code=p=>read(p).replace(/\/\*[\s\S]*?\*\//g,'').replace(/^[ \t]*\/\/.*$/gm,'');

register('data:text/javascript,'+encodeURIComponent(`
import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';
let sucrase;export function initialize({pkg}){sucrase=createRequire(pkg)('sucrase');}
export async function load(u,c,n){if(u.startsWith('file:')&&u.endsWith('.tsx')){const f=fileURLToPath(u);return {format:'module',source:sucrase.transform(readFileSync(f,'utf8'),{transforms:['typescript','jsx'],jsxRuntime:'automatic',production:true,filePath:f}).code,shortCircuit:true};}return n(u,c);}
`),{data:{pkg:pathToFileURL(`${root}package.json`).href}});
const req=createRequire(`${root}package.json`),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const h=React.createElement,render=el=>renderToStaticMarkup(el);
/** Visible text of a fragment, entities decoded, whitespace collapsed. */
const text=html=>html.replace(/<[^>]*>/g,' ').replace(/&#x27;/g,'’').replace(/&quot;/g,'"').replace(/&amp;/g,'&').replace(/\s+/g,' ').trim();
const NEVER=/NaN|Infinity|undefined|\b[Dd]emo\b|[Dd]imostra|[Vv]erificat|in arrivo/;

const FRAME='components/dashboard-review/pillar-c/section-frame.tsx';
const BAR='components/dashboard-review/pillar-c/scope-bar.tsx';
const {PillarCSectionFrame,PillarCSectionEmpty,PillarCScopeLine}=await import('../components/dashboard-review/pillar-c/section-frame.tsx');
const {PillarCScopeBar}=await import('../components/dashboard-review/pillar-c/scope-bar.tsx');

// Classes shared with the blocks of review-blocks.tsx, read from that file so the two cannot drift apart.
const BLOCKS=read('components/dashboard-review/pillar-c/review-blocks.tsx');
// The bar's field and action classes are those of review-blocks.tsx with the 44 px heights (h-11, min-h-11): read
// from that file so the focus ring, the hover and the borders cannot drift apart.
const SELECT_CLASS=/const selectClass = "([^"]+)";/.exec(BLOCKS)[1].replace(/\bh-10\b/,'h-11');
const ACTION_CLASS=/const actionClass = "([^"]+)";/.exec(BLOCKS)[1].replace(/\bmin-h-10\b/,'min-h-11');
const NUMERAL_CLASS='flex size-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/5 text-xs font-semibold text-primary';
const LEAD_CLASS='mt-1 max-w-4xl text-sm leading-6 text-muted-foreground';
const EMPTY_CLASS='rounded-xl bg-secondary/50 p-4 text-sm leading-6 text-muted-foreground';

// ---------------------------------------------------------------- the section frame
const frame=(props={},...children)=>render(h(PillarCSectionFrame,{id:'sezione-x',number:'3',title:'Titolo di prova',question:'Qual è la domanda di prova?',...props},...(children.length?children:[h('p',{id:'figlio'},'contenuto')])));

test('PillarCSectionFrame: section id and aria-labelledby, the h2 with tabIndex -1, the aria-hidden numeral, the question as lead, the children',()=>{
  const html=frame();
  assert.match(html,/^<section id="sezione-x" aria-labelledby="sezione-x-title" class="scroll-mt-6 xl:scroll-mt-36">/);
  assert.ok(html.includes(`<span aria-hidden="true" class="${NUMERAL_CLASS}">3</span>`),'the numeral is hidden from assistive technology');
  assert.ok(read(FRAME).includes(`<span aria-hidden="true" className="${NUMERAL_CLASS}">{number}</span>`),'the numeral is the frame\'s own');
  assert.ok(!BLOCKS.includes('{number}'),'no numbered heading is left in review-blocks.tsx (1.2c): the frame carries the only numeral');
  assert.match(html,/<h2 id="sezione-x-title" tabindex="-1" class="text-xl font-semibold tracking-tight focus-visible:outline-2 focus-visible:outline-primary">Titolo di prova<\/h2>/);
  assert.equal((html.match(/<h2\b/g)||[]).length,1,'one heading');
  assert.ok(html.includes(`</h2><p class="${LEAD_CLASS}">Qual è la domanda di prova?</p>`),'the question follows the title as its lead');
  assert.ok(BLOCKS.includes(`<p className="${LEAD_CLASS}">`),'the lead classes are those of CReviewHeading');
  assert.ok(html.includes('<div class="space-y-5"><p id="figlio">contenuto</p></div></section>'),'the children close the section');
  assert.equal(text(html),'3 Titolo di prova Qual è la domanda di prova? contenuto');
  assert.doesNotMatch(html,/tabindex="[1-9]/,'no positive tabindex');
  assert.doesNotMatch(html,/\bscroll-mt-56\b/,'the xl offset stays an xl variant');
  assert.doesNotMatch(html,NEVER);
  // The class prop merges with the frame's own classes.
  assert.match(frame({className:'pb-4'}),/^<section id="sezione-x" aria-labelledby="sezione-x-title" class="scroll-mt-6 xl:scroll-mt-36 pb-4">/);
  // Several children keep their order.
  const two=frame({},h('p',{id:'uno'},'primo'),h('p',{id:'due'},'secondo'));
  assert.ok(two.includes('<div class="space-y-5"><p id="uno">primo</p><p id="due">secondo</p></div>'));
});

test('the scope line: one keyed text child, empty parts dropped, absent when there is nothing to say',()=>{
  const LINE_CLASS='mt-1 max-w-4xl text-xs leading-5 text-muted-foreground';
  assert.equal(render(h(PillarCScopeLine,{parts:['Fonte di prova','Azienda sintetica Alfa','','Tutti i canali']})),`<p class="${LINE_CLASS}">Fonte di prova · Azienda sintetica Alfa · Tutti i canali</p>`);
  const merged=render(h(PillarCScopeLine,{parts:['Solo una parte'],className:'mt-3'}));
  assert.match(merged,/^<p class="[^"]*\bmt-3\b[^"]*">Solo una parte<\/p>$/,'the class prop merges');
  assert.doesNotMatch(merged,/\bmt-1\b/,'a conflicting margin is replaced, not doubled');
  const withScope=frame({scope:['Fonte di prova','Azienda sintetica Alfa','','Tutti i canali']});
  assert.ok(withScope.includes(`Qual è la domanda di prova?</p><p class="${LINE_CLASS}">Fonte di prova · Azienda sintetica Alfa · Tutti i canali</p></div></div>`),'the scope line follows the question inside the heading block');
  assert.equal(text(withScope),'3 Titolo di prova Qual è la domanda di prova? Fonte di prova · Azienda sintetica Alfa · Tutti i canali contenuto');
  // The frame mounts the line only for a non-empty array (the guard of the design's markup).
  for(const scope of [undefined,[]]){
    const html=frame({scope});
    assert.equal((html.match(/<p\b/g)||[]).length,2,`no scope line for ${JSON.stringify(scope)}: the question and the child only`);
    assert.doesNotMatch(html,/ · /);
  }
  // With nothing to say the line itself renders nothing, standalone and inside a frame: never a blank paragraph.
  assert.equal(render(h(PillarCScopeLine,{parts:['','']})),'');
  assert.equal(render(h(PillarCScopeLine,{parts:[]})),'');
  const blank=frame({scope:['','']});
  assert.equal((blank.match(/<p\b/g)||[]).length,2,'a scope of empty parts leaves the question and the child only');
  assert.doesNotMatch(blank,/ · /);
  // Keyed on its content: a changed scope remounts the element instead of updating a translated text node.
  const source=read(FRAME);
  assert.ok(source.includes('const text = parts.filter((p) => p.length > 0).join(" · ");'));
  assert.ok(source.includes('if (text.length === 0) return null;'));
  assert.ok(source.includes(`<p key={text} className={cn("${LINE_CLASS}", className)}>{text}</p>`));
  assert.ok(source.includes('{scope && scope.length > 0 ? <PillarCScopeLine parts={scope} /> : null}'),'the frame guards on the array, the line on its text');
});

test('PillarCSectionEmpty: exactly the sentence it is given, as one status paragraph with the classes of CReviewEmpty',()=>{
  const sentence='Le fonti di prova non contano nulla in questa vista. Nessun valore viene sostituito.';
  assert.equal(render(h(PillarCSectionEmpty,null,sentence)),`<p role="status" class="${EMPTY_CLASS}">${sentence}</p>`);
  assert.ok(BLOCKS.includes(`<p role="status" className="${EMPTY_CLASS}">{children}</p>`),'the classes are those of CReviewEmpty');
  assert.ok(read(FRAME).includes(`<p role="status" className="${EMPTY_CLASS}">{children}</p>`));
  // Inside a frame it is the only status element and the frame adds no wording of its own.
  const html=frame({},h(PillarCSectionEmpty,null,sentence));
  assert.equal((html.match(/role="status"/g)||[]).length,1);
  assert.equal(text(html),`3 Titolo di prova Qual è la domanda di prova? ${sentence}`);
});

// ---------------------------------------------------------------- the page scope bar
const ORGS=[{value:'unit-a',label:'Azienda sintetica Alfa'},{value:'tutte',label:'Aggregato sintetico'}];
const CHANNELS=[{value:'Tutti',label:'Tutti i canali'},{value:'CO',label:'CO'},{value:'DD',label:'DD'},{value:'DPC',label:'DPC'}];
const TAMPERED='Il collegamento di prova indicava un ambito non disponibile: è mostrato il tuo ambito.';
const SCOPE='Azienda sintetica Alfa · Tutti i canali';
const bar=(props={})=>render(h(PillarCScopeBar,{orgOptions:ORGS,org:'unit-a',channelOptions:CHANNELS,channel:'Tutti',onChange(){},onReset(){},tamperedText:TAMPERED,scope:SCOPE,...props}));
const options=(html,label)=>{const m=html.match(new RegExp(`<select[^>]* aria-label="${label}"[^>]*>(.*?)</select>`));assert.ok(m,`select «${label}»`);return [...m[1].matchAll(/<option value="([^"]*)"( selected="")?>([^<]*)<\/option>/g)].map(x=>[x[1],x[3],Boolean(x[2])]);};
const IDENT=/\s(value|href|id|for|name|download|aria-controls|aria-describedby|aria-labelledby|data-[a-z0-9-]+)="([^"]*)"/g;

test('PillarCScopeBar: the two selects with their labels and options from props, «Copia vista» keyed, «Azzera», the status sentence',()=>{
  const html=bar();
  assert.match(html,/^<section aria-label="Ambito di revisione" class="rounded-2xl border border-border bg-card p-5 shadow-sm md:p-6">/);
  assert.ok(html.includes('<label class="text-xs font-medium text-muted-foreground">Ambito<select aria-label="Ambito aziendale" class="'),'«Ambito» labels the organisation select');
  assert.ok(html.includes('<label class="text-xs font-medium text-muted-foreground">Canale<select aria-label="Canale dell’analisi" class="'),'«Canale» labels the channel select, with the typographic apostrophe');
  assert.deepEqual(options(html,'Ambito aziendale'),[['unit-a','Azienda sintetica Alfa',true],['tutte','Aggregato sintetico',false]]);
  assert.deepEqual(options(html,'Canale dell’analisi'),[['Tutti','Tutti i canali',true],['CO','CO',false],['DD','DD',false],['DPC','DPC',false]]);
  assert.deepEqual(options(bar({org:'tutte',channel:'DPC'}),'Ambito aziendale').map(o=>o[2]),[false,true],'the selected option follows the org prop');
  assert.deepEqual(options(bar({org:'tutte',channel:'DPC'}),'Canale dell’analisi').map(o=>o[2]),[false,false,false,true],'the selected option follows the channel prop');
  assert.equal((html.match(/<select\b/g)||[]).length,2,'two selects, nothing else to choose');
  // The actions: «Copia vista» inside its own span (replaced whole when it becomes «Link copiato»), «Azzera» last.
  const buttons=[...html.matchAll(/<button type="button" class="([^"]*)">([\s\S]*?)<\/button>/g)];
  assert.equal(buttons.length,2);
  assert.match(buttons[0][2],/^<svg[^>]* aria-hidden="true"[\s\S]*<\/svg><span>Copia vista<\/span>$/);
  assert.match(buttons[1][2],/^<svg[^>]* aria-hidden="true"[\s\S]*<\/svg>Azzera$/);
  assert.equal((html.match(/<svg\b/g)||[]).length,2,'the two icons only');
  assert.equal((html.match(/<svg\b[^>]*aria-hidden="true"/g)||[]).length,2,'every icon is decorative');
  // A caller's reset label replaces «Azzera».
  const custom=bar({resetLabel:'Ripristina'});
  assert.match(custom,/<\/svg>Ripristina<\/button>/);assert.doesNotMatch(custom,/Azzera/);
  // The screen-reader status: one sentence in a persistent live region, keyed on the scope.
  assert.ok(html.endsWith(`<p class="sr-only" role="status" aria-live="polite"><span>${SCOPE}. Selezione aggiornata.</span></p></section>`));
  assert.equal((html.match(/role="status"/g)||[]).length,1);
  assert.equal(text(html),`Ambito Azienda sintetica Alfa Aggregato sintetico Canale Tutti i canali CO DD DPC Copia vista Azzera ${SCOPE}. Selezione aggiornata.`,'the visible and spoken text, nothing more');
  assert.doesNotMatch(html,NEVER);
  assert.doesNotMatch(html,/tabindex=/,'no tabindex at all: selects and buttons are natively focusable');
  // 44 px targets and the full field and action classes of review-blocks.tsx (focus ring, hover, borders) on every
  // select and button.
  const selects=[...html.matchAll(/<select[^>]* class="([^"]*)"/g)];
  assert.equal(selects.length,2);
  for(const [,cls] of selects)assert.equal(cls,SELECT_CLASS);
  for(const [,cls] of buttons)assert.equal(cls,ACTION_CLASS);
  assert.match(SELECT_CLASS,/\bh-11\b.*focus-visible:outline-primary/);assert.match(ACTION_CLASS,/\bmin-h-11\b.*hover:bg-secondary.*focus-visible:outline-primary/);
  // The class prop merges with the bar's own.
  assert.match(bar({className:'xl:sticky'}),/^<section aria-label="Ambito di revisione" class="[^"]*\bxl:sticky\b[^"]*">/);
  // Identifier-like attributes carry only what the props gave (the rule the scoped renders are held to).
  for(const [,attr,value] of html.matchAll(IDENT)){
    assert.doesNotMatch(value,/(^|[^A-Za-z])(AQ|CH|PE|TE)([^A-Za-z]|$)/,`${attr}="${value}"`);
    assert.notEqual(value,'Regione',attr);
    assert.ok(['unit-a','tutte','Tutti','CO','DD','DPC'].includes(value),`${attr}="${value}" comes from the props`);
  }
});

test('the tampered note renders only when tampered, with the text the caller gives',()=>{
  const off=bar(),explicit=bar({tampered:false}),on=bar({tampered:true});
  assert.doesNotMatch(off,/role="note"/);assert.doesNotMatch(explicit,/role="note"/);
  assert.doesNotMatch(off,/indicava un ambito/);
  assert.ok(on.includes(`</div><p role="note" class="mt-4 text-xs font-medium">${TAMPERED}</p><p class="sr-only" role="status"`),'the note sits between the controls and the status');
  assert.equal((on.match(/role="note"/g)||[]).length,1);
  assert.equal(text(on),`Ambito Azienda sintetica Alfa Aggregato sintetico Canale Tutti i canali CO DD DPC Copia vista Azzera ${TAMPERED} ${SCOPE}. Selezione aggiornata.`);
});

test('the bar hands every change to the caller and never writes the URL itself',()=>{
  const source=read(BAR);
  assert.ok(source.startsWith('"use client";\n'));
  assert.ok(source.includes('const change = (patch: { org?: string; channel?: string }) => { setCopied(false); onChange(patch); };'));
  assert.ok(source.includes('onChange={(e) => change({ org: e.target.value })}'));
  assert.ok(source.includes('onChange={(e) => change({ channel: e.target.value })}'));
  assert.ok(source.includes('onClick={() => { setCopied(false); onReset(); }}'));
  assert.ok(source.includes('const copy = async () => { try { await navigator.clipboard.writeText(copyHref ? copyHref() : window.location.href); setCopied(true); } catch { setCopied(false); } };'));
  assert.doesNotMatch(code(BAR),/pushState|replaceState|location\.search|location\.hash|useSearchParams|next\/navigation/,'the workspace owns the one pushState and the reset');
  assert.ok(source.includes('resetLabel = "Azzera"'));
  // Keyed changing text, as the existing bars have it, and a persistent live region with a keyed inner span.
  assert.ok(source.includes('<span key={copied ? "copied" : "copy"}>{copied ? "Link copiato" : "Copia vista"}</span>'));
  assert.ok(source.includes('<p className="sr-only" role="status" aria-live="polite"><span key={scope}>{`${scope}. Selezione aggiornata.`}</span></p>'));
  assert.ok(source.includes('{tampered ? <p role="note" className="mt-4 text-xs font-medium">{tamperedText}</p> : null}'));
});

// ---------------------------------------------------------------- source pins common to both files
test('both files are presentation-only: no organisation vocabulary, nothing from the Pillar C libs, no fetch, no forbidden wording',()=>{
  const DRIVEN=String.raw`\{(?:scope|text|question|title|number|children|copied|resetLabel|tamperedText|o\.label|org|channel)[^{}]*\}`;
  const TEXT=String.raw`[^<>{}\`\n]*[^<>{}\`\s][^<>{}\`\n]*`;
  for(const file of [FRAME,BAR]){
    // The owner's rule holds for the whole file, comments included; the pins on imports and identifiers read the code.
    assert.doesNotMatch(read(file),/audience/i,`${file}: the word in any form`);
    const source=code(file);
    assert.doesNotMatch(source,/audience-context|audience-view|audience-rules|reviewer-labels|-loader["']|-storage["']|\/insights["']|insight-charts|reset-search|cReviewSearch|cScopedReviewSearch|cInsightResetSearch|review-blocks|C_REVIEW_UI|analytical-workspace|scoped-workspace/,file);
    assert.doesNotMatch(source,/\bC_ORG_LABELS\b|\bC_ORGS\b|\bC_ATTR_ORGS\b|\bC_AUDIENCE_COPY\b/,file);
    assert.doesNotMatch(source,/^import [^;]*"@\/lib\/dashboard-review\//m,`${file}: nothing from the Pillar C libs; labels and options arrive as props`);
    assert.doesNotMatch(source,/^import [^;]*"@\/lib\/supabase\//m,file);
    assert.doesNotMatch(source,/fetch\(|process\.env|server-only/,file);
    assert.doesNotMatch(source,/["']use cache(?::[a-z]+)?["']|unstable_cache|cacheTag|cacheLife/,file);
    assert.doesNotMatch(read(file),/verificat|\bdemo\b|dimostra|in arrivo/i,`${file}: the wording rule holds for the whole file, comments included, as the repo-wide pin reads it`);
    assert.doesNotMatch(source,/["'`](AQ|CH|PE|TE)["'`]/,`${file}: no province key`);
    assert.doesNotMatch(source,/13020[1-4]|aquila|avezzano|sulmona|chieti|lanciano|vasto|pescara|teramo|abruzzo/i,`${file}: no NSIS code or place name`);
    assert.doesNotMatch(source,/tabIndex=\{[1-9]/,`${file}: no positive tabindex`);
    assert.doesNotMatch(source,/ |\d %/,`${file}: no invisible no-break space, no "n %" with an ordinary space`);
    assert.doesNotMatch(source,/\b(?:min-)?w-\[\d+px\]/,`${file}: no fixed pixel width`);
    assert.doesNotMatch(source,/(?<!motion-safe:|motion-reduce:)\btransition-/,`${file}: motion-safe transitions only`);
    assert.doesNotMatch(source,/^(?:export )?(?:let|var) |^(?:export )?const \w+ ?= ?new (?:Map|WeakMap|Set)\(/m,`${file}: no module-level mutable state`);
    // No literal JSX text next to a prop- or state-driven expression inside the same element (Chrome page translation).
    assert.doesNotMatch(source,new RegExp(`>${TEXT}${DRIVEN}`),file);assert.doesNotMatch(source,new RegExp(`${DRIVEN}${TEXT}<`),file);
  }
  // The frame has no hooks, no handlers and no client directive; the bar's imports are exactly three.
  const frameSource=code(FRAME),barSource=code(BAR);
  assert.doesNotMatch(frameSource,/"use client"|\buse[A-Z]\w*\(|onClick|onChange|window\.|document\./);
  assert.deepEqual(frameSource.match(/^import .*$/gm),['import type { ReactNode } from "react";','import { cn } from "@/lib/utils";']);
  assert.deepEqual(barSource.match(/^import .*$/gm),['import { useState } from "react";','import { Copy, RotateCcw } from "lucide-react";','import { cn } from "@/lib/utils";']);
  assert.deepEqual(frameSource.match(/^export (?:type|function) \w+/gm),['export function PillarCScopeLine','export type PillarCSectionFrameProps','export function PillarCSectionFrame','export function PillarCSectionEmpty']);
  assert.deepEqual(barSource.match(/^export (?:type|function) \w+/gm),['export type PillarCScopeOption','export type PillarCScopeBarProps','export function PillarCScopeBar']);
});
