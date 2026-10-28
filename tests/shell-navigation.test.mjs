import test from 'node:test';
import assert from 'node:assert/strict';
import {register,createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';

// THE SHELL AND THE HOME (commit 1.1 of the six-section work, 22 October 2026).
// Every placement of the wordmark links home through one definition
// (VisLogoLink) with one accessible name; the three pillars carry the same
// three labels in the sidebar, on the homepage, in the public Pillar A header
// and in the access portal; «Esci» is rendered at every width, not only from
// md; and the sidebar's hrefs, its admin gate and the dashboard-review
// layout's auth lines are pinned so a presentation change cannot move them.
// Rendering is server-side only (react-dom/server) with the same sucrase
// loader as account-onboarding-render; the data layer is stubbed, never read.

const root=fileURLToPath(new URL('..',import.meta.url));
const read=p=>readFileSync(`${root}${p}`,'utf8').replace(/\r\n/g,'\n');

register('data:text/javascript,'+encodeURIComponent(`
import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';
let sucrase;export function initialize({pkg}){sucrase=createRequire(pkg)('sucrase');}
const nav='data:text/javascript,'+encodeURIComponent('export function usePathname(){return globalThis.__shellPathname??"/dashboard-review/spend"}export function useRouter(){return {push(){},refresh(){},replace(){}}}');
const supabase='data:text/javascript,'+encodeURIComponent('export function createClient(){throw Error("the shell test never opens a Supabase client")}');
const actions='data:text/javascript,'+encodeURIComponent('export async function requestOrganizationAccess(){throw Error("unexpected write")}export async function respondToOrganizationInvitation(){throw Error("unexpected write")}');
export async function resolve(s,c,n){if(s==='next/navigation')return {url:nav,shortCircuit:true};if(s==='@/lib/supabase/client')return {url:supabase,shortCircuit:true};if(s==='@/app/access/actions')return {url:actions,shortCircuit:true};return n(s==='next/link'?s+'.js':s,c);}
export async function load(u,c,n){if(u.startsWith('file:')&&u.endsWith('.tsx')){const f=fileURLToPath(u);return {format:'module',source:sucrase.transform(readFileSync(f,'utf8'),{transforms:['typescript','jsx'],jsxRuntime:'automatic',production:true,filePath:f}).code,shortCircuit:true};}return n(u,c);}
`),{data:{pkg:pathToFileURL(`${root}package.json`).href}});
const req=createRequire(`${root}package.json`),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const {VisLogo,VisLogoLink}=await import('../components/vis-logo.tsx');
const {DashboardReviewNav}=await import('../components/dashboard-review/nav.tsx');
const {AccessPortal}=await import('../components/access/access-portal.tsx');
const {default:Home}=await import('../app/page.tsx');
const {default:AuthLayout}=await import('../app/auth/layout.tsx');
const {PublicPillarHeader}=await import('../components/public-pillar-header.tsx');
const h=React.createElement,render=el=>renderToStaticMarkup(el);

// The three labels, the one accessible name of the logo link, and where each must appear.
const LABELS={A:'Pillar A · Fonti pubbliche',B:'Pillar B · Biosimilari ed esclusività',C:'Pillar C · Aree cliniche e budget'};
const HOME_LABEL='VIS Pharma Compass · torna alla home';
const isHome=a=>a.href==='/'&&a.label===HOME_LABEL;
const LOGO_PLACEMENTS={
  'components/dashboard-review/nav.tsx':1,
  'app/page.tsx':2,
  'app/dashboard-review/layout.tsx':1,
  'components/access/access-portal.tsx':1,
  'app/admin/control-center/page.tsx':2,
  'components/admin/access-control-center.tsx':1,
  'components/public-pillar-header.tsx':1,
  'app/auth/layout.tsx':1,
};
const org={org_code:'T-A',org_name:'Azienda di prova',org_type:'asl',region_code:'T1'};
const member={email:'member@example.invalid',name:'Account di prova',nameIsEmail:false,isReviewer:false};
const overview={userId:'test-user',email:'test@example.invalid',organizations:[],memberships:[],invitations:[],setupRequired:false};
const sidebar=(props={})=>render(h(DashboardReviewNav,{org,viewer:member,...props},h('p',null,'contenuto')));
/** The anchors of a rendered fragment: href and the text a screen reader gets (aria-hidden subtrees removed). */
function anchors(html){
  return [...html.matchAll(/<a\s([^>]*)>([\s\S]*?)<\/a>/g)].map(([,attrs,inner])=>({
    href:attrs.match(/href="([^"]*)"/)?.[1]??null,
    label:attrs.match(/aria-label="([^"]*)"/)?.[1]??null,
    text:inner.replace(/<svg[\s\S]*?<\/svg>/g,'').replace(/<[^>]+>/g,'').replace(/\s+/g,' ').trim(),
    attrs,
  }));
}

test('VisLogoLink is the one way home: href="/", the accessible name, a 44 px target; VisLogo stays presentational',()=>{
  const link=render(h(VisLogoLink,{size:'sm'}));
  const [a,...rest]=anchors(link);
  assert.ok(a&&isHome(a)&&rest.length===0,link.slice(0,160));
  assert.match(a.attrs,/class="[^"]*\bmin-h-11\b[^"]*"/,'the link is at least 44 px tall');
  assert.match(link,/^<a\s[^>]*>[\s\S]*VIS PHARMA[\s\S]*COMPASS[\s\S]*<\/a>$/,'the wordmark is inside the link');
  const bare=render(h(VisLogo,{size:'sm'}));
  assert.doesNotMatch(bare,/<a\s/,'the bare logo is not a link');
  const source=read('components/vis-logo.tsx');
  assert.match(source,/export function VisLogoLink\(\{/);
  assert.ok(source.includes('href="/"')&&source.includes(`aria-label="${HOME_LABEL}"`));
  // The presentational component is byte-identical to its earlier definition.
  assert.ok(source.includes('export function VisLogo({\n  size = "md",\n  className,\n}: {\n  size?: "sm" | "md" | "lg";\n  className?: string;\n}) {\n  return (\n    <div className={cn("inline-flex items-center", GAP[size], className)}>\n      <CompassIcon size={ICON_SIZE[size]} />'));
});

test('every logo placement of the shell goes through VisLogoLink; no bare wordmark, no copied mark',()=>{
  for(const [file,count] of Object.entries(LOGO_PLACEMENTS)){
    const source=read(file);
    const placements=source.match(/<VisLogoLink size="(?:sm|md)"(?: className="[^"]*")? \/>/g)??[];
    assert.equal(placements.length,count,`${file}: ${placements.length} VisLogoLink placements`);
    assert.doesNotMatch(source,/<VisLogo\s/,`${file} still renders the bare VisLogo`);
    assert.doesNotMatch(source,/<Link href="\/"(?: [^>]*)?>\s*<VisLogo/,`${file} wraps the logo in its own link`);
    assert.ok(source.includes('import { VisLogoLink } from "@/components/vis-logo";'),`${file} imports the link`);
  }
  const auth=read('app/auth/layout.tsx');
  assert.doesNotMatch(auth,/AuthMark|<svg|VIS PHARMA/,'the auth pages no longer carry their own copy of the mark');
  const layout=render(h(AuthLayout,null,h('form',{id:'child'})));
  assert.ok(anchors(layout).some(isHome)&&layout.includes('<form id="child"></form>'),'the auth layout links home above its children');
  // Server-rendered: the sidebar, the access portal and the homepage each link home with that name.
  const homes=html=>anchors(html).filter(isHome).length;
  assert.equal(homes(sidebar()),1,'sidebar');
  assert.equal(homes(render(h(AccessPortal,{overview}))),1,'access portal');
  assert.equal(homes(render(h(Home))),2,'homepage: sticky nav and footer');
  assert.equal(anchors(sidebar()).filter(a=>a.href==='/dashboard-review/spend'&&a.label).length,0,'the sidebar logo no longer goes to the spend overview');
});

test('the three pillar labels are the same strings in the sidebar, on the homepage, in the public header and in the access portal',()=>{
  const want=[LABELS.A,LABELS.B,LABELS.C];
  // Sidebar: the «Pilastri» group, by source and by render.
  const nav=read('components/dashboard-review/nav.tsx');
  const group=nav.slice(nav.indexOf('label: "Pilastri"'),nav.indexOf('label: "Esplorazione"'));
  assert.deepEqual([...group.matchAll(/\{ href: "[^"]+", label: "([^"]+)"/g)].map(m=>m[1]),want);
  const rendered=anchors(sidebar());
  assert.equal(rendered.find(a=>a.href==='/pillar-a')?.text,LABELS.A);
  assert.equal(rendered.find(a=>a.href==='/dashboard-review/revisione-pillar-b')?.text,LABELS.B);
  assert.equal(rendered.find(a=>a.href==='/dashboard-review/pillar-c')?.text,LABELS.C);
  // Homepage: the pill shows the icon alone below lg and the name from lg; the subtitle is screen-reader-only at
  // every width, so the accessible name is always the full label and the sticky bar fits every viewport.
  const home=read('app/page.tsx');
  for(const [href,label] of [['/pillar-a',LABELS.A],['/pillar-b',LABELS.B],['/pillar-c',LABELS.C]]){
    const [name,subtitle]=label.split(' · ');
    assert.ok(home.includes(`<Link href="${href}">`),`homepage links ${href}`);
    assert.ok(home.includes(`<span className="sr-only lg:not-sr-only">${name}</span><span className="sr-only"> · ${subtitle}`),`homepage label for ${href}`);
  }
  assert.match(home,/text-muted-foreground xl:flex">/,"the section anchors appear only from xl: with them the bar overflowed at 768 and 1024");
  assert.doesNotMatch(home,/hidden xl:inline"> · /,'no visible subtitle at any width: the bar overflowed its container with three of them');
  const homeAnchors=anchors(render(h(Home)));
  assert.equal(homeAnchors.find(a=>a.href==='/pillar-a')?.text,`Pillar A · Fonti pubbliche`);
  assert.equal(homeAnchors.find(a=>a.href==='/pillar-b')?.text,`Pillar B · Biosimilari ed esclusività`);
  const c=homeAnchors.find(a=>a.href==='/pillar-c');
  assert.equal(c?.text,LABELS.C,'Pillar C now opens its public-source page');
  assert.match(c.attrs,/class="[^"]*\bbefore:-inset-y-1\.5\b[^"]*"/,'the 32 px pill reaches a 44 px touch target');
  assert.ok(!home.includes('<Lock aria-hidden="true" className="ml-1 size-3.5" />'),'the public link has no reserved-only lock');
  // The three public pages share one header, keeping their reserved destinations.
  const pillarA=read('app/pillar-a/page.tsx');
  assert.ok(pillarA.includes('title: "Pillar A · Fonti pubbliche | VIS Pharma Compass"'),'the page title uses the same label as every link to it');
  for(const [key,reserved] of [['a','/dashboard-review/antibiotici'],['b','/dashboard-review/revisione-pillar-b'],['c','/dashboard-review/pillar-c']]){
    assert.ok(read(`app/pillar-${key}/page.tsx`).includes(`<PublicPillarHeader active="${key}" />`));
    const html=render(h(PublicPillarHeader,{active:key})),links=anchors(html);
    assert.match(html,/aria-label="Navigazione pubblica"/);
    assert.ok(links.some(isHome));
    for(const k of ['a','b','c']){
      const link=links.find(a=>a.href===`/pillar-${k}`);
      assert.equal(link?.text,LABELS[k.toUpperCase()]);
      assert.match(link.attrs,/min-h-11/);
      assert.equal(link.attrs.includes('aria-current="page"'),key===k);
    }
    assert.ok(links.some(a=>a.href===reserved&&a.text==='Area riservata'));
  }
  // Access portal: all three public pillars, no reserved destination.
  const portal=anchors(render(h(AccessPortal,{overview})));
  assert.equal(portal.find(a=>a.href==='/pillar-a')?.text,LABELS.A);
  assert.equal(portal.find(a=>a.href==='/pillar-b')?.text,LABELS.B);
  assert.equal(portal.find(a=>a.href==='/pillar-c')?.text,LABELS.C);
  assert.equal(portal.some(a=>a.href==='/dashboard-review/pillar-c'),false,'a pending account is not pointed at the reserved pillar');
  // The old spellings are gone from the shell.
  for(const file of Object.keys(LOGO_PLACEMENTS))assert.doesNotMatch(read(file),/Pillar [AB] · dati pubblici|Pillar A · fonti pubbliche/,file);
});

test('«Esci» is rendered at every width, as a 44 px target',()=>{
  const nav=read('components/dashboard-review/nav.tsx');
  assert.match(nav,/<div className="mt-auto">\n\s*<LogoutButton label="Esci" className="min-h-11 w-full text-muted-foreground hover:text-foreground" \/>\n\s*<\/div>/);
  assert.doesNotMatch(nav,/hidden md:block">\s*<LogoutButton/,'the md-only wrapper is gone');
  const html=sidebar();
  const m=html.match(/<div class="mt-auto"><button class="([^"]*)"[^>]*>(?:(?!<\/button>).)*Esci<\/button><\/div>/);
  assert.ok(m,'the logout button sits directly in the mt-auto wrapper');
  assert.doesNotMatch(m[1],/\bhidden\b/);
  assert.match(m[1],/\bmin-h-11\b/);
});

test('sidebar hrefs, the admin gate and the role forwarding are unchanged',()=>{
  const nav=read('components/dashboard-review/nav.tsx');
  const groups=nav.slice(nav.indexOf('const NAV_GROUPS = ['),nav.indexOf('export function DashboardReviewNav('));
  assert.deepEqual([...groups.matchAll(/href: "([^"]+)"/g)].map(m=>m[1]),[
    '/dashboard-review/spend','/dashboard-review/benchmark',
    '/pillar-a','/dashboard-review/revisione-pillar-b','/dashboard-review/pillar-c',
    '/dashboard-review/ricerca','/dashboard-review/antibiotici',
    '/dashboard-review/obiettivi','/dashboard-review/dati','/dashboard-review/richieste',
  ]);
  assert.ok(groups.includes('{ href: "/dashboard-review/pillar-c", label: "Pillar C · Aree cliniche e budget", icon: PanelsTopLeft, previewOnly: false }'));
  assert.ok(nav.includes('if ("previewOnly" in item && item.previewOnly && !viewer?.isReviewer && !isAdmin) return null;'));
  assert.match(nav,/\{isAdmin && \(\n\s*<div className="border-t border-border pt-4">[\s\S]*?href="\/admin\/control-center"/);
  assert.equal(anchors(sidebar()).some(a=>a.href==='/admin/control-center'),false,'no admin link for a member');
  assert.equal(anchors(sidebar({isAdmin:true})).some(a=>a.href==='/admin/control-center'),true,'the admin link for an admin');
  const reviewer=sidebar({viewer:{...member,isReviewer:true}});
  assert.match(reviewer,/Revisore/);assert.doesNotMatch(reviewer,/Azienda di prova/,'a reviewer is not shown an Azienda');
  assert.match(sidebar(),/Azienda di prova[\s\S]*Dati limitati al perimetro autorizzato/);
  // Every pillar entry renders for a plain member: nothing of this commit gates one.
  const hrefs=anchors(sidebar()).map(a=>a.href);
  for(const href of ['/pillar-a','/dashboard-review/revisione-pillar-b','/dashboard-review/pillar-c'])assert.ok(hrefs.includes(href),href);
  // The layout: auth reads, the bare-logo fallback, the reviewer forwarding and the admin flag, byte for byte.
  const layout=read('app/dashboard-review/layout.tsx');
  for(const line of [
    'const [org, adminEmail, viewer] = await Promise.all([\n    getCurrentOrg(),\n    getAdminEmail(),\n    getViewerIdentity(),\n  ]);',
    'if (!org) {\n    const overview = await getAccessOverview();\n    if (!overview) {\n      return (\n        <div className="flex min-h-svh items-center justify-center">\n          <VisLogoLink size="sm" />\n        </div>\n      );\n    }',
    'return <AccessPortal overview={overview} isAdmin={Boolean(adminEmail)} isReviewer={Boolean(viewer?.isReviewer)} />;',
    '<DashboardReviewNav org={org} isAdmin={Boolean(adminEmail)} viewer={viewer}>',
  ])assert.ok(layout.includes(line),line.split('\n')[0]);
  // The control-center gates and the public page's reserved target.
  const center=read('app/admin/control-center/page.tsx');
  assert.ok(center.includes('const adminEmail = await getAdminEmail();\n  if (!adminEmail) return <Restricted />;'));
  // R20-05: inside the dashboard shell (approved admin with an organisation) every view drops its own chrome.
  assert.ok(center.includes('const embedded = Boolean(await getCurrentOrg());\n  if (!hasServiceRoleConfig()) return <SetupRequired embedded={embedded} />;'));
  assert.ok(center.includes('return <SetupRequired detail={detail} embedded={embedded} />;')&&center.includes('{!embedded && <VisLogoLink size="sm" className="self-start" />}'));
  assert.ok(center.includes('<Button asChild variant="outline"><Link href="/dashboard-review/spend">Torna alla piattaforma</Link></Button>'));
  const home=read('app/page.tsx');
  assert.ok(home.includes('href="/pillar-a"')&&home.includes('href="/pillar-b"')&&home.includes('<Link href="/auth/login">Accedi</Link>'));
});

const between=(s,a,b)=>{const i=s.indexOf(a);assert.ok(i>=0,a);const j=s.indexOf(b,i);assert.ok(j>i,b);return s.slice(i,j);};
// PR25-04 (26 Oct 2026): the homepage offers what is delivered, keeps what is in development apart, and every figure it
// shows is a public AIFA value with its lane, year and provisional status (recomputed from the raw AIFA files; the
// receipt is private). The unsourced figures of the first version (13 Oct inventory) never come back.
test('PR25-04: the homepage separates delivered areas from those in development and shows only sourced, dated figures',()=>{
  const html=render(h(Home)),t=html.replace(/<[^>]*>/g,' ').replace(/&#x27;/g,'’').replace(/\s+/g,' ');
  const modal=read('components/access-prompt.tsx'),page=read('app/page.tsx');
  for(const src of [t,modal,page])assert.doesNotMatch(src,/29,7|73,8|91,4|608M|\+5,9%|\+7,4%|Dati verificabili|Nessun dato paziente|Sette moduli/,'no unsourced or retired claim');
  // Direct purchases and convenzionata are separate lanes: two figures, never one sum; 2025 is provisional.
  assert.ok(t.includes('€19,2 mld acquisti diretti, Italia 2025 (provvisorio)')&&t.includes('€10,5 mld convenzionata, Italia 2025 (provvisorio)'));
  assert.ok(t.includes('Dati 2025: istantanea del 14/05/2026, soggetta a revisione. Acquisti diretti e convenzionata sono flussi distinti e non si sommano.'));
  assert.ok(modal.includes('I due flussi non si sommano.')&&modal.includes('Acquisti diretti 2025 · provvisorio'));
  // Delivered areas, then the in-development list, each named once.
  const delivered=t.slice(t.indexOf('Disponibile oggi'),t.indexOf('In sviluppo, non ancora disponibili'));
  for(const area of ['Spesa e consumi','Biosimilari ed esclusività','Aree cliniche e budget','Confronto tra aziende','Evidenza e verifiche'])assert.ok(delivered.includes(area),area);
  const upcoming=between(html,'data-home-upcoming','</ul>');
  for(const area of ['File ospedalieri e rimborsi','Scorte e carenze','Allestimenti','Budget impact']){assert.ok(upcoming.includes(area),area);assert.ok(!delivered.includes(area),`${area} is not offered as delivered`);}
  // Every phase states its status in words.
  assert.deepEqual([...html.matchAll(/inline-flex rounded-full px-2 py-0\.5 text-\[10px\] font-semibold [^"]*">([^<]*)<\/p>/g)].map(m=>m[1]),
    ['In parte','Disponibile','Disponibile','In sviluppo','In sviluppo','In parte','Disponibile']);
  assert.ok(t.includes('scenari di budget modellati, distinti dai budget approvati'),'modelled budgets are never sold as approved budgets');
  // Codex review B26-03: the benefit graphics are schemas, not data; they carry no figure and are labelled as such.
  assert.doesNotMatch(page,/€124|0,42\/mg/,'no unsourced figure in the benefit graphics');
  assert.equal((t.match(/Schema illustrativo, non un dato/g)||[]).length,2,'the trend and cost schemas are both labelled');
});
