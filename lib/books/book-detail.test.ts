import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import type { Book, VerifiedBookDescription } from '@/app/data/books';
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
  assert.equal(
    getBookHref(fixture({ workId: '1296' }), {
      kind: 'collection',
      slug: 'suzanne-vermeer',
    }),
    '/book/1296?returnTo=%2Fcollection%2Fsuzanne-vermeer',
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

const reviewedSummary = (text: string, language: 'en' | 'nl' = 'en'): VerifiedBookDescription => ({
  text, language, source: 'official_catalog', sourceKey: 'https://example.com/book',
  sourceUrl: 'https://example.com/book', sourceName: 'Reviewed catalogue', verifiedAt: '2026-11-13',
});

test('metadata uses approved visible content, normalizing markup and whitespace', () => {
  assert.equal(getBookMetadataDescription(fixture(), 'en', reviewedSummary('<p>A reader follows the clues &amp; discovers a family secret.</p>\n\n<p>Her journey changes her life.</p>')),
    'A reader follows the clues & discovers a family secret. Her journey changes her life.');
  assert.equal(getBookMetadataDescription(fixture(), 'nl', reviewedSummary('Een lezer ontdekt een familiegeheim.', 'nl')),
    'Een lezer ontdekt een familiegeheim.');
});

test('long metadata summaries end at a complete word and preserve Unicode', () => {
  const text = 'A reader follows the clues through an unfamiliar city, meeting old friends and facing difficult choices. '+
    'She discovers that her family has kept a secret from her for many years. Her final decision changes everything.';
  const snippet = getBookMetadataDescription(fixture(), 'en', reviewedSummary(text));
  assert.ok(Array.from(snippet).length <= 160);
  assert.ok(snippet.endsWith('…'));
  assert.ok(text.startsWith(snippet.slice(0, -1) + ' '), 'truncation keeps a complete final word');
  const unicode = '𐐀stral reader '.repeat(20);
  const unicodeSnippet = getBookMetadataDescription(fixture(), 'en', reviewedSummary(unicode));
  assert.ok(Array.from(unicodeSnippet).length <= 160);
  assert.ok(unicode.startsWith(unicodeSnippet.slice(0, -1) + ' '));
  assert.doesNotMatch(unicodeSnippet, /\uFFFD/);
});

test('metadata keeps the generic fallback for absent, unusable or wrong-language content', () => {
  const fallback = getBookMetadataDescription(fixture());
  for (const invalid of [null, reviewedSummary('Een lezer ontdekt een geheim.', 'nl'),
    reviewedSummary('Service unavailable'), reviewedSummary('x'.repeat(180)),
    {...reviewedSummary('A reader discovers a secret.'), source: 'open_library' as const, sourceKey: 'not-an-open-library-id'}]) {
    assert.equal(getBookMetadataDescription(fixture(), 'en', invalid), fallback);
  }
  assert.equal(getBookMetadataDescription(fixture({editionAvailable:false}), 'en', reviewedSummary('A reader discovers a secret.')), fallback);
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
  const [page, component, loader, guestMatch] = await Promise.all([
    readFile(new URL('../../app/book/[workId]/page.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../../app/components/LumiScoreBookDetail.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../supabase/taste-test.ts', import.meta.url), 'utf8'),
    readFile(new URL('../performance/guest-book-match.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(page, /loadBookDetailPersonalization\(workId, locale\)/);
  assert.match(component, /loadGuestBookMatch/);
  assert.match(guestMatch, /parseGuestTasteTestAnswers/);
  assert.match(guestMatch, /calculatePersonalMatch/);
  assert.doesNotMatch(component, /detail-match-panel[\s\S]{0,180}<strong>—<\/strong>/);
  assert.match(loader, /loadReaderTasteProfile\(client,user\.id,locale\)/);
  assert.match(loader, /const profile = reader!\.profile/);
  assert.match(loader, /profile\.selectedCount > 0 \|\| profile\.meaningfulRatingCount > 0/);
});

test('book detail keeps unlock copy but suppresses insufficient-metadata copy', async () => {
  const [component, translations] = await Promise.all([
    readFile(new URL('../../app/components/LumiScoreBookDetail.tsx', import.meta.url), 'utf8'),
    readFile(new URL('../i18n/translations.ts', import.meta.url), 'utf8'),
  ]);

  assert.match(component, /detail\.unlockMatch/);
  assert.doesNotMatch(component, /detail\.matchNeedsBookMetadata/);
  assert.match(translations, /Take the Taste Test or rate books to see your match/);
  assert.match(translations, /Doe de Smaaktest of beoordeel boeken om jouw match te zien/);
});

test('coverage NONE renders a dash without an explanatory paragraph', async () => {
  const component = await readFile(
    new URL('../../app/components/LumiScoreBookDetail.tsx', import.meta.url),
    'utf8',
  );

  assert.match(component, /const matchValue =[\s\S]*?: '—';/);
  assert.match(component, /candidate\.coverageLevel === 'none'[\s\S]*?\? null/);
  assert.match(component, /<span id="match-heading">\{t\('detail\.yourMatch'\)\}<\/span>/);
  assert.match(component, /<strong>\{matchValue\}<\/strong>/);
  assert.match(component, /\{matchCopy && <p[^>]*>\{matchCopy\}<\/p>\}/);
  assert.doesNotMatch(component, /\n\s*<p>\{matchCopy\}<\/p>/);
});

test('ERA_ONLY renders a dash without explanatory copy', async () => {
  const component = await readFile(
    new URL('../../app/components/LumiScoreBookDetail.tsx', import.meta.url),
    'utf8',
  );

  assert.match(component, /candidate\.coverageLevel === 'era_only'[\s\S]*?\? null/);
  assert.match(component, /\{matchCopy && <p[^>]*>\{matchCopy\}<\/p>\}/);
});

test('valid PARTIAL and RICH match content remains available', async () => {
  const component = await readFile(
    new URL('../../app/components/LumiScoreBookDetail.tsx', import.meta.url),
    'utf8',
  );

  assert.match(component, /personalMatch\?\.explanation[\s\S]*?\? personalMatch\.explanation/);
  assert.match(component, /detail\.matchNoOverlap/);
  assert.match(component, /personalMatch\?\.matchScore[\s\S]*?`\$\{personalMatch\.matchScore\}%`/);
  assert.match(component, /personalMatch\?\.matchLabel[\s\S]*?MATCH_LABEL_KEYS/);
});
