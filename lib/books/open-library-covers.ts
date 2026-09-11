import {
  getOpenLibraryCoverIdUrl,
  getOpenLibraryCoverUrl,
  normalizeIsbn13,
  normalizeOpenLibraryId,
  uniqueCoverUrls,
} from './covers.ts';
import {
  rankEditionsForCover,
  type EditionCandidate,
} from './edition-ranking.ts';
import {
  resolvedCover,
  unresolvedCover,
  type CoverResolutionState,
  type CoverSourceResolution,
} from './cover-resolution-result.ts';

type OpenLibraryEdition = {
  key?: string;
  title?: string;
  subtitle?: string;
  physical_format?: string;
  isbn_10?: unknown;
  isbn_13?: unknown;
  languages?: Array<{ key?: string }>;
  publish_date?: string;
  publishers?: string[];
  covers?: unknown;
};

type OpenLibraryWork = {
  covers?: unknown;
};

type OpenLibraryEditionsResult = {
  entries?: OpenLibraryEdition[];
  size?: number;
};

type OpenLibrarySearchDocument = {
  title?: string;
  author_name?: string[];
  first_publish_year?: number;
  language?: string[];
  cover_i?: number;
};

type OpenLibraryFetchResult<T> =
  | { state: 'ok'; data: T }
  | {
      state: Exclude<CoverResolutionState, 'resolved'>;
      data: null;
    };

export type OpenLibraryCoverLookup = {
  workId: string;
  title: string;
  author: string;
  firstPublishYear?: number | null;
  preferredLanguages?: readonly string[];
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

type CoverRankedEdition = EditionCandidate & { row: OpenLibraryEdition };

function toCoverRankedEdition(
  edition: OpenLibraryEdition,
): CoverRankedEdition {
  return {
    row: edition,
    openLibraryEditionId: edition.key ?? null,
    title: edition.title ?? null,
    subtitle: edition.subtitle ?? null,
    physicalFormat: edition.physical_format ?? null,
    languageCodes: (edition.languages ?? [])
      .map((language) => language.key ?? '')
      .filter(Boolean),
    isbn10: Array.isArray(edition.isbn_10)
      ? edition.isbn_10.filter((isbn): isbn is string => typeof isbn === 'string')
      : [],
    isbn13: asIsbn13s(edition.isbn_13),
    publishDate: edition.publish_date ?? null,
    publishers: edition.publishers ?? [],
    coverIds: asPositiveCoverIds(edition.covers),
  };
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

async function fetchOpenLibraryJson<T>(
  url: URL,
): Promise<OpenLibraryFetchResult<T>> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: OPEN_LIBRARY_HEADERS,
        signal: AbortSignal.timeout(10_000),
      });

      if (response.ok) {
        return { state: 'ok', data: (await response.json()) as T };
      }
      if (response.status === 404 || response.status === 410) {
        return { state: 'confirmed_missing', data: null };
      }
    } catch {
      // Retry transient Open Library/network failures below.
    }

    await new Promise((resolve) => setTimeout(resolve, 350 * 2 ** attempt));
  }

  return { state: 'temporary_failure', data: null };
}

async function fetchWorkEditions(workId: string): Promise<{
  editions: OpenLibraryEdition[];
  state: 'ok' | Exclude<CoverResolutionState, 'resolved'>;
}> {
  const editions: OpenLibraryEdition[] = [];
  const pageSize = 100;
  let state: 'ok' | Exclude<CoverResolutionState, 'resolved'> = 'ok';

  for (let offset = 0; offset < 500; offset += pageSize) {
    const editionsUrl = new URL(
      `/works/${workId}/editions.json?limit=${pageSize}&offset=${offset}`,
      OPEN_LIBRARY_BASE_URL,
    );
    const page =
      await fetchOpenLibraryJson<OpenLibraryEditionsResult>(editionsUrl);
    if (page.state !== 'ok') {
      state = page.state;
      break;
    }
    const entries = page.data.entries ?? [];
    editions.push(...entries);

    const foundSameWorkCover = editions.some(
      (edition) => asPositiveCoverIds(edition.covers).length > 0,
    );
    if (
      foundSameWorkCover ||
      entries.length < pageSize ||
      editions.length >= (page.data.size ?? 0)
    ) {
      break;
    }
  }

  return { editions, state };
}

async function findExactSearchCover(
  lookup: OpenLibraryCoverLookup,
): Promise<{
  coverUrl: string | null;
  state: 'ok' | Exclude<CoverResolutionState, 'resolved'>;
}> {
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
  if (result.state !== 'ok') {
    return { coverUrl: null, state: result.state };
  }
  const match = [...(result.data.docs ?? [])]
    .map((document) => ({
      document,
      score: searchDocumentScore(document, lookup),
    }))
    .filter((candidate) => Number.isFinite(candidate.score))
    .sort((left, right) => right.score - left.score)[0]?.document;

  const coverUrl = getOpenLibraryCoverIdUrl(match?.cover_i);
  return {
    coverUrl,
    state: coverUrl ? 'ok' : 'confirmed_missing',
  };
}

export async function resolveOpenLibraryCoverResult(
  lookup: OpenLibraryCoverLookup,
): Promise<{
  resolution: CoverSourceResolution;
  coverUrls: string[];
}> {
  const workId = normalizeOpenLibraryId(lookup.workId, 'work');
  if (!workId) {
    return {
      resolution: unresolvedCover(
        'open_library',
        lookup.workId || 'invalid-work-id',
        'confirmed_missing',
      ),
      coverUrls: [],
    };
  }

  const workUrl = new URL(`/works/${workId}.json`, OPEN_LIBRARY_BASE_URL);
  const [work, editionsResult] = await Promise.all([
    fetchOpenLibraryJson<OpenLibraryWork>(workUrl),
    fetchWorkEditions(workId),
  ]);
  const editions = rankEditionsForCover(
    editionsResult.editions.map(toCoverRankedEdition),
    {
      workTitle: lookup.title,
      firstPublishYear: lookup.firstPublishYear,
      preferredLanguages: lookup.preferredLanguages ?? ['eng'],
    },
  ).map((edition) => edition.row);

  const coveredEditionUrls = editions.flatMap((edition) => {
    if (asIsbn13s(edition.isbn_13).length === 0) return [];

    return asPositiveCoverIds(edition.covers).map(getOpenLibraryCoverIdUrl);
  });
  const otherEditionCoverUrls = editions.flatMap((edition) =>
    asPositiveCoverIds(edition.covers).map(getOpenLibraryCoverIdUrl),
  );
  const workCoverUrls = asPositiveCoverIds(
    work.state === 'ok' ? work.data.covers : null,
  ).map(
    getOpenLibraryCoverIdUrl,
  );

  const knownCoverUrls = uniqueCoverUrls([
    ...coveredEditionUrls,
    ...otherEditionCoverUrls,
    ...workCoverUrls,
  ]);
  if (knownCoverUrls.length > 0) {
    const coverUrls = knownCoverUrls.slice(0, 12);
    return {
      resolution: resolvedCover('open_library', workId, coverUrls[0]),
      coverUrls,
    };
  }

  const alternateIsbnUrls = uniqueCoverUrls(
    editions.flatMap((edition) =>
      asIsbn13s(edition.isbn_13).map(getOpenLibraryCoverUrl),
    ),
  ).slice(0, 4);
  const exactSearchCover = await findExactSearchCover(lookup);

  const coverUrls = uniqueCoverUrls([
    ...alternateIsbnUrls,
    exactSearchCover.coverUrl,
  ]).slice(0, 5);
  if (coverUrls.length > 0) {
    return {
      resolution: resolvedCover('open_library', workId, coverUrls[0]),
      coverUrls,
    };
  }

  const temporaryFailure =
    work.state === 'temporary_failure' ||
    editionsResult.state === 'temporary_failure' ||
    exactSearchCover.state === 'temporary_failure';
  return {
    resolution: unresolvedCover(
      'open_library',
      workId,
      temporaryFailure ? 'temporary_failure' : 'confirmed_missing',
    ),
    coverUrls: [],
  };
}

export async function resolveOpenLibraryCoverCandidates(
  lookup: OpenLibraryCoverLookup,
): Promise<string[]> {
  return (await resolveOpenLibraryCoverResult(lookup)).coverUrls;
}
