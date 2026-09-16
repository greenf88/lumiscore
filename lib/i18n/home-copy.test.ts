import assert from 'node:assert/strict';
import test from 'node:test';
import { translate } from './translations.ts';

test('homepage hero headings stay concise in Dutch and English', () => {
  assert.equal(
    `${translate('nl', 'home.heroStart')} ${translate('nl', 'home.heroEmphasis')}`,
    'Vind je volgende boek',
  );
  assert.equal(
    `${translate('en', 'home.heroStart')} ${translate('en', 'home.heroEmphasis')}`,
    'Find your next great read',
  );
});

test('homepage copy makes only supportable V1 claims', () => {
  assert.equal(
    translate('en', 'home.ratingsDistilled'),
    'Real ratings, clearly shown',
  );
  assert.equal(
    translate('nl', 'home.ratingsDistilled'),
    'Echte beoordelingen, helder weergegeven',
  );
  assert.doesNotMatch(translate('en', 'home.heroCopy'), /millions/i);
  assert.doesNotMatch(translate('nl', 'home.heroCopy'), /miljoen/i);
});
