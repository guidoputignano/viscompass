// XC-X3.3: the Supabase session cookies are HttpOnly, so no script on a page can read the session. Covers the
// option rule both server paths share (lib/supabase/cookie-options.ts) and source guards that keep the browser away
// from the session: no cookie-backed browser client, every auth step a server action, uploads by ticket.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync,statSync} from 'node:fs';
import {join,relative} from 'node:path';
import {fileURLToPath} from 'node:url';
import {hardenedCookieOptions,SESSION_MAX_AGE_SECONDS} from '../lib/supabase/cookie-options.ts';

const root=fileURLToPath(new URL('..',import.meta.url));
const read=p=>readFileSync(join(root,p),'utf8');

test('every auth cookie is HttpOnly, whatever @supabase/ssr asks for',()=>{
  // @supabase/ssr passes httpOnly:false explicitly; the old `?? true` never applied.
  for(const asked of [undefined,{},{httpOnly:false},{httpOnly:true},{httpOnly:false,path:'/',sameSite:'lax',maxAge:34560000}])
    assert.equal(hardenedCookieOptions(asked,true).httpOnly,true,JSON.stringify(asked));
});

test('Secure follows production; SameSite defaults to Lax; the lifetime is capped at seven days',()=>{
  assert.equal(hardenedCookieOptions({},true).secure,true);
  assert.equal(hardenedCookieOptions({secure:true},false).secure,false,'localhost has no TLS to require');
  assert.equal(hardenedCookieOptions({},true).sameSite,'lax');
  assert.equal(hardenedCookieOptions({sameSite:'strict'},true).sameSite,'strict');
  assert.equal(SESSION_MAX_AGE_SECONDS,604800);
  assert.equal(hardenedCookieOptions({maxAge:400*86400},true).maxAge,SESSION_MAX_AGE_SECONDS);
  assert.equal(hardenedCookieOptions({},true).maxAge,SESSION_MAX_AGE_SECONDS);
  assert.equal(hardenedCookieOptions({maxAge:3600},true).maxAge,3600);
  assert.equal(hardenedCookieOptions({maxAge:0},true).maxAge,0,'a deletion stays a deletion');
  assert.deepEqual({path:hardenedCookieOptions({path:'/',domain:'example.org'},true).path,domain:hardenedCookieOptions({path:'/',domain:'example.org'},true).domain},{path:'/',domain:'example.org'});
});

test('both server paths write cookies through the hardened options',()=>{
  for(const file of ['lib/supabase/proxy.ts','lib/supabase/server.ts']){
    const src=read(file);
    assert.match(src,/hardenedCookieOptions\(options, process\.env\.NODE_ENV === "production"\)/,file);
    assert.doesNotMatch(src,/httpOnly: options\?\.httpOnly/,`${file}: the ineffective fallback is gone`);
  }
});

const sources=dir=>readdirSync(join(root,dir)).flatMap(name=>{
  const path=join(root,dir,name);
  if(statSync(path).isDirectory())return sources(relative(root,path));
  return /\.(ts|tsx)$/.test(name)?[relative(root,path).split('\\').join('/')]:[];
});
const APP=[...sources('app'),...sources('components'),...sources('lib')];

test('no code creates a cookie-backed browser client, and no client component imports the server client',()=>{
  assert.ok(APP.length>100,'the scan is not vacuous');
  for(const file of APP){
    const src=read(file);
    // The tutorial page prints a code sample as a string; it is not executed.
    if(file==='components/tutorial/fetch-data-steps.tsx')continue;
    assert.doesNotMatch(src,/createBrowserClient|@\/lib\/supabase\/client/,file);
    if(/^\s*["']use client["']/.test(src))assert.doesNotMatch(src,/@\/lib\/supabase\/server/,file);
  }
});

test('sign-in, sign-out, password change and reset are server actions; the forms only call them',()=>{
  const actions=read('app/auth/actions.ts');
  assert.match(actions,/^"use server";/);
  for(const name of ['signInWithPassword','signOut','updatePassword','requestPasswordReset'])assert.match(actions,new RegExp(`export async function ${name}\\(`),name);
  for(const [file,name] of [['components/login-form.tsx','signInWithPassword'],['components/logout-button.tsx','signOut'],['components/update-password-form.tsx','updatePassword'],['components/forgot-password-form.tsx','requestPasswordReset']]){
    const src=read(file);
    assert.match(src,new RegExp(`import \\{ ${name} \\} from "@/app/auth/actions"`),file);
    assert.doesNotMatch(src,/supabase\.auth\./,`${file} calls no auth API in the browser`);
  }
});

test('the upload shell uploads by ticket, with no session in the browser',()=>{
  const shell=read('components/dashboard-review/upload-shell.tsx');
  assert.match(shell,/issueUploadTicket\(\{ fileName: file\.name \}\)/);
  assert.match(shell,/\.uploadToSignedUrl\(storagePath, token, file\)/);
  assert.match(shell,/persistSession: false, autoRefreshToken: false, detectSessionInUrl: false/);
  assert.doesNotMatch(shell,/\.upload\(/,'no session upload left');
});
