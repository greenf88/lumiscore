import assert from 'node:assert/strict';
import test from 'node:test';
import type { Book } from '../../app/data/books.ts';
import { guestRoundResult, guestRoundState, selectGuestBooks, type GuestInventoryRow } from './guest-round.ts';
import { tasteVector } from './traits.ts';

function book(id: number, language: 'nl' | 'en' = 'nl'): Book {
  return { id: String(id), workId: String(id), title: 'Book ' + id, author: 'Test author',
    source: 'supabase', editionAvailable: true, strictEditionLanguage: language,
    editionLanguage: language, score: null, ratingsCount: null, match: null, cover: 'orbit' };
}

test('missing anchor, wrong language and repeated series never prevent later eligible books being offered', () => {
  const inventory: GuestInventoryRow[] = [
    { work_id: 143, series_ids: [1] }, { work_id: 2, series_ids: [2] },
    { work_id: 3, series_ids: [2] }, { work_id: 4, series_ids: [] },
    { work_id: 5, series_ids: [] },
  ];
  assert.deepEqual(selectGuestBooks(inventory, [book(2), book(3), book(4, 'en'), book(5)], 'nl')
    .map(item => item.workId), ['2', '5']);
  assert.deepEqual(selectGuestBooks(inventory, [book(4, 'en')], 'en').map(item => item.workId), ['4']);
  assert.deepEqual(selectGuestBooks([], [book(2)], 'nl'), []);
});

test('a skip consumes an offer but adds no evidence; results use ratings of the actual works', () => {
  const offers = selectGuestBooks([2, 3, 4].map(work_id => ({ work_id, series_ids: [] })), [book(2), book(3), book(4)], 'nl')
    .map(book => ({ book, traits: tasteVector({ fantasy: 1 }) }));
  const decisions = [{ workId: '2', rating: null }, { workId: '3', rating: 9 }, { workId: '999', rating: 10 }];
  assert.equal(guestRoundState(offers, decisions).next?.book.workId, '4');
  const profile = guestRoundResult(offers, decisions, 'nl');
  assert.equal(profile.ratingCount, 1);
  assert.ok(profile.vector.fantasy > 0);
  assert.equal(profile.selectedCount, 0);
});
