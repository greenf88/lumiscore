import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getWorkDisplayTitle,
  normalizeMatchText,
  scoreWorkMatch,
  selectBestWorkMatch,
  type BookMatchSeed,
  type OpenLibrarySearchDocument,
} from './open-library-matching.ts';
import {
  MANUAL_VERIFICATION_TITLES,
  SEED_BOOKS,
  SEED_CATEGORIES,
} from './open-library-seeds.ts';

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

test('uses a preferred display title without changing work identity', () => {
  const work = alchemistResults[2];
  const displayTitle = getWorkDisplayTitle(
    { ...alchemistSeed, preferredDisplayTitle: 'The Alchemist' },
    work,
  );

  assert.equal(work.key, '/works/OL796465W');
  assert.equal(work.title, 'O Alquimista');
  assert.equal(displayTitle, 'The Alchemist');
});

test('falls back to the raw Open Library title', () => {
  assert.equal(
    getWorkDisplayTitle(
      { title: 'Dune', author: 'Frank Herbert' },
      { key: '/works/OL893414W', title: 'Dune' },
    ),
    'Dune',
  );
});

test('configures exactly 100 unique seed works', () => {
  assert.equal(SEED_BOOKS.length, 100);

  const identities = SEED_BOOKS.map((seed) =>
    `${normalizeMatchText(seed.title)}::${normalizeMatchText(seed.author)}`,
  );
  assert.equal(new Set(identities).size, SEED_BOOKS.length);
});

test('keeps the requested category balance', () => {
  const expectedCounts = {
    'fantasy-science-fiction': 25,
    classics: 20,
    'thriller-crime': 15,
    romance: 15,
    'non-fiction': 15,
    'young-adult-children': 10,
  };

  assert.deepEqual(
    Object.fromEntries(
      SEED_CATEGORIES.map((category) => [
        category,
        SEED_BOOKS.filter((seed) => seed.category === category).length,
      ]),
    ),
    expectedCounts,
  );
});

test('keeps all original ten titles in the expanded seed list', () => {
  const originalTitles = [
    '1984',
    'Pride and Prejudice',
    'To Kill a Mockingbird',
    'The Great Gatsby',
    'The Hobbit',
    'The Lord of the Rings',
    'Dune',
    "The Handmaid's Tale",
    'The Book Thief',
    'The Alchemist',
  ];
  const configuredTitles = new Set(SEED_BOOKS.map((seed) => seed.title));

  for (const title of originalTitles) assert.ok(configuredTitles.has(title));
});

test('gives every seed an author and first-publication-year hint', () => {
  for (const seed of SEED_BOOKS) {
    assert.ok(seed.author.trim(), `${seed.title} is missing an author`);
    assert.ok(
      Number.isInteger(seed.firstPublishYear),
      `${seed.title} is missing a first publish year`,
    );
  }
});

test('does not seed derivative or guide titles', () => {
  const rejectedPhrases = [
    'abridged',
    'adaptation',
    'companion',
    'graphic novel',
    'study guide',
    'summary',
    'workbook',
  ];

  for (const seed of SEED_BOOKS) {
    const title = normalizeMatchText(seed.title);
    assert.equal(
      rejectedPhrases.some((phrase) => title.includes(phrase)),
      false,
      `${seed.title} looks like a derivative work`,
    );
  }
});

test('tracks only configured seeds as manual-verification candidates', () => {
  const configuredTitles = new Set(SEED_BOOKS.map((seed) => seed.title));

  for (const title of MANUAL_VERIFICATION_TITLES) {
    assert.ok(configuredTitles.has(title));
  }
});
