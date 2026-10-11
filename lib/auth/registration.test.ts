import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { attemptSignup, classifySignupError, isSignupError, registrationCallbackDestination,
  SIGNUP_ERROR_MESSAGES } from './registration.ts';
import { translate } from '../i18n/translations.ts';
import { getReadingPreferencesOnboardingPath } from './request.ts';

test('provider codes become safe, understandable registration categories', () => {
  for (const [code, category] of [
    ['over_email_send_rate_limit', 'signup_rate_limited'],
    ['over_request_rate_limit', 'signup_rate_limited'],
    ['email_address_not_authorized', 'signup_email_unavailable'],
    ['signup_disabled', 'signup_disabled'], ['email_provider_disabled', 'signup_disabled'],
    ['weak_password', 'signup_password_rejected'],
    ['user_already_exists', 'signup_failed'], ['email_exists', 'signup_failed'],
    ['untrusted-provider-message', 'signup_failed'],
  ]) assert.equal(classifySignupError({ code }), category);
  assert.equal(classifySignupError({ status: 429 }), 'signup_rate_limited');
  assert.equal(classifySignupError({ status: 503 }), 'signup_unavailable');
  assert.equal(classifySignupError({ status: 400 }), 'signup_failed');
});

test('one submit only; failure or network ambiguity never becomes a success or automatic retry', async () => {
  let calls = 0;
  const error = await attemptSignup(async () => {
    calls++;
    return { data: { session: {} }, error: { code: 'over_email_send_rate_limit' } };
  });
  assert.deepEqual(error, { error: 'signup_rate_limited', hasSession: false });
  assert.equal(calls, 1);
  const exception = await attemptSignup(async () => { calls++; throw new Error('private provider details'); });
  assert.deepEqual(exception, { error: 'signup_unavailable', hasSession: false });
  assert.equal(calls, 2);
  assert.equal(JSON.stringify(exception).includes('private'), false);
  assert.deepEqual(await attemptSignup(async () => ({ data: { session: null }, error: null })),
    { error: null, hasSession: false });
  assert.deepEqual(await attemptSignup(async () => ({ data: { session: {} }, error: null })),
    { error: null, hasSession: true });
});

test('all registration errors retain signup mode and have NL/EN text, without echoing URL input', () => {
  for (const [code, key] of Object.entries(SIGNUP_ERROR_MESSAGES)) {
    assert.ok(isSignupError(code));
    assert.ok(translate('nl', key).length > 20);
    assert.ok(translate('en', key).length > 20);
    assert.notEqual(translate('nl', key), translate('en', key));
  }
  for (const code of [undefined, 'toString', '__proto__', 'constructor', 'private-provider-message'])
    assert.equal(isSignupError(code), false);
});

test('confirmation stays on the registering environment and retains both locales and return queries', () => {
  for (const origin of ['https://lumisco.re', 'https://review.vercel.app', 'http://localhost:3121']) {
    for (const locale of ['nl', 'en']) {
      const next = getReadingPreferencesOnboardingPath(`/${locale}/browse?sort=highest&page=2`);
      const request = `${origin}/auth/callback?code=never-record-this`;
      assert.equal(registrationCallbackDestination(request, next, true).href, origin + next);
      const failed = registrationCallbackDestination(request, next, false);
      assert.equal(failed.origin, origin);
      assert.equal(failed.pathname, `/${locale}/login`);
      assert.equal(failed.searchParams.get('next'), next);
      assert.equal(failed.searchParams.get('error'), 'confirmation_failed');
      assert.equal(failed.href.includes('never-record-this'), false);
    }
  }
  for (const next of ['https://attacker.example/', '//attacker.example/', '/\\attacker.example/'])
    assert.equal(registrationCallbackDestination('https://review.vercel.app/auth/callback', next, true).href,
      'https://review.vercel.app/');
});

test('route boundaries preserve CSRF protection, PKCE, privacy headers and single-call handling', async () => {
  const route = await readFile(new URL('../../app/auth/sign-up/route.ts', import.meta.url), 'utf8');
  assert.match(route, /isSameOriginRequest\(request\)/);
  assert.match(route, /attemptSignup\(async \(\) =>/);
  assert.equal(route.match(/auth.signUp\(/g)?.length, 1);
  assert.match(route, /if \(result.error\)/);
  assert.match(route, /else if \(!result.hasSession\)/);
  assert.match(route, /PRIVATE_RESPONSE_HEADERS/);
  assert.doesNotMatch(route, /console\.(?:warn|error)\([^\n]*(?:password|email|formData|error\.message)/);
  const callback = await readFile(new URL('../../app/auth/callback/route.ts', import.meta.url), 'utf8');
  assert.match(callback, /exchangeCodeForSession\(code\)/);
  assert.match(callback, /registrationCallbackDestination\(request.url, next, true\)/);
  assert.match(callback, /registrationCallbackDestination\(request.url, next, false\)/);
  const login = await readFile(new URL('../../app/login/page.tsx', import.meta.url), 'utf8');
  assert.match(login, /isSignupError\(errorKey\)/);
  const signIn = await readFile(new URL('../../app/auth/sign-in/route.ts', import.meta.url), 'utf8');
  assert.match(signIn, /error\?\.code === 'email_not_confirmed'/);
});
