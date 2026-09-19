import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  createPasswordRecoveryCallbackUrl,
  hasRecentRecoveryAuthentication,
  PASSWORD_RECOVERY_PATH,
  PASSWORD_RESET_REQUEST_DESTINATION,
  recoveryStatesMatch,
  validatePasswordUpdate,
} from './password-recovery.ts';
import { getSafeNextPath } from './request.ts';

const VALID_STATE = '0d85fa53-3ca0-48b2-91ab-3f105570aa31';

test('recovery callback is fixed to the trusted site origin and update path', () => {
  const callback = new URL(createPasswordRecoveryCallbackUrl(VALID_STATE));
  assert.equal(callback.pathname, '/auth/callback');
  assert.equal(callback.searchParams.get('flow'), 'recovery');
  assert.equal(callback.searchParams.get('next'), PASSWORD_RECOVERY_PATH);
  assert.equal(callback.searchParams.get('recovery_state'), VALID_STATE);
  assert.ok(callback.protocol === 'https:' || callback.protocol === 'http:');
  assert.equal(callback.username, '');
  assert.equal(callback.password, '');
});

test('recovery state must be present, well formed, and browser bound', () => {
  assert.equal(recoveryStatesMatch(VALID_STATE, VALID_STATE), true);
  assert.equal(recoveryStatesMatch(VALID_STATE, null), false);
  assert.equal(recoveryStatesMatch('malformed', 'malformed'), false);
  assert.equal(
    recoveryStatesMatch(VALID_STATE, '1397bf74-9fba-465d-aece-a7a0c669f3aa'),
    false,
  );
});

test('only a recent Supabase recovery authentication method unlocks updates', () => {
  const now = 2_000_000_000;
  assert.equal(hasRecentRecoveryAuthentication({
    amr: [{ method: 'recovery', timestamp: now - 120 }],
  }, now), true);
  assert.equal(hasRecentRecoveryAuthentication({
    amr: [{ method: 'password', timestamp: now - 10 }],
  }, now), false);
  assert.equal(hasRecentRecoveryAuthentication({
    amr: [{ method: 'recovery', timestamp: now - 901 }],
  }, now), false);
  assert.equal(hasRecentRecoveryAuthentication({ amr: [] }, now), false);
});

test('unsafe recovery redirects cannot escape the site', () => {
  assert.equal(getSafeNextPath('https://attacker.example/reset'), '/');
  assert.equal(getSafeNextPath('//attacker.example/reset'), '/');
  assert.equal(getSafeNextPath('/update-password'), '/update-password');
});

test('new password validation requires eight characters and an exact match', () => {
  assert.deepEqual(validatePasswordUpdate('1234567', '1234567'), {
    ok: false,
    error: 'password_too_short',
  });
  assert.deepEqual(validatePasswordUpdate('12345678', 'abcdefgh'), {
    ok: false,
    error: 'password_mismatch',
  });
  assert.deepEqual(validatePasswordUpdate('12345678', '12345678'), {
    ok: true,
    password: '12345678',
  });
});

test('reset requests use one generic response for known and unknown addresses', async () => {
  const route = await readFile(
    new URL('../../app/auth/request-password-reset/route.ts', import.meta.url),
    'utf8',
  );
  assert.equal(PASSWORD_RESET_REQUEST_DESTINATION, '/forgot-password?message=check_email');
  assert.match(route, /resetPasswordForEmail\(email/);
  assert.match(route, /PASSWORD_RESET_REQUEST_DESTINATION/);
  assert.doesNotMatch(route, /error\s*\?[^:]+:/);
  assert.doesNotMatch(route, /request\.url|headers\.get\(['"]host/i);
});

test('recovery writes are CSRF checked, authenticated, and never expose secrets', async () => {
  const requestRoute = await readFile(
    new URL('../../app/auth/request-password-reset/route.ts', import.meta.url),
    'utf8',
  );
  const updateRoute = await readFile(
    new URL('../../app/auth/update-password/route.ts', import.meta.url),
    'utf8',
  );
  const callbackRoute = await readFile(
    new URL('../../app/auth/callback/route.ts', import.meta.url),
    'utf8',
  );
  for (const source of [requestRoute, updateRoute]) {
    assert.match(source, /isSameOriginRequest\(request\)/);
    assert.match(source, /PRIVATE_RESPONSE_HEADERS/);
    assert.doesNotMatch(source, /service_role|SUPABASE_SECRET_KEY|console\.(?:log|info).*password/i);
  }
  assert.match(updateRoute, /supabase\.auth\.getUser\(\)/);
  assert.match(updateRoute, /supabase\.auth\.getClaims\(\)/);
  assert.match(updateRoute, /hasRecentRecoveryAuthentication/);
  assert.match(updateRoute, /updateUser\(\{\s*password: validation\.password/);
  assert.match(updateRoute, /signOut\(\{ scope: 'local' \}\)/);
  assert.match(updateRoute, /login\?message=password_updated/);
  assert.match(callbackRoute, /exchangeCodeForSession\(code\)/);
  assert.match(callbackRoute, /recoveryStatesMatch\(pendingState, suppliedState\)/);
});
