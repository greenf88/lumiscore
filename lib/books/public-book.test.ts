import test from 'node:test';
import assert from 'node:assert/strict';
import { publicBook, parsePublicBooks, hasDeferredCover } from './public-book.ts';
import type { Book } from '../../app/data/books.ts';

const book: Book = { id: 'work-8', workId: '8', source: 'supabase', title: 'Duin', author: 'Frank Herbert', cover: 'orbit', score: null, ratingsCount: null, match: null };
test('search JSON preserves deferred verified covers without serializing a React resource', async () => {
  const result = await publicBook({ ...book, editionCoverUrls: Promise.resolve(['https://example.com/cover.jpg']) });
  const restored = parsePublicBooks(JSON.parse(JSON.stringify([result])))[0];
  assert.deepEqual(restored.coverUrls, ['https://example.com/cover.jpg']);
  assert.equal('editionCoverUrls' in restored, false);
  assert.equal(restored.workId, '8');
});
test('a failed optional cover preserves book identity and known cover', async () => {
  const result = await publicBook({ ...book, coverUrls: ['https://example.com/known.jpg'], editionCoverUrls: Promise.reject(new Error('unavailable')) });
  assert.equal(result.title, 'Duin');
  assert.deepEqual(result.coverUrls, ['https://example.com/known.jpg']);
});
test('older JSON responses and malformed results cannot pass an object into React use', () => {
  const result = parsePublicBooks([{ ...book, editionCoverUrls: {} }, null, { title: 'invalid' }]);
  assert.equal(result.length, 1);
  assert.equal(hasDeferredCover(result[0].editionCoverUrls), false);
  assert.equal(hasDeferredCover({}), false);
  assert.equal(hasDeferredCover(Promise.resolve([])), true);
  assert.deepEqual(result[0].coverUrls, []);
});
