import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  normalizeReadingPeriods,
  toggleReadingPeriod,
} from './reading-periods.ts';
import { translate } from '../i18n/translations.ts';

test('all-periods and no-preference remain exclusive', () => {
  assert.deepEqual(toggleReadingPeriod(['before_1950'], 'all_periods'), ['all_periods']);
  assert.deepEqual(toggleReadingPeriod(['no_preference'], '2015_present'), ['2015_present']);
  assert.equal(normalizeReadingPeriods(['all_periods', '2015_present']), null);
});

test('preference validation rejects unknown and duplicate input without guessing', () => {
  assert.equal(normalizeReadingPeriods(['future']), null);
  assert.deepEqual(normalizeReadingPeriods(['2015_present', '2015_present']), ['2015_present']);
});

test('migration stores broad periods only and enforces private owner RLS', async () => {
  const migration = await readFile(
    new URL('../../supabase/migrations/20260920120000_add_user_reading_preferences.sql', import.meta.url),
    'utf8',
  );
  assert.match(migration, /user_id uuid primary key references auth\.users/);
  assert.match(migration, /enable row level security/);
  assert.match(migration, /force row level security/);
  assert.match(migration, /revoke all .* public, anon, authenticated/);
  assert.match(migration, /grant select, insert, update, delete .* authenticated/);
  assert.match(migration, /\(select auth\.uid\(\)\) = user_id/g);
  assert.match(migration, /for select to authenticated/);
  assert.match(migration, /for insert to authenticated/);
  assert.match(migration, /for update to authenticated[\s\S]*with check/);
  assert.match(migration, /for delete to authenticated/);
  assert.doesNotMatch(migration, /birth|date_of_birth|birth_date|email|service_role|security definer/i);
});

test('API derives user identity server-side and keeps responses private', async () => {
  const route = await readFile(
    new URL('../../app/api/account/reading-preferences/route.ts', import.meta.url),
    'utf8',
  );
  assert.match(route, /getVerifiedServerUser/);
  assert.match(route, /PRIVATE_RESPONSE_HEADERS/);
  assert.match(route, /isSameOriginRequest/);
  assert.doesNotMatch(route, /birth|body\?\.userId|body\?\.user_id|SUPABASE_SECRET_KEY|service_role/);
});

test('onboarding uses exact bilingual copy and accessible native controls', async () => {
  assert.equal(translate('nl', 'preferences.heading'), 'Maak je aanbevelingen persoonlijker');
  assert.equal(translate('en', 'preferences.heading'), 'Make your recommendations more personal');
  assert.equal(translate('nl', 'preferences.skip'), 'Nu niet');
  assert.equal(translate('en', 'preferences.skip'), 'Not now');
  const component = await readFile(
    new URL('../../app/components/LumiScoreReadingPreferences.tsx', import.meta.url),
    'utf8',
  );
  assert.match(component, /<fieldset className="preference-fieldset">/);
  assert.match(component, /type="checkbox"/);
  assert.doesNotMatch(component, /birth|type="radio"|2010 or later|2010 of later|user-scalable|userId|user_id/i);
  assert.equal(component.match(/window\.location\.assign\(next\)/g)?.length, 2);
});

test('preference controls retain 44px touch targets and collapse at mobile width', async () => {
  const css = await readFile(new URL('../../app/globals.css', import.meta.url), 'utf8');
  assert.match(css, /\.preference-option \{[^}]*min-height: 48px/);
  assert.match(css, /@media \(max-width: 560px\)[\s\S]*\.preference-options, \.preference-actions \{ grid-template-columns: 1fr; \}/);
});
