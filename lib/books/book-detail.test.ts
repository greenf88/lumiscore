import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { Book } from '@/app/data/books';
import {
  getBookMetadataDescription,
  getCatalogSourceLabel,
  getVerifiedBackCover,
  isCatalogWorkId,
} from './book-detail.ts';
import { getBookHref } from './book-navigation.ts';

const fixture = (overrides: Partial<Book> = {}): Book => ({
  id: 'work-42',
  source: 'supabase',
  workId: '42',
  sourceType: 'open_library',
  openLibraryWorkId: 'OL42W',
  title: 'Dune',
  author: 'Frank Herbert',
  firstPublishYear: 1965,
  score: null,
  ratingsCount: null,
  match: null,
  cover: 'orbit',
  ...overrides,
});

test('accepts positive internal database IDs and rejects invalid routes', () => {
  assert.equal(isCatalogWorkId('1'), true);
  assert.equal(isCatalogWorkId('1301'), true);
  assert.equal(isCatalogWorkId('0'), false);
  assert.equal(isCatalogWorkId('OL42W'), false);
  assert.equal(isCatalogWorkId('not-a-book'), false);
});

test('builds detail links only from real Supabase works.id values', () => {
  assert.equal(
    getBookHref({
      ...fixture(),
      workId: '8',
    }),
    '/book/8',
  );
  assert.equal(
    getBookHref(fixture({ id: 'demo-book', source: 'demo', workId: null })),
    null,
  );
  assert.equal(
    getBookHref(fixture({ workId: 'not-an-id' })),
    null,
  );
});

test('labels Open Library and LumiScore-native works without changing routing identity', () => {
  assert.equal(getCatalogSourceLabel(fixture()), 'Open Library catalog');
  assert.equal(
    getCatalogSourceLabel(
      fixture({ sourceType: 'lumiscore_native', openLibraryWorkId: null }),
    ),
    'LumiScore catalog',
  );
});

test('builds useful metadata without inventing missing publication data', () => {
  assert.equal(
    getBookMetadataDescription(fixture()),
    'Dune by Frank Herbert, first published in 1965. View book information and its LumiScore rating status.',
  );
  assert.equal(
    getBookMetadataDescription(
      fixture({ title: 'Vogeleiland', author: 'Marion Pauw', firstPublishYear: null }),
    ),
    'Vogeleiland by Marion Pauw. View book information and its LumiScore rating status.',
  );
});

test('keeps verified back-cover media separate and tied to the edition ISBN', () => {
  const backCover = {
    side: 'back' as const,
    url: 'https://metadata.example.test/dune-back.jpg',
    source: 'trusted-onix-feed',
    sourceKey: '9780441172719:back',
    isbn13: '9780441172719',
    verified: true as const,
  };

  assert.equal(
    getVerifiedBackCover(
      fixture({ isbn13: '9780441172719', backCover }),
    ),
    backCover,
  );
  assert.equal(
    getVerifiedBackCover(
      fixture({
        isbn13: '9780441172719',
        backCover: { ...backCover, isbn13: '9780593099322' },
      }),
    ),
    null,
  );
  assert.equal(
    getVerifiedBackCover(
      fixture({ backCover: { ...backCover, url: 'http://example.test/back.jpg' } }),
    ),
    null,
  );
});

test('book detail loads shared Taste Test personalization instead of requiring ratings', async () => {
  const [page, component, loader] = await Promise.all([
    readFile(new URL('../../app/book/[workId]/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../app/components/LumiScoreBookDetail.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/taste-test.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(page, /loadBookDetailPersonalization\(workId, locale\)/);
  assert.match(component, /parseGuestTasteTestAnswers/);
  assert.match(component, /calculatePersonalMatch/);
  assert.doesNotMatch(component, /detail-match-panel[\s\S]{0,180}<strong>—<\/strong>/);
  assert.match(loader, /buildTasteProfile\(answers, ratingEvidence, locale\)/);
  assert.match(loader, /profile\.selectedCount > 0 \|\| profile\.meaningfulRatingCount > 0/);
});

test('book detail keeps separate unlock and insufficient-metadata states', async () => {
  const [component, translations] = await Promise.all([
    readFile(new URL('../../app/components/LumiScoreBookDetail.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../i18n/translations.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(component, /detail\.unlockMatch/);
  assert.match(component, /detail\.matchNeedsBookMetadata/);
  assert.match(translations, /Take the Taste Test or rate books to see your match/);
  assert.match(translations, /Doe de Smaaktest of beoordeel boeken om jouw match te zien/);
});
