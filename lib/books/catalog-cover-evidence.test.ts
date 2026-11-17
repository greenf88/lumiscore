import assert from 'node:assert/strict';
import test from 'node:test';
import type { Book } from '../../app/data/books.ts';
import evidence from './catalog-cover-evidence-20261117.json' with { type: 'json' };
import { withCatalogCoverEvidence } from './catalog-cover-evidence.ts';
import { editionSourceCoverUrls } from './edition-cover-evidence.ts';
import { getReviewedCoverOverride, REVIEWED_COVER_OVERRIDES } from './reviewed-cover-overrides.ts';

function fixture(row: typeof evidence[number]): Book {
  return {
    id: 'work-fixture', workId: 'fixture', title: row.source.title,
    author: row.author, source: 'supabase', cover: 'orbit', score: 8,
    ratingsCount: 4, match: null, coverUrls: [], editionAvailable: true,
    openLibraryEditionId: row.source.key.split('/').at(-1),
    openLibraryWorkId: row.source.works[0].key.split('/').at(-1),
    isbn13: row.source.isbn_13[0], editionLanguage: row.source.languages[0].key,
    strictEditionLanguage: row.source.languages[0].key.endsWith('/eng') ? 'en' : 'nl',
  };
}

test('archived exact-edition evidence hydrates both languages without changing book identity', () => {
  assert.equal(new Set(evidence.map(row => row.source.key)).size, evidence.length);
  const counts = { nl: 0, en: 0 };
  for (const row of evidence) {
    const book = fixture(row);
    const [resolved] = withCatalogCoverEvidence([book]);
    assert.ok(resolved.coverUrls?.length, row.source.key);
    assert.deepEqual({ ...resolved, coverUrls: [] }, book);
    assert.deepEqual(resolved.coverUrls, editionSourceCoverUrls(book, row.source));
    counts[book.strictEditionLanguage!]++;
  }
  assert.ok(counts.nl > 0 && counts.en > 0);
});

test('cover evidence cannot cross author, title, work, edition, ISBN or locale boundaries', () => {
  for (const locale of ['nl', 'en'] as const) {
    const row = evidence.find(row => fixture(row).strictEditionLanguage === locale)!;
    const book = fixture(row);
    const changes: Partial<Book>[] = [
      { author: 'Different author' }, { title: 'Different book' },
      { openLibraryWorkId: 'OL999999999W' }, { openLibraryEditionId: 'OL999999999M' },
      { isbn13: '9780000000000' }, { editionLanguage: 'ger' },
      { strictEditionLanguage: locale === 'nl' ? 'en' : 'nl' },
      { strictEditionLanguage: undefined }, { editionAvailable: false },
      { storedPresentationUnavailable: true },
    ];
    for (const change of changes) {
      const changed = { ...book, ...change };
      assert.equal(withCatalogCoverEvidence([changed])[0], changed);
    }
    const stored = { ...book, coverUrls: ['https://publisher.example/approved.jpg'] };
    assert.equal(withCatalogCoverEvidence([stored])[0], stored);
    const display = { ...book, title: 'Curated display title', editionTitle: book.title };
    assert.deepEqual(withCatalogCoverEvidence([display])[0].coverUrls, withCatalogCoverEvidence([book])[0].coverUrls);
  }
});

test('malformed provider JSON degrades to a neutral cover instead of crashing a card', () => {
  const row = evidence[0], book = fixture(row);
  for (const change of [
    { key: {} }, { works: {} }, { works: [null, { key: {} }] },
    { title: 42 }, { languages: {} }, { languages: [{ key: {} }] },
    { isbn_13: {} }, { isbn_13: [null, {}] }, { covers: {} }, { covers: [-1, null, '123'] },
  ]) {
    assert.deepEqual(editionSourceCoverUrls(book, { ...row.source, ...change } as never), []);
  }
});

test('manually reviewed missing jackets remain bound to their exact English edition', () => {
  for (const workId of ['180', '389', '648', '1359', '2144']) {
    const entry = REVIEWED_COVER_OVERRIDES.find(row => row.workId === workId && row.reviewedAt === '2026-11-17')!;
    assert.ok(entry, workId);
    assert.equal(getReviewedCoverOverride(entry)?.coverUrl, entry.coverUrl);
    for (const change of [
      { editionLanguage: 'nld' }, { isbn13: '9780000000000' },
      { openLibraryEditionId: 'OL999999999M' }, { openLibraryWorkId: 'OL999999999W' },
      { title: 'Different title' }, { author: 'Different author' },
    ]) assert.equal(getReviewedCoverOverride({ ...entry, ...change }), null);
  }
});
