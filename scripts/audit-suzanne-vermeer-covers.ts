import { createClient } from '@supabase/supabase-js';
import {
  getOpenLibraryCoverIdUrl,
  getOpenLibraryCoverUrl,
  getOpenLibraryOlidCoverUrl,
  normalizeOpenLibraryId,
  uniqueCoverUrls,
} from '../lib/books/covers.ts';
import {
  selectRepresentativeEdition,
  type EditionCandidate,
} from '../lib/books/edition-ranking.ts';
import {
  normalizeVerifiedIsbn13,
  selectVerifiedGoogleBooksCover,
} from '../lib/books/google-books-covers.ts';
import { resolveOpenLibraryCoverResult } from '../lib/books/open-library-covers.ts';

type EditionRow = {
  id: string | number;
  open_library_edition_id: string | null;
  isbn_10: string | null;
  isbn_13: string | null;
  language: string | null;
  publisher: string | null;
  title: string | null;
};

type WorkRow = {
  id: string | number;
  title: string;
  first_publish_year: number | null;
  source_type: string | null;
  open_library_id: string | null;
  cover_id: number | null;
  editions: EditionRow[];
};

type GoogleVolume = {
  volumeInfo?: {
    industryIdentifiers?: Array<{ type?: string; identifier?: string }>;
    imageLinks?: Record<string, string>;
  };
};

type GoogleResponse = {
  totalItems?: number;
  items?: GoogleVolume[];
  error?: { message?: string };
};

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing read-only Supabase environment.');
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function asCandidate(edition: EditionRow): EditionCandidate & {
  row: EditionRow;
} {
  return {
    row: edition,
    id: edition.id,
    openLibraryEditionId: edition.open_library_edition_id,
    title: edition.title,
    languageCodes: edition.language ? [edition.language] : [],
    isbn10: edition.isbn_10,
    isbn13: edition.isbn_13,
    publishers: edition.publisher,
  };
}

async function usableImage(url: string | null): Promise<boolean> {
  if (!url) return false;

  try {
    const response = await fetch(url, {
      headers: {
        Range: 'bytes=0-1023',
        'User-Agent': 'LumiScoreCoverAudit/3.0 (https://lumisco.re)',
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10_000),
    });
    const usable =
      response.ok &&
      (response.headers.get('content-type') ?? '').startsWith('image/');
    await response.body?.cancel();
    return usable;
  } catch {
    return false;
  }
}

async function firstUsableUrl(urls: readonly string[]): Promise<string | null> {
  for (const url of urls) {
    if (await usableImage(url)) return url;
  }
  return null;
}

async function probeGoogleBooks(isbn13: string | null) {
  const verifiedIsbn13 = normalizeVerifiedIsbn13(isbn13);
  if (!verifiedIsbn13) {
    return {
      state: 'confirmed_missing' as const,
      status: null,
      volumes: 0,
      exactMatch: false,
      hasImage: false,
      coverUrl: null,
      reason: 'No valid representative ISBN-13 is available.',
    };
  }

  const url = new URL('https://www.googleapis.com/books/v1/volumes');
  url.searchParams.set('q', `isbn:${verifiedIsbn13}`);
  url.searchParams.set('maxResults', '5');
  url.searchParams.set('projection', 'full');
  const apiKey = process.env.GOOGLE_BOOKS_API_KEY?.trim();
  if (apiKey) url.searchParams.set('key', apiKey);

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(10_000),
      });
      const payload = (await response.json()) as GoogleResponse;
      if (response.status === 503 && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 150 * 2 ** attempt));
        continue;
      }

      const volumes = payload.items ?? [];
      const exactVolumes = volumes.filter((volume) =>
        volume.volumeInfo?.industryIdentifiers?.some(
          ({ type, identifier }) =>
            type === 'ISBN_13' &&
            normalizeVerifiedIsbn13(identifier) === verifiedIsbn13,
        ),
      );
      const selectedUrl = selectVerifiedGoogleBooksCover(
        payload,
        verifiedIsbn13,
      );
      const selectedUrlUsable = await usableImage(selectedUrl);
      const exactMatch = exactVolumes.length > 0;
      const hasImage = exactVolumes.some(
        (volume) =>
          volume.volumeInfo?.imageLinks &&
          Object.keys(volume.volumeInfo.imageLinks).length > 0,
      );

      return {
        state:
          response.ok && selectedUrl && selectedUrlUsable
            ? ('resolved' as const)
            : response.ok
              ? ('confirmed_missing' as const)
              : ('temporary_failure' as const),
        status: response.status,
        volumes: volumes.length,
        exactMatch,
        hasImage,
        coverUrl: selectedUrlUsable ? selectedUrl : null,
        reason: !response.ok
          ? payload.error?.message ?? `Google Books returned HTTP ${response.status}.`
          : !exactMatch
            ? 'Google Books returned no exact ISBN-13 match.'
            : !hasImage
              ? 'The exact ISBN-13 volume has no imageLinks.'
              : !selectedUrl
                ? 'The exact match has no safe HTTPS Google-hosted image URL.'
                : !selectedUrlUsable
                  ? 'The selected Google Books image URL did not return a usable image.'
                  : 'Accepted: exact ISBN-13 match with a usable HTTPS Google-hosted image.',
      };
    } catch (error) {
      if (attempt < 2) continue;
      return {
        state: 'temporary_failure' as const,
        status: null,
        volumes: 0,
        exactMatch: false,
        hasImage: false,
        coverUrl: null,
        reason: error instanceof Error ? error.message : 'Google Books request failed.',
      };
    }
  }

  throw new Error('Unreachable Google Books audit state.');
}

async function probeOpenLibrary(work: WorkRow, edition: EditionRow | null) {
  const openLibraryWorkId = normalizeOpenLibraryId(
    work.open_library_id,
    'work',
  );
  const initialUrls = uniqueCoverUrls([
    getOpenLibraryCoverUrl(edition?.isbn_13),
    getOpenLibraryOlidCoverUrl(edition?.open_library_edition_id),
    getOpenLibraryCoverIdUrl(work.cover_id),
  ]);
  let coverUrl = await firstUsableUrl(initialUrls);
  let state: 'resolved' | 'confirmed_missing' | 'temporary_failure' = coverUrl
    ? 'resolved'
    : 'confirmed_missing';

  if (!coverUrl && openLibraryWorkId) {
    const result = await resolveOpenLibraryCoverResult({
      workId: openLibraryWorkId,
      title: work.title,
      author: 'Suzanne Vermeer',
      firstPublishYear: work.first_publish_year,
      preferredLanguages: ['nld'],
    });
    coverUrl = await firstUsableUrl(result.coverUrls);
    state = coverUrl
      ? 'resolved'
      : result.resolution.state === 'temporary_failure'
        ? 'temporary_failure'
        : 'confirmed_missing';
  }

  return {
    state,
    coverUrl,
    reason: coverUrl
      ? 'A usable Open Library cover URL was verified.'
      : openLibraryWorkId
        ? state === 'temporary_failure'
          ? 'Open Library could not be verified because of a temporary upstream failure.'
          : 'The verified work/edition and exact title-author search expose no usable cover.'
        : 'This native work has no Open Library work ID, and its ISBN cover endpoint has no usable image.',
  };
}

const authorResult = await supabase
  .from('authors')
  .select('id')
  .eq('name', 'Suzanne Vermeer')
  .single();
if (authorResult.error) throw authorResult.error;

const worksResult = await supabase
  .from('works')
  .select(
    'id,title,first_publish_year,source_type,open_library_id,cover_id,editions(id,open_library_edition_id,isbn_10,isbn_13,language,publisher,title)',
  )
  .eq('author_id', authorResult.data.id)
  .order('title', { ascending: true });
if (worksResult.error) throw worksResult.error;

const works = (worksResult.data ?? []) as unknown as WorkRow[];
const audit = [];

for (const work of works) {
  const context = {
    workTitle: work.title,
    firstPublishYear: work.first_publish_year,
    preferredLanguages:
      work.source_type === 'lumiscore_native' ? ['nld'] : ['eng'],
  };
  const edition =
    selectRepresentativeEdition(work.editions.map(asCandidate), context)?.row ??
    null;
  const openLibrary = await probeOpenLibrary(work, edition);
  const googleBooks = await probeGoogleBooks(edition?.isbn_13 ?? null);

  audit.push({
    workId: String(work.id),
    title: work.title,
    isbn13: edition?.isbn_13 ?? null,
    openLibrary,
    googleBooks,
    trustedFrontCover: openLibrary.coverUrl ?? googleBooks.coverUrl,
    placeholder: !openLibrary.coverUrl && !googleBooks.coverUrl,
  });
}

console.log(
  JSON.stringify(
    {
      author: 'Suzanne Vermeer',
      totalWorks: audit.length,
      placeholders: audit.filter((book) => book.placeholder),
      counts: {
        openLibrary: audit.filter((book) => book.openLibrary.coverUrl).length,
        googleBooksFallback: audit.filter(
          (book) => !book.openLibrary.coverUrl && book.googleBooks.coverUrl,
        ).length,
        placeholder: audit.filter((book) => book.placeholder).length,
      },
    },
    null,
    2,
  ),
);
