import assert from 'node:assert/strict';
import test from 'node:test';
import type { Book } from '../../app/data/books.ts';
import {
  classifyStructuredLanguage,
  isDutchLanguageBook,
  REVIEWED_DUTCH_LANGUAGE_ISBN13,
  resolveBookLanguage,
} from './language.ts';
import {
  selectDutchDiscoveryBooks,
  shouldShowDutchDiscovery,
} from './dutch-discovery.ts';
import { NETHERLANDS_NATIVE_DISPOSITIONS } from '../../scripts/lumiscore-native-seeds-nl.ts';

function book(input: Partial<Book> & Pick<Book, 'workId' | 'title'>): Book {
  return {
    id: `work-${input.workId}`,
    source: 'supabase',
    author: 'Author',
    score: null,
    ratingsCount: 0,
    match: null,
    cover: 'orbit',
    ...input,
  };
}

test('structured Dutch and English edition languages are classified without guessing', () => {
  assert.equal(classifyStructuredLanguage('nld'), 'dutch');
  assert.equal(classifyStructuredLanguage('/languages/nl'), 'dutch');
  assert.equal(classifyStructuredLanguage('eng'), 'non_dutch');
  assert.equal(classifyStructuredLanguage(null), 'unknown');
  assert.equal(classifyStructuredLanguage('made-up-language'), 'unknown');
});

test('reviewed Dutch seed metadata fills only known ISBN gaps', () => {
  const reviewed = resolveBookLanguage({
    editionLanguage: null,
    isbn13: '9789044933192',
  });
  assert.deepEqual(reviewed, {
    classification: 'dutch',
    languageCode: 'nld',
    source: 'reviewed_catalog_seed',
  });
  assert.equal(isDutchLanguageBook({ editionLanguage: null, isbn13: '9780000000000' }), false);
});

test('runtime Dutch ISBN fallback stays aligned with reviewed native seed metadata', () => {
  const seedIsbns = Object.values(NETHERLANDS_NATIVE_DISPOSITIONS)
    .flatMap((entry) => entry.status === 'LUMISCORE_NATIVE_READY' ? [entry.isbn13] : [])
    .toSorted();
  assert.deepEqual([...REVIEWED_DUTCH_LANGUAGE_ISBN13].toSorted(), seedIsbns);
});

test('Dutch discovery is locale-gated, Dutch-only and deterministic', () => {
  const candidates = [
    book({ workId: '3', title: 'Zulu', editionLanguage: 'nld' }),
    book({ workId: '2', title: 'English', editionLanguage: 'eng', score: 10, ratingsCount: 20 }),
    book({ workId: '1', title: 'Alfa', isbn13: '9789044933192', score: 8, ratingsCount: 2 }),
    book({ workId: '4', title: 'Beta', editionLanguage: 'nld' }),
  ];
  const first = selectDutchDiscoveryBooks(candidates, new Set(['4']), 6);
  const second = selectDutchDiscoveryBooks(candidates, new Set(['4']), 6);

  assert.deepEqual(first.map(({ workId }) => workId), ['1', '3']);
  assert.deepEqual(first, second);
  assert.ok(first.every(isDutchLanguageBook));
  assert.equal(shouldShowDutchDiscovery('nl', first.length), true);
  assert.equal(shouldShowDutchDiscovery('en', first.length), false);
});
