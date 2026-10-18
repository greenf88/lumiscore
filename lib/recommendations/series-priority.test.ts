import test from 'node:test';
import assert from 'node:assert/strict';
import type { Book } from '../../app/data/books.ts';
import { seriesPriorities, prioritizeSeriesRecommendations } from './series-priority.ts';
import { REVIEWED_SERIES_METADATA } from '../collections/reviewed-series-metadata.ts';
import type { TasteMembership } from '../taste-test/eligibility.ts';

const metas = REVIEWED_SERIES_METADATA.filter(m => m.expectedMainSeriesTotal >= 3).slice(0, 2);
function fixture() {
  const memberships = new Map<string, TasteMembership[]>(), books = new Map<string, Book>();
  metas.forEach((m, index) => { for (let n = 1; n <= 3; n++) {
    const id = String(index * 10 + n);
    memberships.set(id, [{ collectionId: String(index), slug: m.slug, name: m.name, type: 'series', sequence: n, subgroup: 'main', expectedTotal: m.expectedMainSeriesTotal }]);
    books.set(id, { id, workId: id, source: 'supabase', title: `Synthetic ${id}`, author: 'Fixture', score: null, ratingsCount: null, match: null, cover: 'orbit', strictEditionLanguage: 'nl' });
  } });
  return { memberships, books, ratings: [{ workId: '1', rating: 9, updatedAt: '2026-10-16' }], statuses: new Map(), language: 'nl' as const };
}
test('9/10 starter prioritises exact next main unread/unrated volume, 8 does not', () => {
  const x = fixture();
  assert.equal(seriesPriorities(x)[0].book.workId, '2');
  x.ratings[0].rating = 8; assert.deepEqual(seriesPriorities(x), []);
  x.ratings[0].rating = 10; x.ratings.push({ workId: '2', rating: 5, updatedAt: '2026-10-17' });
  assert.equal(seriesPriorities(x)[0].book.workId, '3');
});
test('missing next edition or position never jumps ahead; author collections and unknown orders do not qualify', () => {
  let x = fixture(); x.books.delete('2'); assert.deepEqual(seriesPriorities(x), []);
  x = fixture(); x.memberships.delete('2'); assert.deepEqual(seriesPriorities(x), []);
  x = fixture(); x.books.get('2')!.strictEditionLanguage = 'en'; assert.deepEqual(seriesPriorities(x), []);
  x = fixture(); for (const members of x.memberships.values()) members[0].type = 'author_collection'; assert.deepEqual(seriesPriorities(x), []);
  x = fixture(); x.memberships.get('2')![0].subgroup = 'prequel'; assert.deepEqual(seriesPriorities(x), []);
});
test('multiple series order is deterministic: rating, recency, slug, Work ID; merge has no fake percentages', () => {
  const x = fixture(); x.ratings.push({ workId: '11', rating: 10, updatedAt: '2026-10-15' });
  assert.deepEqual(seriesPriorities(x).map(p => p.book.workId), ['12', '2']);
  x.ratings[0].rating = 10; assert.deepEqual(seriesPriorities(x).map(p => p.book.workId), ['2', '12']);
  x.ratings[1].updatedAt = x.ratings[0].updatedAt;
  assert.deepEqual(seriesPriorities(x).map(p => p.slug), metas.map(m => m.slug).sort());
  const priorities = seriesPriorities(x), result = prioritizeSeriesRecommendations([], priorities, 'nl');
  assert.equal(result[0].matchScore, null); assert.equal(result[0].matchLabel, null); assert.match(result[0].explanation, /10\/10/);
  assert.equal(prioritizeSeriesRecommendations(result, priorities, 'en').length, 2);
});
