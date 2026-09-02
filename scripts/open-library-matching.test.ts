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
  ADDITIONAL_SEED_BOOKS,
  EXPANDED_SEED_BOOKS,
  LEGACY_SEED_BOOKS,
  MANUAL_VERIFICATION_TITLES,
  ORIGINAL_SEED_BOOKS,
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

function seedIdentity(seed: { title: string; author: string }): string {
  const normalizeIdentityPart = (value: string) =>
    value
      .normalize('NFKC')
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim()
      .toLocaleLowerCase('en');

  return `${normalizeIdentityPart(seed.title)}::${normalizeIdentityPart(seed.author)}`;
}

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

test('pins Little Women to the main Open Library novel work', () => {
  const seed = SEED_BOOKS.find((book) => book.title === 'Little Women');
  assert.ok(seed);

  const result = selectBestWorkMatch(seed, [
    {
      key: '/works/OL999999W',
      title: "Kitty's Class Day and Other Stories",
      author_name: ['Louisa May Alcott'],
      first_publish_year: 1868,
      edition_count: 900,
    },
    {
      key: '/works/OL29983W',
      title: 'Little Women',
      author_name: ['Louisa May Alcott'],
      first_publish_year: 1848,
      edition_count: 765,
    },
  ]);

  assert.equal(result.key, '/works/OL29983W');
});

test('selects the original Chinese Three-Body Problem work by exact ID', () => {
  const seed = SEED_BOOKS.find(
    (book) => book.title === 'The Three-Body Problem',
  );
  assert.ok(seed);

  const result = selectBestWorkMatch(seed, [
    {
      key: '/works/OL44576333W',
      title:
        "Cixin Liu Bestselling Collecting Books Series, Set of 4 Books. the Three-Body Problem, the Wandering Earth, the Dark Forest and Death's End",
      author_name: ['Cixin Liu'],
      first_publish_year: 2022,
      edition_count: 1,
    },
    {
      key: '/works/OL17267881W',
      title: '三体 (sān tǐ)',
      author_name: ['刘慈欣'],
      first_publish_year: 2008,
      edition_count: 44,
    },
  ]);

  assert.equal(result.key, '/works/OL17267881W');
  assert.equal(getWorkDisplayTitle(seed, result), 'The Three-Body Problem');
});

test('fails instead of accepting the wrong work when a pinned work is absent', () => {
  const seed = SEED_BOOKS.find((book) => book.title === 'Little Women');
  assert.ok(seed);

  assert.throws(
    () =>
      selectBestWorkMatch(seed, [
        {
          key: '/works/OL999999W',
          title: "Kitty's Class Day and Other Stories",
          author_name: ['Louisa May Alcott'],
          first_publish_year: 1868,
          edition_count: 900,
        },
      ]),
    /No trustworthy Open Library work found/,
  );
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

test('uses the requested display titles for the remaining title variants', () => {
  const expectedTitles = [
    'The Spy Who Came in from the Cold',
    'Thinking, Fast and Slow',
    "The Omnivore's Dilemma",
  ];

  for (const title of expectedTitles) {
    const seed = SEED_BOOKS.find((book) => book.title === title);
    assert.ok(seed);
    assert.equal(
      getWorkDisplayTitle(seed, { key: '/works/OL1W', title: 'Raw title' }),
      title,
    );
  }
});

test('pins all 32 manually verified titles to their requested Open Library works', () => {
  const expectedPins = new Map([
    ['The Lord of the Rings', 'OL27448W'],
    ['The Three-Body Problem', 'OL17267881W'],
    ['Crime and Punishment', 'OL166894W'],
    ['War and Peace', 'OL267171W'],
    ['One Hundred Years of Solitude', 'OL274505W'],
    ['The Stranger', 'OL1230613W'],
    ['The Girl with the Dragon Tattoo', 'OL5784622W'],
    ['And Then There Were None', 'OL471565W'],
    ['The Diary of a Young Girl', 'OL266178W'],
    ["Man's Search for Meaning", 'OL1268413W'],
    ['The Little Prince', 'OL10263W'],
    ['Before the Coffee Gets Cold', 'OL20019347W'],
    ['Don Quixote', 'OL503666W'],
    ['The Divine Comedy', 'OL93082W'],
    ['Doctor Zhivago', 'OL258301W'],
    ['The Adventures of Sherlock Holmes', 'OL262421W'],
    ['The Alchemist', 'OL796465W'],
    ['Pippi Longstocking', 'OL14872925W'],
    ['Arsène Lupin, Gentleman Burglar', 'OL1064277W'],
    ['The Courage to Be Disliked', 'OL19744000W'],
    ['Tender Is the Flesh', 'OL17864836W'],
    ['The Trial', 'OL498463W'],
    ['We', 'OL10215W'],
    ['The Iliad', 'OL61981W'],
    ['The Odyssey', 'OL61982W'],
    ['The Death of Ivan Ilyich', 'OL267174W'],
    ['Notes from Underground', 'OL21025633W'],
    ['The Idiot', 'OL166925W'],
    ['Breasts and Eggs', 'OL20835348W'],
    ['Kitchen', 'OL2637599W'],
    ['Beauty Is a Wound', 'OL34965326W'],
    ['The Belly of the Atlantic', 'OL9037402W'],
  ]);

  const configuredNames = (seed: (typeof SEED_BOOKS)[number]) => [
    seed.title,
    seed.preferredDisplayTitle,
    ...(seed.alternateTitles ?? []),
  ].filter((title): title is string => Boolean(title));

  for (const [title, expectedWorkId] of expectedPins) {
    const matchingSeeds = SEED_BOOKS.filter((seed) =>
      configuredNames(seed).some(
        (configuredTitle) =>
          normalizeMatchText(configuredTitle) === normalizeMatchText(title),
      ),
    );
    const configuredPins = matchingSeeds.flatMap((seed) =>
      seed.expectedOpenLibraryWorkId
        ? [seed.expectedOpenLibraryWorkId]
        : [],
    );

    assert.ok(matchingSeeds.length > 0, `${title} is not configured`);
    assert.deepEqual(
      [...new Set(configuredPins)],
      [expectedWorkId],
      `${title} is not pinned exclusively to ${expectedWorkId}`,
    );
  }

  const pauloCoelhoAlchemist = SEED_BOOKS.find(
    (seed) => seed.title === 'The Alchemist' && seed.author === 'Paulo Coelho',
  );
  assert.equal(
    pauloCoelhoAlchemist?.expectedOpenLibraryWorkId,
    'OL796465W',
  );
});

test('configures exactly 1000 unique seed works while preserving all 115 existing seeds', () => {
  assert.equal(ORIGINAL_SEED_BOOKS.length, 100);
  assert.equal(ADDITIONAL_SEED_BOOKS.length, 15);
  assert.equal(LEGACY_SEED_BOOKS.length, 115);
  assert.equal(EXPANDED_SEED_BOOKS.length, 885);
  assert.equal(SEED_BOOKS.length, 1000);

  const identities = SEED_BOOKS.map(seedIdentity);
  assert.equal(new Set(identities).size, SEED_BOOKS.length);

  const pinnedWorkIds = SEED_BOOKS.flatMap((seed) =>
    seed.expectedOpenLibraryWorkId
      ? [seed.expectedOpenLibraryWorkId.toUpperCase()]
      : [],
  );
  assert.equal(new Set(pinnedWorkIds).size, pinnedWorkIds.length);
});

test('keeps the requested category balance', () => {
  const expectedCounts = {
    'fantasy-science-fiction': 28,
    classics: 20,
    'thriller-crime': 17,
    romance: 18,
    'non-fiction': 18,
    'young-adult-children': 14,
    'contemporary-general-fiction': 0,
  };

  const expandedExpectedCounts = {
    'fantasy-science-fiction': 220,
    classics: 150,
    'thriller-crime': 140,
    romance: 130,
    'non-fiction': 140,
    'young-adult-children': 120,
    'contemporary-general-fiction': 100,
  };

  assert.deepEqual(
    Object.fromEntries(
      SEED_CATEGORIES.map((category) => [
        category,
        LEGACY_SEED_BOOKS.filter((seed) => seed.category === category).length,
      ]),
    ),
    expectedCounts,
  );

  assert.deepEqual(
    Object.fromEntries(
      SEED_CATEGORIES.map((category) => [
        category,
        SEED_BOOKS.filter((seed) => seed.category === category).length,
      ]),
    ),
    expandedExpectedCounts,
  );
});

test('includes all 15 requested additions', () => {
  const expectedTitles = [
    'The Hunger Games',
    'The Road',
    'The Seven Husbands of Evelyn Hugo',
    'Normal People',
    'It',
    'Atomic Habits',
    'The Subtle Art of Not Giving a F*ck',
    'Born a Crime',
    'Matilda',
    'Charlie and the Chocolate Factory',
    'The Very Hungry Caterpillar',
    'The Midnight Library',
    'Where the Crawdads Sing',
    'The Song of Achilles',
    'Circe',
  ];

  assert.deepEqual(
    ADDITIONAL_SEED_BOOKS.map((seed) => seed.title),
    expectedTitles,
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

test('has no duplicate title and author combinations', () => {
  const identities = SEED_BOOKS.map(seedIdentity);

  assert.equal(new Set(identities).size, 1000);
});

test('pins every seed to a unique Open Library work', () => {
  const pinnedSeeds = SEED_BOOKS.filter(
    (seed) => seed.expectedOpenLibraryWorkId,
  );
  const pinnedWorkIds = pinnedSeeds.map((seed) =>
    seed.expectedOpenLibraryWorkId!.toUpperCase(),
  );

  assert.equal(pinnedSeeds.length, 1000);
  assert.equal(new Set(pinnedWorkIds).size, 1000);
  assert.ok(pinnedWorkIds.every((workId) => /^OL\d+W$/.test(workId)));
});

test('keeps one canonical seed for each resolved semantic duplicate', () => {
  const warAndPeaceSeeds = SEED_BOOKS.filter(
    (seed) => seed.expectedOpenLibraryWorkId === 'OL267171W',
  );
  const monteCristoSeeds = SEED_BOOKS.filter(
    (seed) => seed.expectedOpenLibraryWorkId === 'OL36287W',
  );

  assert.deepEqual(warAndPeaceSeeds.map(({ title, author }) => ({ title, author })), [
    { title: 'War and Peace', author: 'Leo Tolstoy' },
  ]);
  assert.deepEqual(monteCristoSeeds.map(({ title, author }) => ({ title, author })), [
    { title: 'The Count of Monte Cristo', author: 'Alexandre Dumas' },
  ]);
  assert.equal(
    SEED_BOOKS.some(
      (seed) => seed.title === 'War and Peace' && seed.author === 'Лев Толстой',
    ),
    false,
  );
  assert.equal(
    SEED_BOOKS.some((seed) => seed.title.startsWith('Hrabě Monte Cristo')),
    false,
  );
});

test('uses distinct canonical works for the two replacement classics', () => {
  assert.ok(
    SEED_BOOKS.some(
      (seed) =>
        seed.title === 'The Remains of the Day' &&
        seed.author === 'Kazuo Ishiguro' &&
        seed.expectedOpenLibraryWorkId === 'OL59048W',
    ),
  );
  assert.ok(
    SEED_BOOKS.some(
      (seed) =>
        seed.title === 'Native Son' &&
        seed.author === 'Richard Wright' &&
        seed.expectedOpenLibraryWorkId === 'OL275128W',
    ),
  );
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
