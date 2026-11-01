import assert from 'node:assert/strict';
import test from 'node:test';
import { getReviewedCoverOverride, REVIEWED_COVER_OVERRIDES } from './reviewed-cover-overrides.ts';
import { getReviewedDescription, reviewedDescriptionSource } from './reviewed-descriptions.ts';
import { clearBookDescriptionCacheForTests, resolveBookDescription } from './description-resolution.ts';

test('nine exact images survive test-ID mapping without making other editions eligible', () => {
  const originalNine = new Set(['126','138','178','683','688','699','772','1116','1251']);
  const entries = REVIEWED_COVER_OVERRIDES.filter(e => e.reviewedAt === '2026-10-23' && originalNine.has(e.workId ?? ''));
  assert.equal(entries.length, 9);
  for (const entry of entries) {
    assert.equal(getReviewedCoverOverride({ ...entry, workId:'different-test-id' })?.coverUrl, entry.coverUrl);
    for (const change of [
      { openLibraryWorkId:'OL999W' }, { openLibraryEditionId:'OL999M' },
      { isbn13:'9780000000002' }, { editionLanguage:null }, { editionLanguage:'ger' },
      { title:'Different title' }, { author:'Different author' },
    ]) assert.equal(getReviewedCoverOverride({ ...entry, ...change }), null);
  }
  for (const workId of ['148','228','553']) {
    assert.equal(entries.some(e => e.workId === workId), false, 'uncertain covers remain neutral');
  }
});

const silver = {
  workId:'924100253',editionId:'924200253',editionTitle:'A \u200bCourt of Silver Flames',
  author:'Sarah J. Maas',isbn13:'9781526602312',editionLanguage:'eng',
  openLibraryWorkId:'OL21703979W',openLibraryEditionId:'OL29532409M',
};

test('Silver Flames has own publisher-attributed English copy; never substitutes for Dutch copy', async () => {
  for (const locale of ['en','nl'] as const) {
    const result = await resolveBookDescription({ ...silver, locale }, async () => {
      assert.fail('reviewed exact-edition summary must not wait for external providers');
    });
    if(locale==='nl'){assert.equal(result.description,null);continue;}
    assert.equal(result.state, 'resolved');
    assert.equal(result.description?.language, 'en');
    assert.equal(result.description?.source, 'official_publisher');
    assert.match(result.description?.text ?? '', /Nesta Archeron/);
    assert.equal(reviewedDescriptionSource(result.description!.sourceKey)?.name, 'Bloomsbury');
  }
  assert.equal(getReviewedDescription(silver,'nl'), null, 'English is never relabelled Dutch');
});

test('reviewed summary cannot leak to a different Work, edition, ISBN, author, title or uncertain language', () => {
  for (const change of [
    { openLibraryWorkId:'OL999W' }, { openLibraryEditionId:'OL999M' },
    { isbn13:'9780000000002' }, { editionLanguage:null }, { editionLanguage:'ger' },
    { editionTitle:'Another book' }, { author:'Another author' },
  ]) assert.equal(getReviewedDescription({ ...silver, ...change },'en'), null);
});

test('a missing edition synopsis followed by provider 429 remains a temporary failure, not missing content', async () => {
  clearBookDescriptionCacheForTests();
  const calls:string[] = [];
  const result = await resolveBookDescription({
    ...silver, openLibraryWorkId:'OL999W', openLibraryEditionId:'OL999M',
    isbn13:'9780441172719', locale:'en',
  }, async input => {
    calls.push(String(input));
    return String(input).includes('openlibrary.org')
      ? Response.json({ works:[{ key:'/works/OL999W' }], languages:[{ key:'/languages/eng' }] })
      : new Response(null,{ status:429 });
  });
  assert.equal(result.state,'temporary_failure');
  assert.equal(result.description,null);
  assert.equal(calls.length,2);
});
