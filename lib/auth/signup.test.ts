import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  isValidNewAccountPassword,
  NEW_ACCOUNT_PASSWORD_MIN_LENGTH,
} from './credentials.ts';
import {
  getReadingPreferencesOnboardingPath,
  getSafeNextPath,
} from './request.ts';

test('new-account password validation is centralized and does not block sign in', async () => {
  assert.equal(NEW_ACCOUNT_PASSWORD_MIN_LENGTH, 8);
  assert.equal(isValidNewAccountPassword('1234567'), false);
  assert.equal(isValidNewAccountPassword('12345678'), true);

  const login = await readFile(
    new URL('../../app/components/LumiScoreLogin.tsx', import.meta.url),
    'utf8',
  );
  assert.match(login, /minLength=\{mode === 'sign-up' \? NEW_ACCOUNT_PASSWORD_MIN_LENGTH : undefined\}/);
});

test('signup sends the normalized display name through Supabase Auth metadata', async () => {
  const route = await readFile(
    new URL('../../app/auth/sign-up/route.ts', import.meta.url),
    'utf8',
  );
  assert.match(route, /normalizeDisplayName\(formData\.get\('displayName'\)\)/);
  assert.match(route, /data: \{ display_name: displayName\.value \}/);
  assert.match(route, /isValidNewAccountPassword\(password\)/);
  assert.doesNotMatch(route, /service_role|SUPABASE_SECRET_KEY/);
  assert.match(route, /getReadingPreferencesOnboardingPath\(next\)/);
  assert.match(route, /callback\.searchParams\.set\('next', onboardingNext\)/);
});

test('confirmed-email callback preserves safe reading-preferences onboarding without an open redirect', async () => {
  const destination = getReadingPreferencesOnboardingPath('/browse?sort=rating&page=2');
  assert.equal(destination, '/reading-preferences?next=%2Fbrowse%3Fsort%3Drating%26page%3D2');
  assert.equal(getSafeNextPath(destination), destination);
  assert.equal(getSafeNextPath('https://attacker.example/reading-preferences'), '/');
  assert.equal(getSafeNextPath('//attacker.example/reading-preferences'), '/');
  assert.equal(getSafeNextPath('/\\attacker.example'), '/');

  const callback = await readFile(
    new URL('../../app/auth/callback/route.ts', import.meta.url),
    'utf8',
  );
  assert.match(callback, /const next = getSafeNextPath\(/);
  assert.match(callback, /exchangeCodeForSession\(code\)/);
  assert.match(callback, /if \(!error\) \{\s*return privateRedirect\(next\);/);
  assert.match(callback, /login\?error=confirmation_failed&next=/);
  assert.match(callback, /PRIVATE_RESPONSE_HEADERS/);
});

test('saving or skipping reading preferences returns to the validated authenticated destination', async () => {
  const component = await readFile(
    new URL('../../app/components/LumiScoreReadingPreferences.tsx', import.meta.url),
    'utf8',
  );
  assert.equal(component.match(/window\.location\.assign\(next\)/g)?.length, 2);
  assert.match(component, /request\('PUT', \{ readingPeriods \}\)\.then\(\(saved\)/);
  assert.match(component, /body: JSON\.stringify\(\{ dismiss: true \}\)/);
});
