import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {safeNext,loginNext,loginRedirectSearch,loginDestination,LOGIN_DEFAULT_NEXT} from '../lib/auth/safe-next.ts';

// R20-05 (Codex final review, 23 Oct 2026): the page asked for before sign-in comes back after it, through a
// validated same-site `next`, and approved administrators work inside the dashboard shell.
const read=p=>readFileSync(fileURLToPath(new URL(`../${p}`,import.meta.url)),'utf8').replace(/\r\n/g,'\n');
const F='/fallback';

test('safeNext keeps same-site paths and refuses every off-site form, including the encoded and whitespace bypasses',()=>{
  for(const ok of ['/dashboard-review/pillar-c','/dashboard-review/pillar-c?org=asl-1&period=FY2025','/access?next=%2Fdashboard-review%2Fspend','/a#fattori'])
    assert.equal(safeNext(ok,F),ok,ok);
  for(const bad of [null,'','https://evil.example','http:/evil.example','javascript:alert(1)','//evil.example','///evil.example',
    '/\\evil.example','/a\\b','/\t/evil.example','/\n/evil.example','/%2F%2Fevil.example','/%2fevil.example','/%5Cevil.example','evil.example','?next=/x',
    '/'+'a'.repeat(2048)])
    assert.equal(safeNext(bad,F),F,JSON.stringify(bad));
  // The returned value is the parsed, normalised path, never the raw text.
  assert.equal(safeNext('/a/../b?x=1',F),'/b?x=1');
});

test('loginNext: a safe page or the default, never an auth or API route',()=>{
  assert.equal(LOGIN_DEFAULT_NEXT,'/dashboard-review/spend');
  assert.equal(loginNext(undefined),LOGIN_DEFAULT_NEXT);
  assert.equal(loginNext('https://evil.example/dashboard-review/pillar-c'),LOGIN_DEFAULT_NEXT);
  for(const loop of ['/auth/login','/auth/login?next=/x','/auth','/api/pillar-c/evidence','/api'])assert.equal(loginNext(loop),LOGIN_DEFAULT_NEXT,loop);
  assert.equal(loginNext('/authors'),'/authors','only the auth tree itself is refused');
  assert.equal(loginNext('/dashboard-review/pillar-c?org=asl-3&period=FY2025#fattori'),'/dashboard-review/pillar-c?org=asl-3&period=FY2025#fattori');
});

test('loginRedirectSearch: GET pages carry their path and filters; API calls, other methods and unsafe targets carry nothing',()=>{
  const search=loginRedirectSearch('/dashboard-review/pillar-c','?org=asl-1&period=FY2025&trend=monthly','GET');
  assert.equal(search,'?next='+encodeURIComponent('/dashboard-review/pillar-c?org=asl-1&period=FY2025&trend=monthly'));
  // The value read back from that query is the same validated destination.
  assert.equal(loginNext(new URLSearchParams(search).get('next')),'/dashboard-review/pillar-c?org=asl-1&period=FY2025&trend=monthly');
  assert.equal(loginRedirectSearch('/api/pillar-c/evidence','','GET'),'');
  assert.equal(loginRedirectSearch('/dashboard-review/pillar-c','','POST'),'');
  assert.equal(loginRedirectSearch('/dashboard-review/spend','','GET'),'','the default needs no parameter');
  assert.equal(loginRedirectSearch('//evil.example','','GET'),'');
  assert.equal(loginRedirectSearch('/dashboard-review/pillar-c','?x='+'a'.repeat(3000),'GET'),'','too long: dropped, not truncated');
});

test('loginDestination re-attaches only a plain section anchor the browser kept across the redirect',()=>{
  assert.equal(loginDestination('/dashboard-review/pillar-c?org=asl-1','#fattori'),'/dashboard-review/pillar-c?org=asl-1#fattori');
  assert.equal(loginDestination('/dashboard-review/pillar-c#quadro','#fattori'),'/dashboard-review/pillar-c#quadro','the target keeps its own');
  for(const hash of ['','#','#1abc','#a b','#<script>','#'+'a'.repeat(80),'#a/../b'])
    assert.equal(loginDestination('/x',hash),'/x',JSON.stringify(hash));
});

test('the proxy, the sign-in page and form, the access page and the callback routes all go through the shared guard',()=>{
  const proxy=read('lib/supabase/proxy.ts');
  assert.ok(proxy.includes('url.search = loginRedirectSearch(request.nextUrl.pathname, request.nextUrl.search, request.method);\n    url.pathname = "/auth/login";'));
  const page=read('app/auth/login/page.tsx');
  assert.ok(page.includes('const destination = loginNext(next);')&&page.includes('if (!error) redirect(destination);')&&page.includes('return <LoginForm next={destination} />;'));
  assert.doesNotMatch(page,/function safeNext/,'no second, weaker copy of the guard');
  const form=read('components/login-form.tsx');
  assert.ok(form.includes('router.push(loginDestination(next, window.location.hash));'));
  assert.doesNotMatch(form,/router\.push\("\/dashboard-review\/spend"\)/,'the destination is no longer hard-coded');
  const access=read('app/access/page.tsx');
  assert.ok(access.includes('const destination = loginNext(next);')&&access.includes('if (approved) redirect(destination);'));
  for(const route of ['app/auth/callback/route.ts','app/auth/confirm/route.ts'])assert.match(read(route),/safeNext\(/,route);
});

test('admin pages: the dashboard shell for an approved administrator only; the Control Center drops its duplicate chrome there',()=>{
  const layout=read('app/admin/layout.tsx');
  assert.ok(layout.includes('const [org, adminEmail, viewer] = await Promise.all([getCurrentOrg(), getAdminEmail(), getViewerIdentity()]);'));
  assert.ok(layout.includes('if (!org || !adminEmail) return <>{children}</>;'),'no shell, and no links, for an account the admin gate refuses');
  assert.ok(layout.includes('<DashboardReviewNav org={org} isAdmin viewer={viewer}>'));
  const page=read('app/admin/control-center/page.tsx');
  assert.ok(page.includes('const adminEmail = await getAdminEmail();\n  if (!adminEmail) return <Restricted />;'),'the page gate is unchanged');
  assert.ok(page.includes('const embedded = Boolean(await getCurrentOrg());')&&page.includes('<AccessControlCenter adminEmail={adminEmail} data={data} embedded={embedded} />'));
  const center=read('components/admin/access-control-center.tsx');
  assert.ok(center.includes('{!embedded && <VisLogoLink size="sm" />}')&&center.includes('{!embedded && <div className="flex items-center gap-2">'));
  const nav=read('components/dashboard-review/nav.tsx');
  assert.ok(nav.includes('aria-current={pathname === "/admin/control-center" ? "page" : undefined}'));
});
