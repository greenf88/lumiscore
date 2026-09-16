import assert from 'node:assert/strict';
import test from 'node:test';
import type { Book } from '../../app/data/books.ts';
import {
  getBookCoverIdentity,
  getInitialBookCoverUrls,
  hasUsableInitialBookCover,
} from './book-cover-state.ts';

function fixture(overrides: Partial<Book> = {}): Book {
  return {
    id: 'work-8',
    source: 'supabase',
    workId: '8',
    openLibraryWorkId: 'OL893415W',
    title: 'Dune',
    author: 'Frank Herbert',
    score: null,
    ratingsCount: 0,
    match: null,
    cover: 'orbit',
    isbn13: '9780441172719',
    coverUrls: ['https://covers.example.test/dune.jpg'],
    ...overrides,
  };
}

test('a reused cover slot gets a new identity and the next book initial image', () => {
  const previousBook = fixture();
  const nextBook = fixture({
    id: 'work-27',
    workId: '27',
    openLibraryWorkId: 'OL27448W',
    isbn13: '9780261103252',
    title: 'The Lord of the Rings',
    author: 'J.R.R. Tolkien',
    coverUrls: ['https://covers.example.test/lord-of-the-rings.jpg'],
  });

  assert.notEqual(
    getBookCoverIdentity(previousBook),
    getBookCoverIdentity(nextBook),
  );
  assert.deepEqual(getInitialBookCoverUrls(nextBook), [
    'https://covers.example.test/lord-of-the-rings.jpg',
  ]);
  assert.equal(
    getInitialBookCoverUrls(nextBook).includes(previousBook.coverUrls![0]),
    false,
  );
});

test('cover identity is stable across unrelated book-object changes', () => {
  const book = fixture();
  const updatedBook: Book = { ...book, score: 8.5, ratingsCount: 12 };

  assert.equal(
    getBookCoverIdentity(book),
    getBookCoverIdentity(updatedBook),
  );
});

test('each resolver identity field invalidates the cover state', () => {
  const book = fixture();
  const identity = getBookCoverIdentity(book);

  assert.notEqual(identity, getBookCoverIdentity({ ...book, workId: '9' }));
  assert.notEqual(
    identity,
    getBookCoverIdentity({ ...book, openLibraryWorkId: 'OL9W' }),
  );
  assert.notEqual(
    identity,
    getBookCoverIdentity({ ...book, isbn13: '9780000000002' }),
  );
});

test('cover eligibility follows the existing initial candidate behavior', () => {
  assert.equal(hasUsableInitialBookCover(fixture()), true);
  assert.equal(
    hasUsableInitialBookCover(fixture({ coverUrls: [], isbn13: '9780441172719' })),
    false,
  );
  assert.equal(
    hasUsableInitialBookCover(fixture({ coverUrls: undefined, isbn13: '9780441172719' })),
    true,
  );
});
