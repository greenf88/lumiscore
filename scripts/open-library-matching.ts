export type BookMatchSeed = {
  title: string;
  author?: string;
  firstPublishYear?: number;
  alternateTitles?: string[];
  preferredDisplayTitle?: string;
  expectedOpenLibraryWorkId?: string;
  expectedOpenLibraryAuthorId?: string;
  expectedIsbn13?: string;
};

export type OpenLibrarySearchDocument = {
  key?: string;
  title?: string;
  subtitle?: string;
  author_key?: string[];
  author_name?: string[];
  first_publish_year?: number;
  edition_count?: number;
};

const DERIVATIVE_PHRASES = [
  'abridged',
  'adaptation',
  'analysis',
  'box set',
  'classicnotes',
  'companion',
  'graphic novel',
  'gradesaver',
  'illustrated adaptation',
  'movie tie in',
  'readers guide',
  'screenplay',
  'sparknotes',
  'study guide',
  'summaries',
  'summary',
  'teachers guide',
  'workbook',
] as const;

export function normalizeMatchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, ' ')
    .trim()
    .toLowerCase();
}

export function matchesExpectedAuthor(
  actual: string,
  expected: string,
): boolean {
  const actualName = normalizeMatchText(actual).replace(/ author$/, '');
  const expectedName = normalizeMatchText(expected).replace(/ author$/, '');

  return actualName === expectedName;
}

function normalizeOpenLibraryWorkId(value: string | undefined): string {
  return value?.split('/').filter(Boolean).at(-1)?.toUpperCase() ?? '';
}

export function completePinnedWorkMetadata(
  seed: BookMatchSeed,
  document: OpenLibrarySearchDocument,
): OpenLibrarySearchDocument {
  if (
    !seed.expectedOpenLibraryWorkId ||
    !seed.expectedOpenLibraryAuthorId ||
    !matchesExpectedWorkId(seed, document)
  ) {
    return document;
  }

  const authorId = seed.expectedOpenLibraryAuthorId.toUpperCase();
  if (!/^OL\d+A$/.test(authorId)) return document;
  return {
    ...document,
    title: document.title?.trim() || seed.title,
    // This is an explicit reviewed override tied to an exact pinned Work.
    // Open Library occasionally credits a legal name while the series is
    // published under a pen name (for example Robert Galbraith). In that case
    // retaining the otherwise complete source metadata would create the wrong
    // LumiScore author relationship.
    author_key: [authorId],
    author_name: [seed.author ?? ''],
    first_publish_year:
      document.first_publish_year ?? seed.firstPublishYear,
  };
}

export function matchesExpectedWorkId(
  seed: BookMatchSeed,
  document: OpenLibrarySearchDocument,
): boolean {
  if (!seed.expectedOpenLibraryWorkId) return true;

  return (
    normalizeOpenLibraryWorkId(document.key) ===
    normalizeOpenLibraryWorkId(seed.expectedOpenLibraryWorkId)
  );
}

export function getWorkDisplayTitle(
  seed: BookMatchSeed,
  document: OpenLibrarySearchDocument,
): string {
  const preferredTitle = seed.preferredDisplayTitle?.trim();
  const openLibraryTitle = document.title?.trim();

  if (preferredTitle) return preferredTitle;
  if (openLibraryTitle) return openLibraryTitle;

  throw new Error(`Open Library returned no title for “${seed.title}”.`);
}

function titleScore(seed: BookMatchSeed, document: OpenLibrarySearchDocument) {
  const actualTitle = normalizeMatchText(document.title ?? '');
  const expectedTitles = [seed.title, ...(seed.alternateTitles ?? [])].map(
    normalizeMatchText,
  );

  if (expectedTitles.includes(actualTitle)) return 1_000;

  return expectedTitles.some(
    (expected) =>
      actualTitle.startsWith(`${expected} `) ||
      actualTitle.endsWith(` ${expected}`) ||
      actualTitle.includes(` ${expected} `),
  )
    ? 100
    : 0;
}

function authorScore(seed: BookMatchSeed, document: OpenLibrarySearchDocument) {
  if (!seed.author) return 0;

  return document.author_name?.some((author) =>
    matchesExpectedAuthor(author, seed.author!),
  )
    ? 450
    : -350;
}

function publishYearScore(
  seed: BookMatchSeed,
  document: OpenLibrarySearchDocument,
) {
  if (!seed.firstPublishYear || !document.first_publish_year) return 0;

  const difference = Math.abs(
    seed.firstPublishYear - document.first_publish_year,
  );
  if (difference === 0) return 500;
  if (difference === 1) return 300;
  if (difference <= 3) return 100;

  return -Math.min(900, difference * 60);
}

function derivativePenalty(
  seed: BookMatchSeed,
  document: OpenLibrarySearchDocument,
) {
  const actual = normalizeMatchText(
    `${document.title ?? ''} ${document.subtitle ?? ''}`,
  );
  const expected = normalizeMatchText(seed.title);
  const unexpectedDerivative = DERIVATIVE_PHRASES.some(
    (phrase) => actual.includes(phrase) && !expected.includes(phrase),
  );

  return unexpectedDerivative ? -1_500 : 0;
}

function editionCountScore(document: OpenLibrarySearchDocument) {
  const editionCount = Math.max(0, document.edition_count ?? 0);
  return Math.min(180, Math.round(Math.log2(editionCount + 1) * 20));
}

export function scoreWorkMatch(
  seed: BookMatchSeed,
  document: OpenLibrarySearchDocument,
): number {
  if (!matchesExpectedWorkId(seed, document)) {
    return Number.NEGATIVE_INFINITY;
  }

  return (
    titleScore(seed, document) +
    authorScore(seed, document) +
    publishYearScore(seed, document) +
    derivativePenalty(seed, document) +
    editionCountScore(document)
  );
}

export function selectBestWorkMatch(
  seed: BookMatchSeed,
  documents: OpenLibrarySearchDocument[],
): OpenLibrarySearchDocument {
  const ranked = documents
    .map((document, searchIndex) => ({
      document,
      score: scoreWorkMatch(seed, document),
      searchIndex,
    }))
    .filter(({ document }) => Boolean(document.key && document.title))
    .sort(
      (left, right) =>
        right.score - left.score || left.searchIndex - right.searchIndex,
    );

  const best = ranked[0];
  if (!best || best.score <= 0) {
    throw new Error(`No trustworthy Open Library work found for “${seed.title}”.`);
  }

  return best.document;
}
