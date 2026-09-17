import assert from 'node:assert/strict';
import test from 'node:test';
import {
  decideOpenLibraryAuthorIdentity,
  type StoredOpenLibraryAuthor,
} from './open-library-author-identity.ts';

const author = (
  openLibraryId: string | null,
): StoredOpenLibraryAuthor => ({
  id: '391',
  name: 'Richard Osman',
  openLibraryId,
});

test('a missing stored Open Library author key may be enriched', () => {
  const decision = decideOpenLibraryAuthorIdentity({
    incomingOpenLibraryId: 'OL7973935A',
    existingByIncomingId: null,
    existingByName: author(null),
  });

  assert.equal(decision.action, 'enrich');
  assert.equal(decision.author?.id, '391');
  assert.equal(decision.conflict, null);
});

test('the same stored Open Library author key is an idempotent no-op', () => {
  const existing = author('OL7973935A');
  const decision = decideOpenLibraryAuthorIdentity({
    incomingOpenLibraryId: '/authors/OL7973935A',
    existingByIncomingId: existing,
    existingByName: existing,
  });

  assert.equal(decision.action, 'reuse');
  assert.equal(decision.author, existing);
});

test('a different populated author key is preserved and reported as a conflict', () => {
  const decision = decideOpenLibraryAuthorIdentity({
    incomingOpenLibraryId: 'OL7973935A',
    existingByIncomingId: null,
    existingByName: author('OL13823712A'),
  });

  assert.equal(decision.action, 'preserve_conflict');
  assert.deepEqual(decision.conflict, {
    storedOpenLibraryId: 'OL13823712A',
    incomingOpenLibraryId: 'OL7973935A',
  });
  assert.equal(decision.author?.openLibraryId, 'OL13823712A');
});

test('an existing identity or name match is reused instead of creating a duplicate author', () => {
  const byIdentity = author('OL7973935A');
  assert.equal(decideOpenLibraryAuthorIdentity({
    incomingOpenLibraryId: 'OL7973935A',
    existingByIncomingId: byIdentity,
    existingByName: null,
  }).action, 'reuse');

  assert.notEqual(decideOpenLibraryAuthorIdentity({
    incomingOpenLibraryId: 'OL7973935A',
    existingByIncomingId: null,
    existingByName: author(null),
  }).action, 'create');
});
