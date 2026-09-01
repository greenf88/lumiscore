import assert from 'node:assert/strict';
import test from 'node:test';
import {
  scoreWorkMatch,
  selectBestWorkMatch,
  type BookMatchSeed,
  type OpenLibrarySearchDocument,
} from './open-library-matching.ts';

const alchemistSeed: BookMatchSeed = {
  title: 'The Alchemist',
  alternateTitles: ['O Alquimista'],
  author: 'Paulo Coelho',
  firstPublishYear: 1988,
};

const alchemistResults: OpenLibrarySearchDocument[] = [
  {
    key: '/works/OL24793569W',
    title: 'The Alchemist Graphic Novel',
    author_name: ['Paulo Coelho'],
    first_publish_year: 2010,
    edition_count: 3,
  },
  {
    key: '/works/OL42974242W',
    title: 'The Alchemist',
    author_name: ['Paulo Coelho (Author)'],
    first_publish_year: 2010,
    edition_count: 1,
  },
  {
    key: '/works/OL796465W',
    title: 'O Alquimista',
    author_name: ['Paulo Coelho'],
    first_publish_year: 1988,
    edition_count: 141,
  },
  {
    key: '/works/OL17572890W',
    title: 'Sparknotes The Alchemist',
    author_name: ['Paulo Coelho'],
    first_publish_year: 2014,
    edition_count: 1,
  },
];

test('selects Paulo Coelho’s original Alchemist work', () => {
  const result = selectBestWorkMatch(alchemistSeed, alchemistResults);
  assert.equal(result.key, '/works/OL796465W');
});

test('prefers an exact title and expected author', () => {
  const seed = { title: 'Dune', author: 'Frank Herbert' };
  const result = selectBestWorkMatch(seed, [
    {
      key: '/works/OL1W',
      title: 'Dune',
      author_name: ['Jane Doe'],
      edition_count: 100,
    },
    {
      key: '/works/OL2W',
      title: 'Dune',
      author_name: ['Frank Herbert'],
      edition_count: 10,
    },
  ]);

  assert.equal(result.key, '/works/OL2W');
});

test('penalizes derivative works even when their titles contain the seed title', () => {
  const original = alchemistResults[2];
  const graphicNovel = alchemistResults[0];

  assert.ok(
    scoreWorkMatch(alchemistSeed, original) >
      scoreWorkMatch(alchemistSeed, graphicNovel),
  );
});

test('uses first publish year to reject a later duplicate work', () => {
  const result = selectBestWorkMatch(alchemistSeed, [
    alchemistResults[1],
    alchemistResults[2],
  ]);

  assert.equal(result.key, '/works/OL796465W');
});

test('uses a canonical-title alias and edition count to prefer the main work', () => {
  const seed = {
    title: '1984',
    alternateTitles: ['Nineteen Eighty-Four'],
    author: 'George Orwell',
    firstPublishYear: 1949,
  };
  const result = selectBestWorkMatch(seed, [
    {
      key: '/works/OL34588009W',
      title: '1984 George Orwell - Nineteen Eighty-Four - Paperback',
      author_name: ['George Orwell'],
      first_publish_year: 1949,
      edition_count: 1,
    },
    {
      key: '/works/OL1168083W',
      title: 'Nineteen Eighty-Four',
      author_name: ['George Orwell'],
      first_publish_year: 1949,
      edition_count: 537,
    },
  ]);

  assert.equal(result.key, '/works/OL1168083W');
});
