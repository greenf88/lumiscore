import {
  resolveBookCovers,
  type BookCoverLookup,
} from '@/lib/books/cover-resolution';
import type { CoverResolutionState } from '@/lib/books/cover-resolution-result';
import { normalizeOpenLibraryId, uniqueCoverUrls } from '@/lib/books/covers';
import { normalizeVerifiedIsbn13 } from '@/lib/books/google-books-covers';
import {
  loadStoredCoverResolutions,
  mergeStoredCoverResolution,
  saveStoredCoverResolutions,
  shouldRefreshStoredCover,
  type StoredCoverResolution,
} from '@/lib/supabase/cover-resolutions';

const SUCCESS_CACHE_TTL_MS = 30 * 24 * 60 * 60 * 1_000;
const CONFIRMED_MISSING_CACHE_TTL_MS = 60 * 60 * 1_000;
const TEMPORARY_FAILURE_CACHE_TTL_MS = 60 * 1_000;
const MAX_CACHED_COVER_LOOKUPS = 500;
type CoverApiResult = {
  coverUrls: string[];
  state: CoverResolutionState;
};
const coverResolutionCache = new Map<
  string,
  { expiresAt: number; result: Promise<CoverApiResult> }
>();

function orderedStoredUrls(entries: readonly StoredCoverResolution[]) {
  return uniqueCoverUrls(
    [...entries]
      .sort((left, right) =>
        left.source === right.source
          ? 0
          : left.source === 'open_library'
            ? -1
            : 1,
      )
      .map((entry) => entry.coverUrl),
  );
}

function aggregateState(
  coverUrls: readonly string[],
  states: readonly CoverResolutionState[],
): CoverResolutionState {
  if (coverUrls.length > 0) return 'resolved';
  return states.includes('temporary_failure')
    ? 'temporary_failure'
    : 'confirmed_missing';
}

async function resolveWithDurableCache(
  lumiScoreWorkId: string | null,
  lookup: BookCoverLookup,
): Promise<CoverApiResult> {
  const expectedSources = [
    lookup.workId
      ? {
          source: 'open_library' as const,
          sourceKey:
            normalizeOpenLibraryId(lookup.workId, 'work') ?? lookup.workId,
        }
      : null,
    lookup.isbn13
      ? {
          source: 'google_books' as const,
          sourceKey:
            normalizeVerifiedIsbn13(lookup.isbn13) ?? lookup.isbn13,
        }
      : null,
  ].filter((source): source is NonNullable<typeof source> => Boolean(source));
  const stored = lumiScoreWorkId
    ? await loadStoredCoverResolutions(
        lumiScoreWorkId,
        expectedSources.map(({ source }) => source),
      )
    : { available: false, entries: [] };
  const relevantStoredEntries = stored.entries.filter((entry) =>
    expectedSources.some(
      ({ source, sourceKey }) =>
        entry.source === source && entry.sourceKey === sourceKey,
    ),
  );
  const storedBySource = new Map(
    relevantStoredEntries.map((entry) => [entry.source, entry]),
  );
  const allStoredEntriesFresh =
    stored.available &&
    expectedSources.length > 0 &&
    expectedSources.every(({ source, sourceKey }) => {
      const entry = storedBySource.get(source);
      return entry && !shouldRefreshStoredCover(entry, sourceKey);
    });

  if (allStoredEntriesFresh) {
    const coverUrls = orderedStoredUrls(relevantStoredEntries);
    return {
      coverUrls,
      state: aggregateState(
        coverUrls,
        relevantStoredEntries.map((entry) => entry.state),
      ),
    };
  }

  const live = await resolveBookCovers(lookup);
  if (!lumiScoreWorkId || !stored.available) {
    return {
      coverUrls: live.coverUrls,
      state: aggregateState(
        live.coverUrls,
        live.sources.map((source) => source.state),
      ),
    };
  }

  const merged = live.sources.map((source) =>
    mergeStoredCoverResolution(
      lumiScoreWorkId,
      storedBySource.get(source.source),
      source,
    ),
  );
  await saveStoredCoverResolutions(merged);
  const coverUrls = uniqueCoverUrls([
    ...orderedStoredUrls(merged),
    ...live.coverUrls,
  ]);
  return {
    coverUrls,
    state: aggregateState(
      coverUrls,
      merged.map((entry) => entry.state),
    ),
  };
}

function getCachedCoverResolution(
  lumiScoreWorkId: string | null,
  lookup: BookCoverLookup,
) {
  const key = JSON.stringify([lumiScoreWorkId, lookup]);
  const now = Date.now();
  const cached = coverResolutionCache.get(key);
  if (cached && cached.expiresAt > now) return cached.result;
  if (cached) coverResolutionCache.delete(key);

  if (coverResolutionCache.size >= MAX_CACHED_COVER_LOOKUPS) {
    const oldestKey = coverResolutionCache.keys().next().value;
    if (oldestKey) coverResolutionCache.delete(oldestKey);
  }

  const result = resolveWithDurableCache(lumiScoreWorkId, lookup)
    .then((resolution) => {
      const ttl =
        resolution.state === 'resolved'
          ? SUCCESS_CACHE_TTL_MS
          : resolution.state === 'confirmed_missing'
            ? CONFIRMED_MISSING_CACHE_TTL_MS
            : TEMPORARY_FAILURE_CACHE_TTL_MS;
      coverResolutionCache.set(key, {
        expiresAt: Date.now() + ttl,
        result: Promise.resolve(resolution),
      });
      return resolution;
    })
    .catch((error) => {
      coverResolutionCache.delete(key);
      throw error;
    });
  coverResolutionCache.set(key, {
    expiresAt: now + TEMPORARY_FAILURE_CACHE_TTL_MS,
    result,
  });
  return result;
}

export async function GET(request: Request) {
  const searchParams = new URL(request.url).searchParams;
  const workId = searchParams.get('workId')?.slice(0, 32) ?? '';
  const title = searchParams.get('title')?.slice(0, 240).trim() ?? '';
  const author = searchParams.get('author')?.slice(0, 240).trim() ?? '';
  const isbn13 = searchParams.get('isbn13')?.slice(0, 32).trim() ?? '';
  const lumiScoreWorkId =
    searchParams.get('lumiScoreWorkId')?.slice(0, 32).trim() ?? '';
  const year = Number(searchParams.get('year'));

  const hasWorkId = /^OL\d+W$/i.test(workId);
  const hasIsbn13 = /^\d{13}$/.test(isbn13.replace(/[\s-]/g, ''));
  const hasLumiScoreWorkId = /^\d+$/.test(lumiScoreWorkId);
  if ((!hasWorkId && !hasIsbn13) || !title || !author) {
    return Response.json(
      { coverUrls: [] },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  }

  const result = await getCachedCoverResolution(
    hasLumiScoreWorkId ? lumiScoreWorkId : null,
    {
      workId: hasWorkId ? workId : null,
      isbn13,
      title,
      author,
      firstPublishYear: Number.isInteger(year) && year > 0 ? year : null,
    },
  );

  return Response.json(
    result,
    {
      headers: {
        'Cache-Control': result.coverUrls.length
          ? 'public, max-age=3600, s-maxage=604800, stale-while-revalidate=2592000'
          : result.state === 'temporary_failure'
            ? 'public, max-age=0, s-maxage=60'
            : 'public, max-age=300, s-maxage=3600',
      },
    },
  );
}
