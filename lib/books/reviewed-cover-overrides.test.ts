import assert from 'node:assert/strict';
import test from 'node:test';
import { getInitialBookCoverUrls } from './book-cover-state.ts';
import { getReviewedCoverOverride, REVIEWED_COVER_OVERRIDES } from './reviewed-cover-overrides.ts';

const festival = {
  id: 'work-1296',
  workId: '1296',
  title: 'Festival',
  author: 'Suzanne Vermeer',
  isbn13: '9789400517134',
  coverUrls: [],
};

test('Festival uses the exact reviewed official-publisher cover', () => {
  const override = getReviewedCoverOverride(festival);
  assert.equal(override?.source, 'official_publisher');
  assert.equal(override?.isbn13, '9789400517134');
  assert.match(override?.coverUrl ?? '', /^https:\/\/www\.awbruna\.nl\//);
  assert.deepEqual(getInitialBookCoverUrls(festival), [override?.coverUrl]);
});

test('reviewed cover identity cannot leak to another work or ISBN', () => {
  assert.equal(getReviewedCoverOverride({ ...festival, workId: '1297' }), null);
  assert.equal(getReviewedCoverOverride({ ...festival, isbn13: '9789044936438' }), null);
  assert.equal(getReviewedCoverOverride({ ...festival, title: 'Another Festival' }), null);
  assert.equal(getReviewedCoverOverride({ ...festival, author: 'Another author' }), null);
});

test('reviewed native covers render immediately without provider resolution and stay identity-bound', () => {
  const native = REVIEWED_COVER_OVERRIDES.filter(({ workId }) => Number(workId) >= 1260 && Number(workId) <= 1281);
  assert.equal(native.length, 22);
  assert.equal(new Set(native.map(({ workId }) => workId)).size, 22);
  for (const entry of native) {
    const book = { ...entry, id: `work-${entry.workId}`, coverUrls: [] };
    assert.deepEqual(getInitialBookCoverUrls(book), [entry.coverUrl]);
    assert.equal(getReviewedCoverOverride({ ...book, isbn13: '9780000000002' }), null);
    assert.equal(getReviewedCoverOverride({ ...book, author: 'Different author' }), null);
    assert.equal(getReviewedCoverOverride({ ...book, title: 'Different title' }), null);
  }
});

test('existing resolved cover candidates retain priority over a reviewed fallback', () => {
  const stored = 'https://covers.openlibrary.org/b/id/123-L.jpg?default=false';
  assert.deepEqual(getInitialBookCoverUrls({ ...festival, coverUrls: [stored] }), [
    stored,
    getReviewedCoverOverride(festival)?.coverUrl,
  ]);
});

test('editorial positive cover evidence requires exact ISBN, Work, title, author, edition and language',()=>{
  const entries=REVIEWED_COVER_OVERRIDES.filter(entry=>entry.source==='reviewed_open_library');
  assert.equal(entries.length,13);
  for(const entry of entries){
    assert.equal(getReviewedCoverOverride(entry)?.coverUrl,entry.coverUrl);
    for(const change of [{editionLanguage:null},{editionLanguage:'ger'},{openLibraryEditionId:'OL999M'},{isbn13:'9780000000000'},{openLibraryWorkId:'OL999W'}]){
      assert.equal(getReviewedCoverOverride({...entry,...change}),null);
    }
  }
});
test('reviewed exact publisher images survive numeric test-ID mapping but never a different source identity',()=>{
 for(const workId of ['25','304']){
  const entry=REVIEWED_COVER_OVERRIDES.find(e=>e.workId===workId)!;
  assert.equal(getReviewedCoverOverride({...entry,workId:'921100'+workId})?.coverUrl,entry.coverUrl);
  assert.equal(getReviewedCoverOverride({...entry,openLibraryWorkId:'OL999W'}),null);
  assert.equal(getReviewedCoverOverride({...entry,editionLanguage:'nld'}),null);
  assert.equal(getReviewedCoverOverride({...entry,openLibraryEditionId:'OL999M'}),null);
 }
});
