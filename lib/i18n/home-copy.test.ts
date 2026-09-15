import assert from 'node:assert/strict';
import test from 'node:test';
import { translate } from './translations.ts';

test('Dutch homepage hero is concise while English copy stays unchanged', () => {
  assert.equal(
    `${translate('nl', 'home.heroStart')} ${translate('nl', 'home.heroEmphasis')}`,
    'Vind je volgende boek',
  );
  assert.equal(
    `${translate('en', 'home.heroStart')} ${translate('en', 'home.heroEmphasis')}`,
    'Find your next great read',
  );
});
