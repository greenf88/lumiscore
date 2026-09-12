import { normalizeIsbn13 } from './covers.ts';
import { readServerEnvironment } from '../server-environment.ts';
import {
  resolvedCover,
  unresolvedCover,
  type CoverSourceResolution,
} from './cover-resolution-result.ts';

type GoogleBooksImageLinks = Partial<
  Record<
    | 'extraLarge'
    | 'large'
    | 'medium'
    | 'small'
    | 'thumbnail'
    | 'smallThumbnail',
    string
  >
>;

type GoogleBooksVolume = {
  volumeInfo?: {
    industryIdentifiers?: Array<{ type?: string; identifier?: string }>;
    imageLinks?: GoogleBooksImageLinks;
  };
};

type GoogleBooksResponse = {
  items?: GoogleBooksVolume[];
};

const GOOGLE_BOOKS_URL = 'https://www.googleapis.com/books/v1/volumes';
const SUCCESS_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const FAILURE_TTL_MS = 24 * 60 * 60 * 1_000;
const TEMPORARY_FAILURE_TTL_MS = 5 * 60 * 1_000;
const MAX_CACHE_ENTRIES = 2_000;
const RATE_LIMIT_BACKOFF_MS = 5 * 60 * 1_000;
const SERVICE_UNAVAILABLE_RETRY_DELAYS_MS = [100, 250] as const;
let unavailableUntil = 0;
const coverCache = new Map<
  string,
  { expiresAt: number; result: Promise<CoverSourceResolution> }
>();

function hasValidIsbn13Checksum(isbn13: string): boolean {
  const total = [...isbn13].reduce(
    (sum, digit, index) => sum + Number(digit) * (index % 2 === 0 ? 1 : 3),
    0,
  );
  return total % 10 === 0;
}

export function normalizeVerifiedIsbn13(
  value: string | null | undefined,
): string | null {
  const isbn13 = normalizeIsbn13(value);
  return isbn13 && hasValidIsbn13Checksum(isbn13) ? isbn13 : null;
}

function volumeHasExactIsbn13(
  volume: GoogleBooksVolume,
  requestedIsbn13: string,
): boolean {
  return Boolean(
    volume.volumeInfo?.industryIdentifiers?.some(
      ({ type, identifier }) =>
        type === 'ISBN_13' &&
        normalizeVerifiedIsbn13(identifier) === requestedIsbn13,
    ),
  );
}

function safeGoogleBooksImageUrl(value: string | undefined): string | null {
  if (!value) return null;

  try {
    const url = new URL(value.replace(/^http:/i, 'https:'));
    const isGoogleHost =
      url.hostname === 'books.google.com' ||
      url.hostname === 'books.googleusercontent.com' ||
      url.hostname.endsWith('.googleusercontent.com');
    return url.protocol === 'https:' && isGoogleHost ? url.toString() : null;
  } catch {
    return null;
  }
}

export function selectVerifiedGoogleBooksCover(
  response: GoogleBooksResponse,
  isbn13: string,
): string | null {
  const requestedIsbn13 = normalizeVerifiedIsbn13(isbn13);
  if (!requestedIsbn13) return null;

  for (const volume of response.items ?? []) {
    if (!volumeHasExactIsbn13(volume, requestedIsbn13)) continue;
    const images = volume.volumeInfo?.imageLinks;
    for (const size of [
      'extraLarge',
      'large',
      'medium',
      'small',
      'thumbnail',
      'smallThumbnail',
    ] as const) {
      const imageUrl = safeGoogleBooksImageUrl(images?.[size]);
      if (imageUrl) return imageUrl;
    }
  }

  return null;
}

async function fetchGoogleBooksCover(
  isbn13: string,
  fetchImplementation: typeof fetch,
): Promise<CoverSourceResolution> {
  const url = new URL(GOOGLE_BOOKS_URL);
  url.searchParams.set('q', `isbn:${isbn13}`);
  url.searchParams.set('maxResults', '5');
  url.searchParams.set('projection', 'full');
  const apiKey = readServerEnvironment('GOOGLE_BOOKS_API_KEY');
  if (apiKey) url.searchParams.set('key', apiKey);

  for (
    let attempt = 0;
    attempt <= SERVICE_UNAVAILABLE_RETRY_DELAYS_MS.length;
    attempt += 1
  ) {
    try {
      const response = await fetchImplementation(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(8_000),
      });
      if (
        response.status === 503 &&
        attempt < SERVICE_UNAVAILABLE_RETRY_DELAYS_MS.length
      ) {
        await response.body?.cancel();
        await new Promise((resolve) =>
          setTimeout(resolve, SERVICE_UNAVAILABLE_RETRY_DELAYS_MS[attempt]),
        );
        continue;
      }
      if (response.status === 403 || response.status === 429) {
        unavailableUntil = Date.now() + RATE_LIMIT_BACKOFF_MS;
        return unresolvedCover('google_books', isbn13, 'temporary_failure');
      }
      if (!response.ok) {
        return unresolvedCover('google_books', isbn13, 'temporary_failure');
      }
      const coverUrl = selectVerifiedGoogleBooksCover(
        (await response.json()) as GoogleBooksResponse,
        isbn13,
      );
      return coverUrl
        ? resolvedCover('google_books', isbn13, coverUrl)
        : unresolvedCover('google_books', isbn13, 'confirmed_missing');
    } catch {
      return unresolvedCover('google_books', isbn13, 'temporary_failure');
    }
  }

  return unresolvedCover('google_books', isbn13, 'temporary_failure');
}

export function resolveGoogleBooksCoverResult(
  value: string | null | undefined,
  fetchImplementation: typeof fetch = fetch,
): Promise<CoverSourceResolution> {
  const isbn13 = normalizeVerifiedIsbn13(value);
  if (!isbn13) {
    return Promise.resolve(
      unresolvedCover(
        'google_books',
        normalizeIsbn13(value) ?? 'invalid-isbn13',
        'confirmed_missing',
      ),
    );
  }

  const now = Date.now();
  if (unavailableUntil > now) {
    return Promise.resolve(
      unresolvedCover('google_books', isbn13, 'temporary_failure'),
    );
  }
  const cached = coverCache.get(isbn13);
  if (cached && cached.expiresAt > now) return cached.result;
  if (cached) coverCache.delete(isbn13);

  if (coverCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = coverCache.keys().next().value;
    if (oldestKey) coverCache.delete(oldestKey);
  }

  const result = fetchGoogleBooksCover(isbn13, fetchImplementation).then(
    (resolution) => {
      const ttl =
        resolution.state === 'resolved'
          ? SUCCESS_TTL_MS
          : resolution.state === 'confirmed_missing'
            ? FAILURE_TTL_MS
            : TEMPORARY_FAILURE_TTL_MS;
      coverCache.set(isbn13, {
        expiresAt: Date.now() + ttl,
        result: Promise.resolve(resolution),
      });
      return resolution;
    },
  );
  coverCache.set(isbn13, {
    expiresAt: now + TEMPORARY_FAILURE_TTL_MS,
    result,
  });
  return result;
}

export async function resolveGoogleBooksCover(
  value: string | null | undefined,
  fetchImplementation: typeof fetch = fetch,
): Promise<string | null> {
  return (await resolveGoogleBooksCoverResult(value, fetchImplementation))
    .coverUrl;
}

export function clearGoogleBooksCoverCacheForTests(): void {
  coverCache.clear();
  unavailableUntil = 0;
}
