import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('display-name updates use verified auth and preserve existing user metadata', async () => {
  const route = await readFile(
    new URL('../../app/api/account/display-name/route.ts', import.meta.url),
    'utf8',
  );

  assert.match(route, /supabase\.auth\.getUser\(\)/);
  assert.match(route, /supabase\.auth\.updateUser\(\{/);
  assert.match(route, /\.\.\.currentMetadata/);
  assert.match(route, /display_name: displayName\.value/);
  assert.match(route, /isSameOriginRequest\(request\)/);
  assert.doesNotMatch(route, /SUPABASE_SECRET_KEY|service_role/);
});

test('account menu rolls its optimistic display name back on save failure', async () => {
  const component = await readFile(
    new URL('../../app/components/LumiScoreAccountMenu.tsx', import.meta.url),
    'utf8',
  );

  assert.match(component, /const previousName = displayName/);
  assert.match(component, /setDisplayName\(validation\.value\)/);
  assert.match(component, /catch \{[\s\S]*setDisplayName\(previousName\)/);
  assert.match(component, /aria-expanded=\{open\}/);
  assert.match(component, /event\.key !== 'Escape'/);
  assert.match(component, /document\.addEventListener\('pointerdown'/);
});
