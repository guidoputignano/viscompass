// XC-X3.1 and XC-X3.2: the Content-Security-Policy is enforced and reports to /api/csp-report, which keeps only the
// policy fields of a report, strips every URL to origin and path, caps size and rate, and never answers with content.
// Synthetic reports only.
import test from 'node:test';
import assert from 'node:assert/strict';
import {parseCspReports,createRateLimiter,CSP_REPORT_MAX_BYTES} from '../lib/security/csp-report.ts';

const legacy={'csp-report':{'document-uri':'https://www.eurekene.com/dashboard-review/pillar-c?c_org=CH&c_fonte=dpc#c-fonte','violated-directive':'img-src','effective-directive':'img-src',
  'blocked-uri':'https://tracker.example/pixel.gif?session=abc','source-file':'https://www.eurekene.com/_next/static/chunks/x.js?v=1','line-number':12,'column-number':7,disposition:'enforce','status-code':200,'script-sample':'secret'}};
const modern=[{type:'csp-violation',url:'https://www.eurekene.com/x?y=1',body:{documentURL:'https://www.eurekene.com/pillar-a?region=130',effectiveDirective:'script-src-elem',blockedURL:'inline',
  sourceFile:'https://www.eurekene.com/pillar-a',lineNumber:3,columnNumber:1,disposition:'enforce',sample:'alert(document.cookie)'}},{type:'deprecation',body:{id:'x'}}];

test('both report shapes reduce to the policy fields, with no query string, fragment or sample',()=>{
  assert.deepEqual(parseCspReports(JSON.stringify(legacy)),[{document:'https://www.eurekene.com/dashboard-review/pillar-c',directive:'img-src',blocked:'https://tracker.example/pixel.gif',
    source:'https://www.eurekene.com/_next/static/chunks/x.js',line:12,column:7,disposition:'enforce'}]);
  assert.deepEqual(parseCspReports(JSON.stringify(modern)),[{document:'https://www.eurekene.com/pillar-a',directive:'script-src-elem',blocked:'inline',source:'https://www.eurekene.com/pillar-a',line:3,column:1,disposition:'enforce'}],
    'only csp-violation entries; the keyword "inline" passes through');
  const all=JSON.stringify([...parseCspReports(JSON.stringify(legacy)),...parseCspReports(JSON.stringify(modern))]);
  for(const leak of ['c_org','session=abc','v=1','region=130','secret','alert(','#c-fonte'])assert.equal(all.includes(leak),false,leak);
});

test('anything else yields nothing, and a body yields at most twenty violations',()=>{
  for(const text of ['','not json','null','42','"x"','{}','{"csp-report":null}','{"csp-report":[1]}','[1,null,{"type":"csp-violation"}]'])assert.deepEqual(parseCspReports(text),[],text);
  const many=Array.from({length:50},()=>modern[0]);assert.equal(parseCspReports(JSON.stringify(many)).length,20);
  const odd=parseCspReports(JSON.stringify({'csp-report':{'document-uri':42,'effective-directive':'img-src<script>','line-number':'7','blocked-uri':'x'.repeat(5000)}}))[0];
  assert.deepEqual([odd.document,odd.directive,odd.line,odd.blocked.length],['','img-srcscript',null,200]);
});

test('the rate limiter admits the limit per window, then drops until the next window',()=>{
  const allow=createRateLimiter(3,60000);
  assert.deepEqual([0,1,2,3,59999].map(t=>allow(t)),[true,true,true,false,false]);
  assert.deepEqual([60000,60001,60002,60003].map(t=>allow(t)),[true,true,true,false]);
});

const {POST}=await import('../app/api/csp-report/route.ts');
const post=(body,type='application/csp-report',headers={})=>POST(new Request('https://www.eurekene.com/api/csp-report',{method:'POST',body,headers:{'content-type':type,...headers}}));
const logged=async fn=>{const lines=[],warn=console.warn;console.warn=(...a)=>lines.push(a.join(' '));try{await fn();}finally{console.warn=warn;}return lines;};

test('the route logs one stripped line per violation and always answers 204 with no body',async()=>{
  let response;const lines=await logged(async()=>{response=await post(JSON.stringify(legacy));});
  assert.equal(response.status,204);assert.equal(await response.text(),'');assert.equal(response.headers.get('cache-control'),'no-store');
  assert.equal(lines.length,1);assert.match(lines[0],/^csp-violation \{"document":"https:\/\/www\.eurekene\.com\/dashboard-review\/pillar-c","directive":"img-src"/);
  assert.equal(lines[0].includes('c_org'),false);
  assert.equal((await logged(()=>post(JSON.stringify(modern),'application/reports+json'))).length,1);
});

test('the route ignores other content types and oversized bodies without reading them into the log',async()=>{
  for(const [body,type,headers] of [[JSON.stringify(legacy),'text/plain',{}],[JSON.stringify(legacy),'application/x-www-form-urlencoded',{}],
    [JSON.stringify({'csp-report':{'document-uri':'x'.repeat(CSP_REPORT_MAX_BYTES)}}),'application/csp-report',{}],
    [JSON.stringify(legacy),'application/csp-report',{'content-length':String(CSP_REPORT_MAX_BYTES+1)}]]){
    let status;const lines=await logged(async()=>{status=(await post(body,type,headers)).status;});
    assert.equal(status,204);assert.deepEqual(lines,[],`${type} ${body.length}`);
  }
});

test('next.config enforces the policy, without eval, and reports violations',async()=>{
  const {default:config}=await import('../next.config.ts');
  const [{source,headers}]=await config.headers();
  assert.equal(source,'/:path*');
  const byKey=Object.fromEntries(headers.map(h=>[h.key,h.value]));
  assert.equal(byKey['Content-Security-Policy-Report-Only'],undefined,'no longer report-only');
  const csp=byKey['Content-Security-Policy'];assert.ok(csp,'the policy is enforced');
  const directives=Object.fromEntries(csp.split(';').map(d=>d.trim().split(/\s+/)).map(([k,...v])=>[k,v]));
  assert.deepEqual(directives['default-src'],["'self'"]);
  assert.deepEqual(directives['script-src'],["'self'","'unsafe-inline'"],'no other script origin and no eval in production');
  assert.deepEqual(directives['object-src'],["'none'"]);assert.deepEqual(directives['frame-ancestors'],["'none'"]);
  assert.deepEqual(directives['base-uri'],["'self'"]);assert.deepEqual(directives['form-action'],["'self'"]);
  assert.deepEqual(directives['img-src'],["'self'",'data:','blob:']);
  assert.equal(directives['connect-src'][0],"'self'");
  const supabase=process.env.NEXT_PUBLIC_SUPABASE_URL;
  assert.deepEqual(directives['connect-src'],supabase?["'self'",supabase,supabase.replace(/^http/,'ws')]:["'self'"],'only this site and Supabase, by exact origin');
  for(const origin of directives['connect-src'].slice(1))assert.match(origin,/^(https?|wss?):\/\/[^/*\s]+$/,origin);
  assert.deepEqual(directives['report-uri'],['/api/csp-report']);
  for(const key of ['Strict-Transport-Security','X-Content-Type-Options','X-Frame-Options','Referrer-Policy','Cross-Origin-Opener-Policy','Permissions-Policy'])assert.ok(byKey[key],key);
});
