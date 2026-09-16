import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getPreferredEditionLanguages,
  getWorkFirstPublishYear,
  selectCoverEdition,
  selectRepresentativeEdition,
  type EditionCandidate,
} from './edition-ranking.ts';

const context = {
  workTitle: 'Dune',
  firstPublishYear: 1965,
  preferredLanguages: ['eng'],
};

test('normal print beats an audiobook', () => {
  const audiobook = {
    id: 'audio',
    title: 'Dune (Unabridged on 13 Cassettes)',
    physicalFormat: 'Audio cassette',
    languageCodes: ['eng'],
    isbn13: '9781402523601',
  };
  const paperback = {
    id: 'paperback',
    title: 'Dune',
    physicalFormat: 'Paperback',
    languageCodes: ['eng'],
    isbn13: '9780441172719',
  };

  assert.equal(
    selectRepresentativeEdition([audiobook, paperback], context)?.id,
    'paperback',
  );
});

test('normal print beats other non-representative variants', () => {
  const normal = {
    id: 'normal',
    title: 'Dune',
    physicalFormat: 'paperback',
    isbn13: '9780441172719',
  };

  for (const title of [
    'Dune Large Print',
    'Dune Box Set',
    'Dune Omnibus',
    'Dune Study Guide',
    'Dune Summary',
    'Dune Adaptation',
    'Dune Movie Tie-In',
  ]) {
    assert.equal(
      selectRepresentativeEdition(
        [normal, { id: title, title, physicalFormat: 'hardcover' }],
        context,
      )?.id,
      'normal',
      title,
    );
  }
});

test('hardcover beats paperback, and paperback beats ebook', () => {
  const editions: EditionCandidate[] = [
    { id: 'ebook', title: 'Dune', physicalFormat: 'ebook', isbn13: '9780000000002' },
    { id: 'paperback', title: 'Dune', physicalFormat: 'trade paperback', isbn13: '9780000000003' },
    { id: 'hardcover', title: 'Dune', physicalFormat: 'hardcover', isbn13: '9780000000004' },
  ];

  assert.equal(selectRepresentativeEdition(editions, context)?.id, 'hardcover');
  assert.equal(
    selectRepresentativeEdition(editions.slice(0, 2), context)?.id,
    'paperback',
  );
});

test('audio remains valid for an audiobook_original work', () => {
  const edition = selectRepresentativeEdition(
    [
      { id: 'ebook', title: 'Sterrennacht', physicalFormat: 'ebook' },
      {
        id: 'audio',
        title: 'Sterrennacht',
        physicalFormat: 'audiobook',
        isbn13: '9789046176368',
      },
    ],
    {
      workTitle: 'Sterrennacht',
      workType: 'audiobook_original',
      preferredLanguages: ['nld'],
    },
  );

  assert.equal(edition?.id, 'audio');
});

test('edition year never replaces the work first-publication year', () => {
  const edition = selectRepresentativeEdition(
    [
      {
        id: '2019-hardcover',
        title: 'Dune',
        physicalFormat: 'hardcover',
        publishDate: '2019',
      },
    ],
    context,
  );

  assert.equal(edition?.publishDate, '2019');
  assert.equal(getWorkFirstPublishYear(1965), 1965);
});

test('cover source may differ from the representative edition', () => {
  const hardcover = {
    id: 'representative',
    title: 'Dune',
    physicalFormat: 'hardcover',
  };
  const paperbackWithCover = {
    id: 'cover',
    title: 'Dune',
    physicalFormat: 'paperback',
    coverIds: [284504],
  };

  assert.equal(
    selectRepresentativeEdition([hardcover, paperbackWithCover], context)?.id,
    'representative',
  );
  assert.equal(
    selectCoverEdition([hardcover, paperbackWithCover], context)?.id,
    'cover',
  );
});

test('NL locale prefers a verified Dutch edition over English and Portuguese editions', () => {
  const editions: EditionCandidate[] = [
    { id: 'por', title: 'Harry Potter e a Pedra Filosofal', physicalFormat: 'paperback', languageCodes: ['por'], isbn13: '9780000000011', coverIds: [11] },
    { id: 'eng', title: "Harry Potter and the Philosopher's Stone", physicalFormat: 'hardcover', languageCodes: ['eng'], isbn13: '9780000000012', coverIds: [12] },
    { id: 'nld', title: 'Harry Potter en de Steen der Wijzen', physicalFormat: 'paperback', languageCodes: ['nld'], isbn13: '9780000000013', coverIds: [13] },
  ];
  const localeContext = {
    workTitle: "Harry Potter and the Philosopher's Stone",
    preferredLanguages: getPreferredEditionLanguages('nl'),
  };

  assert.equal(selectRepresentativeEdition(editions, localeContext)?.id, 'nld');
  assert.equal(selectCoverEdition(editions, localeContext)?.id, 'nld');
});

test('EN locale prefers English and never lets Portuguese beat it', () => {
  const editions: EditionCandidate[] = [
    { id: 'por', title: 'Harry Potter e a Pedra Filosofal', physicalFormat: 'hardcover', languageCodes: ['por'], isbn13: '9780000000021' },
    { id: 'eng', title: "Harry Potter and the Philosopher's Stone", physicalFormat: 'paperback', languageCodes: ['eng'], isbn13: '9780000000022' },
  ];

  assert.equal(selectRepresentativeEdition(editions, {
    workTitle: "Harry Potter and the Philosopher's Stone",
    preferredLanguages: getPreferredEditionLanguages('en'),
  })?.id, 'eng');
});

test('native works retain Dutch-first edition preference', () => {
  assert.deepEqual(getPreferredEditionLanguages('en', 'lumiscore_native'), ['nld', 'eng']);
  assert.deepEqual(getPreferredEditionLanguages('nl', 'lumiscore_native'), ['nld', 'eng']);
});
