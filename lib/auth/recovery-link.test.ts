import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {isRecoveryDestination,isRecoveryState,isRecoveryTokenHash,readRecoveryLink,recoveryLocale,recoveryLanguageHref} from './recovery-link.ts';
import {updateWithRecoveryToken} from './recovery-token-update.ts';

const state='0d85fa53-3ca0-48b2-91ab-3f105570aa31';
const code='1397bf74-9fba-465d-aece-a7a0c669f3aa';
const token='a'.repeat(64);
const location=(search='',hash='',pathname='/nl/update-password')=>({pathname,search,hash});

test('fresh-browser token proof is accepted only as one bounded recovery fragment',()=>{
  for(const pathname of ['/nl/update-password','/en/update-password','/update-password']){
    assert.deepEqual(readRecoveryLink(location('',`#token_hash=${token}&type=recovery`,pathname)),{kind:'token',tokenHash:token});
  }
  for(const hash of ['',`#token_hash=${token}&type=signup`,`#token_hash=${token}&type=magiclink`,
    `#token_hash=${token}&type=recovery&type=recovery`,`#token_hash=${token}&token_hash=${token}&type=recovery`,
    '#error=access_denied&error_code=otp_expired',`#token_hash=${token}&type=recovery&next=https://evil.invalid`,
    '#access_token=not-accepted&refresh_token=not-accepted&type=recovery','#token_hash=short&type=recovery']){
    assert.equal(readRecoveryLink(location('',hash)).kind,'invalid');
  }
  assert.equal(readRecoveryLink(location('?code='+code,`#token_hash=${token}&type=recovery`)).kind,'invalid');
  assert.equal(readRecoveryLink(location('?token_hash='+token+'&type=recovery')).kind,'invalid');
  assert.equal(readRecoveryLink(location('',`#token_hash=${token}&type=recovery`,'/login')).kind,'invalid');
  assert.equal(isRecoveryTokenHash('x'.repeat(257)),false);
  assert.equal(isRecoveryTokenHash('x'.repeat(31)),false);
  assert.equal(isRecoveryTokenHash('a'.repeat(40)+'\n'),false);
});

test('legacy ConfirmationURL code uses the existing callback, fixed recovery flow and safe NL/EN destination',()=>{
  for(const locale of ['nl','en']){
    const parsed=readRecoveryLink(location(`?code=${code}&recovery_state=${state}&next=https://evil.invalid`,'',`/${locale}/update-password`));
    assert.equal(parsed.kind,'pkce');if(parsed.kind!=='pkce')throw Error();
    const callback=new URL(parsed.callbackPath,'https://preview.example');
    assert.equal(callback.pathname,'/auth/callback');assert.equal(callback.origin,'https://preview.example');
    assert.equal(callback.searchParams.get('flow'),'recovery');assert.equal(callback.searchParams.get('next'),`/${locale}/update-password`);
    assert.equal(callback.searchParams.get('code'),code);assert.equal(callback.searchParams.get('recovery_state'),state);
  }
  for(const search of [`?code=${code}`,`?code=${code}&code=${code}&recovery_state=${state}`,
    `?code=${code}&recovery_state=not-a-state`,`?code=${code}&recovery_state=${state}&error=otp_expired`]){
    assert.equal(readRecoveryLink(location(search)).kind,'invalid');
  }
  for(const path of ['//evil.invalid/update-password','/nl/update-password?next=bad','/nl/login','/nl/update-password/'])assert.equal(isRecoveryDestination(path),false);
  assert.equal(readRecoveryLink(location(`?code=${code}&recovery_state=${state}`, '#access_token=not-accepted')).kind,'invalid');
  assert.equal(isRecoveryState('-'.repeat(36)),false);assert.equal(recoveryLocale('fr'),'en');
});

test('language switching retains fresh proof only in a fixed local fragment, never a query or external URL',()=>{
  for(const locale of ['en','nl'] as const){
    const url=new URL(recoveryLanguageHref(locale,token),'https://preview.example');
    assert.equal(url.origin,'https://preview.example');assert.equal(url.pathname,`/${locale}/update-password`);
    assert.equal(url.search,'');assert.deepEqual(readRecoveryLink(url),{kind:'token',tokenHash:token});
    assert.equal(recoveryLanguageHref(locale,'bad'),`/${locale}/update-password`);
  }
});

function fakeAuth(options:{verifyError?:boolean;throwVerify?:boolean;userMismatch?:boolean;lookupError?:boolean;updateError?:boolean}={}){
  const calls:string[]=[];let consumed=false;
  return {calls,auth:{
    async verifyOtp(input:{token_hash:string;type:'recovery'}){calls.push('verify');assert.equal(input.type,'recovery');assert.equal(input.token_hash,token);if(options.throwVerify)throw Error('private-provider-message');const error=options.verifyError||consumed;consumed=true;return{error,data:{user:error?null:{id:'recovery-account'},session:error?null:{user:{id:'recovery-account'}}}};},
    async getUser(){calls.push('getUser');return{error:!!options.lookupError,data:{user:{id:options.userMismatch?'different-account':'recovery-account'}}};},
    async updateUser(input:{password:string}){calls.push('update');assert.equal(input.password,'synthetic-new-password');return{error:!!options.updateError};},
    async signOut(input:{scope:'local'}){calls.push('signOut');assert.equal(input.scope,'local');},
  }};
}
test('fresh recovery proof is verified before any password change, then signs out for a new login',async()=>{
  const f=fakeAuth();assert.equal(await updateWithRecoveryToken(f.auth,token,'synthetic-new-password'),'updated');
  assert.deepEqual(f.calls,['verify','getUser','update','signOut']);
  assert.equal(await updateWithRecoveryToken(f.auth,token,'synthetic-new-password'),'invalid_link');
  assert.equal(f.calls.filter(v=>v==='update').length,1,'used token must not update again');
});
test('expired, wrong-account, absent, malformed and unavailable recovery proofs never update an existing session',async()=>{
  for(const options of [{verifyError:true},{throwVerify:true},{userMismatch:true},{lookupError:true}]){
    const f=fakeAuth(options);assert.equal(await updateWithRecoveryToken(f.auth,token,'synthetic-new-password'),'invalid_link');
    assert.equal(f.calls.includes('update'),false);
  }
  const f=fakeAuth();assert.equal(await updateWithRecoveryToken(f.auth,'bad','synthetic-new-password'),'invalid_link');assert.deepEqual(f.calls,[]);
  const failed=fakeAuth({updateError:true});assert.equal(await updateWithRecoveryToken(failed.auth,token,'synthetic-new-password'),'update_failed');assert.equal(failed.calls.at(-1),'signOut');
});
test('landing processes email proof before redirect; mutation preserves CSRF, legacy AMR, privacy and locale',async()=>{
  const read=(path:string)=>readFile(new URL('../../'+path,import.meta.url),'utf8');
  const [component,page,update,callback]=await Promise.all(['app/components/LumiScorePasswordRecovery.tsx','app/update-password/page.tsx','app/auth/update-password/route.ts','app/auth/callback/route.ts'].map(read));
  assert.match(component,/readRecoveryLink\(window.location\)/);assert.match(component,/history.replaceState\(null, '', window.location.pathname\)/);
  assert.match(component,/processedLink.current/);assert.match(component,/!hasIncomingProof && hasRecoverySession/);
  assert.match(component,/addEventListener\('hashchange', processLink\)/);
  assert.match(component,/removeEventListener\('hashchange', processLink\)/);
  assert.match(component,/form.reportValidity\(\)/);assert.match(component,/confirmation.setCustomValidity/);
  assert.doesNotMatch(page,/redirect\(/);assert.match(page,/needsRecoveryLink/);assert.match(page,/no-referrer/);
  assert.match(update,/isSameOriginRequest\(request\)/);assert.match(update,/hasRecentRecoveryAuthentication/);
  assert.ok(update.indexOf('validatePasswordUpdate(formData')<update.indexOf('updateWithRecoveryToken(supabase.auth'));
  assert.match(callback,/recoveryStatesMatch\(pendingState, suppliedState\)/);assert.match(callback,/isRecoveryDestination\(next\)/);
  for(const source of [update,callback]){assert.match(source,/PRIVATE_RESPONSE_HEADERS/);assert.doesNotMatch(source,/absoluteLumiScoreUrl/);}
  for(const source of [component,update,callback])assert.doesNotMatch(source,/console\.(?:log|error|info|warn)/);
  assert.doesNotMatch(component,/(?:localStorage|sessionStorage)\.setItem\([^\n]*(?:token|proof|code)/i);
});
