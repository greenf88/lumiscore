import assert from 'node:assert/strict';
import test from 'node:test';
import { attemptSignIn, classifySignInError, SIGN_IN_ERROR_MESSAGES } from './sign-in.ts';
import { translate } from '../i18n/translations.ts';

test('temporary login failures never accuse the reader of a wrong password', () => {
  for (const error of [{status:429}, {code:'over_request_rate_limit'}])
    assert.equal(classifySignInError(error), 'sign_in_rate_limited');
  for (const error of [{status:0}, {status:500}, {status:503}, {code:'unexpected_failure'}])
    assert.equal(classifySignInError(error), 'sign_in_unavailable');
  assert.equal(classifySignInError({code:'email_not_confirmed'}), 'email_not_confirmed');
  for (const code of ['invalid_credentials','user_not_found','private provider response'])
    assert.equal(classifySignInError({code,status:400}), 'invalid_credentials');
});

test('one login call; successful session preserved, failures discard ambiguous sessions, no retry', async () => {
  let calls=0;
  const session={access_token:'synthetic-session-not-a-real-token'};
  assert.deepEqual(await attemptSignIn(async()=>{calls++;return {data:{session},error:null}}),{session,error:null});
  assert.deepEqual(await attemptSignIn(async()=>{calls++;return {data:{session},error:{status:429}}}),{session:null,error:'sign_in_rate_limited'});
  assert.deepEqual(await attemptSignIn(async()=>{calls++;throw Error('private-provider-detail')}),{session:null,error:'sign_in_unavailable'});
  assert.deepEqual(await attemptSignIn(async()=>{calls++;return {data:{session:null},error:null}}),{session:null,error:'sign_in_unavailable'});
  assert.equal(calls,4);
});

test('login notices are translated, generic and do not falsely deny earlier mail delivery', () => {
  for(const locale of ['en','nl'] as const){
    for(const key of Object.values(SIGN_IN_ERROR_MESSAGES)) assert.ok(translate(locale,key).length>20);
    assert.doesNotMatch(translate(locale,'auth.signupRateLimited'),/has not been sent|geen bevestigingsmail verstuurd/i);
    assert.match(translate(locale,'auth.signupRateLimited'),/earlier|eerdere/);
    assert.match(translate(locale,'auth.signupUnavailable'),/earlier|eerdere/);
  }
});
