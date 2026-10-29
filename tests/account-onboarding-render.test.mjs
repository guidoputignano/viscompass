import test from 'node:test';
import assert from 'node:assert/strict';
import {register,createRequire} from 'node:module';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {readFileSync} from 'node:fs';

const root=fileURLToPath(new URL('..',import.meta.url));
register('data:text/javascript,'+encodeURIComponent(`
import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {createRequire} from 'node:module';
let sucrase;export function initialize({pkg}){sucrase=createRequire(pkg)('sucrase');}
const nav='data:text/javascript,'+encodeURIComponent('export function useRouter(){return {push(){},refresh(){},replace(){}}}');
const actions='data:text/javascript,'+encodeURIComponent('export async function registerUser(){throw Error("unexpected write")}export async function requestOrganizationAccess(){throw Error("unexpected write")}export async function respondToOrganizationInvitation(){throw Error("unexpected write")}export async function signOut(){throw Error("unexpected sign-out")}');
export async function resolve(s,c,n){if(s==='next/navigation')return {url:nav,shortCircuit:true};if(s==='@/app/auth/sign-up/actions'||s==='@/app/access/actions'||s==='@/app/auth/actions')return {url:actions,shortCircuit:true};return n(s==='next/link'?s+'.js':s,c);}
export async function load(u,c,n){if(u.startsWith('file:')&&u.endsWith('.tsx')){const f=fileURLToPath(u);return {format:'module',source:sucrase.transform(readFileSync(f,'utf8'),{transforms:['typescript','jsx'],jsxRuntime:'automatic',production:true,filePath:f}).code,shortCircuit:true};}return n(u,c);}
`),{data:{pkg:pathToFileURL(`${root}package.json`).href}});
const req=createRequire(`${root}package.json`),React=req('react'),{renderToStaticMarkup}=req('react-dom/server');
const {SignUpForm}=await import('../components/sign-up-form.tsx');
const {AccessPortal}=await import('../components/access/access-portal.tsx');
const overview={userId:'test-user',email:'test@example.invalid',organizations:[{org_code:'T-R',org_name:'Regione di prova',org_type:'regione',region_code:'T1'},{org_code:'T-A',org_name:'Azienda di prova',org_type:'asl',region_code:'T1'}],memberships:[],invitations:[],setupRequired:false};
const render=props=>renderToStaticMarkup(React.createElement(AccessPortal,{overview:{...overview,...props}}));

test('registration renders both required account choices without preselecting a role or organization',()=>{
  const html=renderToStaticMarkup(React.createElement(SignUpForm));
  assert.match(html,/Tipo di account richiesto/);assert.match(html,/Regione/);assert.match(html,/Azienda sanitaria/);
  const radios=html.match(/<input[^>]*type="radio"[^>]*>/g);
  assert.equal(radios.length,2);for(const radio of radios){assert.match(radio,/required/);assert.doesNotMatch(radio,/checked/);}
  assert.doesNotMatch(html,/Regione di prova|Azienda di prova/,'organization is chosen after identity confirmation');
});

test('access portal starts without a selected organization; valid preference selects only the account form',()=>{
  const html=render({}),invalid=render({requestedAccountType:'reviewer'});
  for(const h of [html,invalid]){
    assert.match(h,/Scegli prima il tipo di account/);
    assert.match(h,/<select[^>]*id="access-organization"[^>]*disabled/);
    assert.doesNotMatch(h,/<option[^>]*value="T-[AR]"/);
  }
  const regional=render({requestedAccountType:'regione'});
  assert.match(regional,/Amministrazione regionale/);assert.match(regional,/<option value="T-R">Regione di prova/);
  assert.doesNotMatch(regional,/<option value="T-A"|id="access-region"/);
  assert.doesNotMatch(regional,/<option[^>]*value="T-R"[^>]*selected/);
});

test('organizational account requires a region first, pending users keep public links, empty directory remains explicit',()=>{
  const organizational=render({requestedAccountType:'organization'});
  assert.match(organizational,/id="access-region"/);assert.match(organizational,/Scegli prima la regione/);
  assert.match(organizational,/href="\/pillar-a"/);assert.match(organizational,/href="\/pillar-b"/);
  assert.match(organizational,/amministratore verifica la richiesta prima di abilitare i dati riservati/);
  const empty=render({requestedAccountType:'regione',organizations:[]});
  assert.match(empty,/Nessuna organizzazione configurata in questo ambito/);
  assert.match(empty,/chiedi all’amministratore di aggiungerla/);
});

test('changing account type or region clears the organization and submission is checked against the filtered directory',()=>{
  const source=readFileSync(new URL('../components/access/access-portal.tsx',import.meta.url),'utf8');
  assert.match(source,/setAccountType\(option\.value\); setRegionCode\(""\); setOrgCode\(""\)/);
  assert.match(source,/setRegionCode\(event\.target\.value\); setOrgCode\(""\)/);
  assert.match(source,/const selectedOrganization = organizations\.find/);
  assert.match(source,/if \(!accountType \|\| !selectedOrganization\)/);
  assert.doesNotMatch(source,/overview\.organizations\[0\]/);
});
