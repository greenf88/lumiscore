import {
  getOpenLibraryCoverIdUrl,
  getOpenLibraryCoverUrl,
  normalizeIsbn13,
  normalizeOpenLibraryId,
  uniqueCoverUrls,
} from './covers.ts';

type OpenLibraryEdition = {
  key?: string;
  isbn_13?: unknown;
  languages?: Array<{ key?: string }>;
  covers?: unknown;
};

type OpenLibraryWork = {
  covers?: unknown;
};

type OpenLibrarySearchDocument = {
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  language?: string[];
  cover_i?: number;
};

export type OpenLibraryCoverLookup = {
  workId: string;
  title: string;
  author: string;
  firstPublishYear?: number | null;
};

const OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org';
const OPEN_LIBRARY_HEADERS = {
  Accept: 'application/json',
  'User-Agent':
    'LumiScoreCoverResolver/1.0 (https://lumiscore.greenf88.chatgpt.site)',
};

function asPositiveCoverIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (candidate): candidate is number =>
      typeof candidate === 'number' &&
      Number.isSafeInteger(candidate) &&
      candidate > 0,
  );
}

function asIsbn13s(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((candidate) =>
      typeof candidate === 'string' ? normalizeIsbn13(candidate) : null,
    )
    .filter((isbn): isbn is string => isbn !== null);
}

function isEnglishEdition(edition: OpenLibraryEdition): boolean {
  return Boolean(
    edition.languages?.some((language) => language.key === '/languages/eng'),
  );
}

function editionScore(edition: OpenLibraryEdition): number {
  const hasIsbn13 = asIsbn13s(edition.isbn_13).length > 0;
  const hasKnownCover = asPositiveCoverIds(edition.covers).length > 0;

  return (
    (hasIsbn13 && hasKnownCover ? 1_000 : 0) +
    (isEnglishEdition(edition) ? 100 : 0) +
    (hasIsbn13 ? 20 : 0) +
    (hasKnownCover ? 10 : 0)
  );
}

function normalizeText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
    .toLocaleLowerCase('en');
}

function searchDocumentScore(
  document: OpenLibrarySearchDocument,
  lookup: OpenLibraryCoverLookup,
): number {
  if (
    !document.cover_i ||
    normalizeText(document.title ?? '') !== normalizeText(lookup.title)
  ) {
    return Number.NEGATIVE_INFINITY;
  }

  const expectedAuthor = normalizeText(lookup.author);
  const exactAuthor = document.author_name?.some(
    (author) => normalizeText(author) === expectedAuthor,
  );
  const isEnglish = document.language?.includes('eng');
  const yearDifference =
    lookup.firstPublishYear && document.first_publish_year
      ? Math.abs(lookup.firstPublishYear - document.first_publish_year)
      : 100;

  return (
    (exactAuthor ? 1_000 : 0) +
    (isEnglish ? 100 : 0) +
    Math.max(0, 50 - Math.min(50, yearDifference))
  );
}

async function fetchOpenLibraryJson<T>(url: URL): Promise<T | null> {
  try {
    const response = await fetch(url, {
      headers: OPEN_LIBRARY_HEADERS,
      signal: AbortSignal.timeout(8_000),
    });

    return response.ok ? ((await response.json()) as T) : null;
  } catch {
    return null;
  }
}

async function findExactSearchCover(
  lookup: OpenLibraryCoverLookup,
): Promise<string | null> {
  const searchUrl = new URL('/search.json', OPEN_LIBRARY_BASE_URL);
  searchUrl.search = new URLSearchParams({
    title: lookup.title,
    author: lookup.author,
    fields: 'title,author_name,first_publish_year,language,cover_i',
    limit: '20',
  }).toString();

  const result = await fetchOpenLibraryJson<{
    docs?: OpenLibrarySearchDocument[];
  }>(searchUrl);
  const match = [...(result?.docs ?? [])]
    .map((document) => ({
      document,
      score: searchDocumentScore(document, lookup),
    }))
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((left, right) => right.score - left.score)[0]?.document;

  return getOpenLibraryCoverIdUrl(match?.cover_i);
}

export async function resolveOpenLibraryCoverCandidates(
  lookup: OpenLibraryCoverLookup,
): Promise<string[]> {
  const workId = normalizeOpenLibraryId(lookup.workId, 'work');
  if (!workId) return [];

  const workUrl = new URL(`/works/${workId}.json`, OPEN_LIBRARY_BASE_URL);
  const editionsUrl = new URL(
    `/works/${workId}/editions.json?limit=100`,
    OPEN_LIBRARY_BASE_URL,
  );
  const [work, editionsResult] = await Promise.all([
    fetchOpenLibraryJson<OpenLibraryWork>(workUrl),
    fetchOpenLibraryJson<{ entries?: OpenLibraryEdition[] }>(editionsUrl),
  ]);
  const editions = [...(editionsResult?.entries ?? [])].sort(
    (left, right) => editionScore(right) - editionScore(left),
  );

  const coveredEditionUrls = editions.flatMap((edition) => {
    if (asIsbn13s(edition.isbn_13).length === 0) return [];

    return asPositiveCoverIds(edition.covers).map(getOpenLibraryCoverIdUrl);
  });
  const otherEditionCoverUrls = editions.flatMap((edition) =>
    asPositiveCoverIds(edition.covers).map(getOpenLibraryCoverIdUrl),
  );
  const workCoverUrls = asPositiveCoverIds(work?.covers).map(
    getOpenLibraryCoverIdUrl,
  );

  const knownCoverUrls = uniqueCoverUrls([
    ...coveredEditionUrls,
    ...otherEditionCoverUrls,
    ...workCoverUrls,
  ]);
  if (knownCoverUrls.length > 0) return knownCoverUrls.slice(0, 12);

  const alternateIsbnUrls = uniqueCoverUrls(
    editions.flatMap((edition) =>
      asIsbn13s(edition.isbn_13).map(getOpenLibraryCoverUrl),
    ),
  ).slice(0, 4);
  const exactSearchCover = await findExactSearchCover(lookup);

  return uniqueCoverUrls([...alternateIsbnUrls, exactSearchCover]).slice(0, 5);
}
