import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  isValidNewAccountPassword,
  NEW_ACCOUNT_PASSWORD_MIN_LENGTH,
} from './credentials.ts';

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
});
