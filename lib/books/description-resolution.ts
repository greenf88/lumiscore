import type { VerifiedBookDescription } from '@/app/data/books';
import { normalizeOpenLibraryId } from './covers.ts';
import { normalizeBookDescription } from './description-text.ts';
import { normalizeEditionLanguage } from './edition-ranking.ts';
import { normalizeVerifiedIsbn13 } from './google-books-covers.ts';
import type { Locale } from '../i18n/config.ts';
import { readServerEnvironment } from '../server-environment.ts';
import { getReviewedDescription } from './reviewed-descriptions.ts';
import { sourceDescriptionLocale } from './description-language.ts';

export type DescriptionResolutionState =
  | 'resolved'
  | 'confirmed_missing'
  | 'temporary_failure';

export type BookDescriptionLookup = {
  workId?: string | null;
  editionId?: string | null;
  author?: string | null;
  openLibraryWorkId?: string | null;
  openLibraryEditionId?: string | null;
  isbn13?: string | null;
  editionLanguage?: string | null;
  editionTitle?: string | null;
  editionCandidates?: ReadonlyArray<{
    openLibraryEditionId?: string | null;
    isbn13?: string | null;
    editionLanguage?: string | null;
  }>;
  locale?: Locale;
};

export type BookDescriptionResolution = {
  state: DescriptionResolutionState;
  description: VerifiedBookDescription | null;
};

type OpenLibraryWorkResponse = {
  description?: string | { value?: unknown } | null;
  languages?: Array<{ key?: string }>;
};

type OpenLibraryEditionResponse = OpenLibraryWorkResponse & {
  works?: Array<{ key?: string }>;
  title?:string; isbn_13?:string[];
};

type GoogleBooksVolume = {
  volumeInfo?: {
    title?: string;
    authors?: string[];
    description?: unknown;
    industryIdentifiers?: Array<{ type?: string; identifier?: string }>;
    language?: unknown;
  };
};

type GoogleBooksResponse = {
  items?: GoogleBooksVolume[];
};

const OPEN_LIBRARY_BASE_URL = 'https://openlibrary.org';
const GOOGLE_BOOKS_URL = 'https://www.googleapis.com/books/v1/volumes';
const SUCCESS_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
// Unknown/unsuitable source text is not durable evidence of missing content.
// Align negative process caching with the public five-minute correction window.
const CONFIRMED_MISSING_TTL_MS = 5 * 60 * 1_000;
const TEMPORARY_FAILURE_TTL_MS = 2 * 60 * 1_000;
const MAX_CACHE_ENTRIES = 2_000;
const RETRY_DELAYS_MS = [100, 250] as const;

type CachedResolution = {
  expiresAt: number;
  result: Promise<BookDescriptionResolution>;
};

const descriptionCache = new Map<string, CachedResolution>();

function resultTtl(state: DescriptionResolutionState): number {
  return state === 'resolved'
    ? SUCCESS_TTL_MS
    : state === 'confirmed_missing'
      ? CONFIRMED_MISSING_TTL_MS
      : TEMPORARY_FAILURE_TTL_MS;
}

function cachedResolution(
  key: string,
  loader: () => Promise<BookDescriptionResolution>,
): Promise<BookDescriptionResolution> {
  const now = Date.now();
  const cached = descriptionCache.get(key);
  if (cached && cached.expiresAt > now) return cached.result;
  if (cached) descriptionCache.delete(key);

  if (descriptionCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = descriptionCache.keys().next().value;
    if (oldestKey) descriptionCache.delete(oldestKey);
  }

  const result = loader()
    .then((resolution) => {
      descriptionCache.set(key, {
        expiresAt: Date.now() + resultTtl(resolution.state),
        result: Promise.resolve(resolution),
      });
      return resolution;
    })
    .catch(() => {
      const resolution: BookDescriptionResolution = {
        state: 'temporary_failure',
        description: null,
      };
      descriptionCache.set(key, {
        expiresAt: Date.now() + TEMPORARY_FAILURE_TTL_MS,
        result: Promise.resolve(resolution),
      });
      return resolution;
    });
  descriptionCache.set(key, {
    expiresAt: now + TEMPORARY_FAILURE_TTL_MS,
    result,
  });
  return result;
}

async function fetchJsonWithRetry<T>(
  url: URL,
  fetchImplementation: typeof fetch,
): Promise<{ state: 'ok'; data: T } | { state: Exclude<DescriptionResolutionState, 'resolved'>; data: null }> {
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt += 1) {
    try {
      const response = await fetchImplementation(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8_000),
      });
      if (response.ok) return { state: 'ok', data: (await response.json()) as T };
      if (response.status === 404 || response.status === 410) {
        return { state: 'confirmed_missing', data: null };
      }
      if (attempt < RETRY_DELAYS_MS.length && response.status >= 500) {
        await response.body?.cancel();
        await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
        continue;
      }
      return { state: 'temporary_failure', data: null };
    } catch (error) {
      // An exhausted request budget is not a transient HTTP response. Retrying
      // an already-aborted source only delays the error state and cannot recover.
      if (error instanceof Error && ['AbortError', 'TimeoutError'].includes(error.name)) break;
      if (attempt >= RETRY_DELAYS_MS.length) break;
      await new Promise((resolve) => setTimeout(resolve, RETRY_DELAYS_MS[attempt]));
    }
  }
  return { state: 'temporary_failure', data: null };
}

function resolvedDescription(
  text: string,
  source: VerifiedBookDescription['source'],
  sourceKey: string,
  language: Locale | null,
): BookDescriptionResolution {
  return {
    state: 'resolved',
    description: {
      text,
      source,
      sourceKey,
      verifiedAt: new Date().toISOString(),
      language,
    },
  };
}

function localeFromLanguage(value: unknown): Locale | null {
  if (typeof value !== 'string') return null;
  const normalized = normalizeEditionLanguage(value);
  if (normalized === 'nld') return 'nl';
  if (normalized === 'eng') return 'en';
  return null;
}

function openLibraryLanguages(value: OpenLibraryWorkResponse['languages']): Locale[] {
  return [...new Set((value ?? []).flatMap(({ key }) => {
    const language = localeFromLanguage(key);
    return language ? [language] : [];
  }))];
}

function mergeResolutionState(
  states: readonly (DescriptionResolutionState | null)[],
): Exclude<DescriptionResolutionState, 'resolved'> {
  return states.includes('temporary_failure')
    ? 'temporary_failure'
    : 'confirmed_missing';
}

function resolveOpenLibraryEditionDescription(
  editionId: string,
  workId: string | null,
  locale: Locale,
  fetchImplementation: typeof fetch,
  identity?:{title?:string|null;isbn?:string|null},
): Promise<BookDescriptionResolution> {
  return cachedResolution(`edition_description_v4:${editionId}:${workId}:${locale}:${identity?.isbn??''}:${identity?.title??''}`, async () => {
    const url = new URL(`/books/${editionId}.json`, OPEN_LIBRARY_BASE_URL);
    const response = await fetchJsonWithRetry<OpenLibraryEditionResponse>(url, fetchImplementation);
    if (response.state !== 'ok') return { state: response.state, description: null };

    const parentWorkIds = (response.data.works ?? []).flatMap(({ key }) =>
      normalizeOpenLibraryId(key, 'work') ?? []);
    if (workId && (parentWorkIds.length!==1 || parentWorkIds[0]!==workId)) {
      return { state: 'confirmed_missing', description: null };
    }
    if (response.data.languages?.length!==1 || !openLibraryLanguages(response.data.languages).includes(locale)) {
      return { state: 'confirmed_missing', description: null };
    }
    const title=(s:string)=>s.normalize('NFKC').trim().replace(/\s+/g,' ').toLocaleLowerCase('en');
    if(identity?.title&&(!response.data.title||title(identity.title)!==title(response.data.title)))return {state:'confirmed_missing',description:null};
    if(identity?.isbn&&!response.data.isbn_13?.some(i=>normalizeVerifiedIsbn13(i)===identity.isbn))return {state:'confirmed_missing',description:null};
    const text = normalizeBookDescription(response.data.description);
    return text && sourceDescriptionLocale(text) === locale
      ? resolvedDescription(text, 'open_library', editionId, locale)
      : { state: 'confirmed_missing', description: null };
  });
}

function resolveGoogleBooksDescription(
  isbn13: string,
  locale: Locale,
  fetchImplementation: typeof fetch,
  identity:{title?:string|null;author?:string|null}={},
): Promise<BookDescriptionResolution> {
  return cachedResolution(`google_books_v3:${isbn13}:${locale}:${identity.title??''}:${identity.author??''}`, async () => {
    const url = new URL(GOOGLE_BOOKS_URL);
    url.searchParams.set('q', `isbn:${isbn13}`);
    url.searchParams.set('maxResults', '5');
    url.searchParams.set('projection', 'full');
    const apiKey = readServerEnvironment('GOOGLE_BOOKS_API_KEY');
    if (apiKey) url.searchParams.set('key', apiKey);

    const response = await fetchJsonWithRetry<GoogleBooksResponse>(url, fetchImplementation);
    if (response.state !== 'ok') return { state: response.state, description: null };
    const normalized=(s:string)=>s.normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]/gu,'');
    const exactVolume = (response.data.items ?? []).find((volume) =>
      localeFromLanguage(volume.volumeInfo?.language) === locale &&
      (!identity.title || Boolean(volume.volumeInfo?.title && normalized(volume.volumeInfo.title)===normalized(identity.title))) &&
      (!identity.author || Boolean(volume.volumeInfo?.authors?.some(a=>normalized(a)===normalized(identity.author!)))) &&
      volume.volumeInfo?.industryIdentifiers?.some(
        ({ type, identifier }) =>
          type === 'ISBN_13' && normalizeVerifiedIsbn13(identifier) === isbn13,
      ),
    );
    if (!exactVolume) return { state: 'confirmed_missing', description: null };
    const text = normalizeBookDescription(exactVolume.volumeInfo?.description);
    return text && sourceDescriptionLocale(text) === locale
      ? resolvedDescription(text, 'google_books', isbn13, locale)
      : { state: 'confirmed_missing', description: null };
  });
}

export async function resolveBookDescription(
  lookup: BookDescriptionLookup,
  fetchImplementation: typeof fetch = fetch,
): Promise<BookDescriptionResolution> {
  const locale = lookup.locale ?? 'en';
  // Interface, edition and synopsis language are independent facts. Under the
  // current strict policy only an exact-locale synopsis may be displayed.
  const descriptionLanguage:Locale = locale;
  if(lookup.editionLanguage!=null&&localeFromLanguage(lookup.editionLanguage)!==locale)return {state:'confirmed_missing',description:null};
  const reviewed = getReviewedDescription(lookup, descriptionLanguage);
  if (reviewed) return { state: 'resolved', description: reviewed };
  const workId = normalizeOpenLibraryId(lookup.openLibraryWorkId, 'work');
  const candidates = [
    {
      openLibraryEditionId: lookup.openLibraryEditionId,
      isbn13: lookup.isbn13,
      editionLanguage: lookup.editionLanguage,
    },
    ...(lookup.editionCandidates ?? []),
  ]
    .map((candidate) => ({
      editionId: normalizeOpenLibraryId(candidate.openLibraryEditionId, 'edition'),
      isbn13: normalizeVerifiedIsbn13(candidate.isbn13),
      editionLanguage: candidate.editionLanguage ?? null,
      locale: localeFromLanguage(candidate.editionLanguage),
    }))
    .filter((candidate, index, values) =>
      Boolean(candidate.editionId || candidate.isbn13) &&
      values.findIndex((other) =>
        other.editionId === candidate.editionId && other.isbn13 === candidate.isbn13) === index)
    .slice(0, 3);
  const states: Array<DescriptionResolutionState | null> = [];

  for (const candidate of candidates) {
    if (candidate.locale && candidate.locale !== descriptionLanguage) continue;
    if (candidate.editionId) {
      const openLibraryEdition = await resolveOpenLibraryEditionDescription(
        candidate.editionId,
        workId,
        descriptionLanguage,
        fetchImplementation,
        {title:lookup.editionTitle,isbn:candidate.isbn13},
      );
      if (openLibraryEdition.description) return openLibraryEdition;
      states.push(openLibraryEdition.state);
    }
    if (candidate.isbn13) {
      const googleBooks = await resolveGoogleBooksDescription(
        candidate.isbn13,
        descriptionLanguage,
        fetchImplementation,
        {title:lookup.editionTitle,author:lookup.author},
      );
      if (googleBooks.description) return googleBooks;
      states.push(googleBooks.state);
    }
  }
  // Work-level languages describe editions, not the language of a shared
  // synopsis. Do not relabel that synopsis as Dutch; require exact edition
  // or ISBN language evidence above, otherwise show the localized fallback.
  return {
    state: mergeResolutionState(states),
    description: null,
  };
}

export function clearBookDescriptionCacheForTests(): void {
  descriptionCache.clear();
}
