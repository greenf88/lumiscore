import assert from 'node:assert/strict';
import test from 'node:test';
import { translate } from '../i18n/translations.ts';

test('collection and reading-status copy is naturally localized in English and Dutch', () => {
  assert.equal(translate('en', 'collection.bookOf', { position: 4, total: 7 }), 'Book 4 of 7');
  assert.equal(translate('nl', 'collection.bookOf', { position: 4, total: 7 }), 'Deel 4 van 7');
  assert.equal(translate('en', 'collection.bookPosition', { position: 4 }), 'Book 4');
  assert.equal(translate('nl', 'collection.bookPosition', { position: 4 }), 'Deel 4');
  assert.equal(translate('en', 'collection.readProgress', { read: 3, total: 7 }), '3 of 7 read');
  assert.equal(translate('nl', 'collection.readProgress', { read: 3, total: 7 }), '3 van 7 gelezen');
  assert.equal(translate('en', 'collection.readCount', { read: 3 }), '3 read');
  assert.equal(translate('nl', 'collection.readCount', { read: 3 }), '3 gelezen');
  assert.equal(translate('nl', 'collection.wantToRead'), 'Wil ik lezen');
  assert.equal(translate('nl', 'collection.reading'), 'Aan het lezen');
  assert.equal(translate('nl', 'collection.read'), 'Gelezen');
  assert.equal(translate('nl', 'collection.dnf'), 'Gestopt');
  assert.equal(translate('en', 'collection.continueHeading'), 'Continue your series');
  assert.equal(translate('nl', 'collection.continueHeading'), 'Ga verder met je reeks');
  assert.equal(translate('en', 'collection.continueReading'), 'Continue reading');
  assert.equal(translate('nl', 'collection.highestUnread'), 'Hoogst beoordeeld dat je nog niet hebt gelezen');
  assert.equal(translate('en', 'collection.nextUnread'), "A book you haven't read yet");
});
