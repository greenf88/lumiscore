import type { SupabaseClient } from '@supabase/supabase-js';
import {
  getRepresentativeEditionFormat,
  getSuspiciousEditionReasons,
  isSuspiciousRepresentativeEdition,
  normalizeEditionLanguage,
  selectRepresentativeEdition,
  type EditionCandidate,
  type EditionRankingContext,
  type SuspiciousEditionReason,
} from '../lib/books/edition-ranking.ts';
import {
  getOpenLibraryCoverIdUrl,
  getOpenLibraryCoverUrl,
  getOpenLibraryOlidCoverUrl,
  normalizeIsbn13,
  uniqueCoverUrls,
} from '../lib/books/covers.ts';
import { NETHERLANDS_SEEDS } from './open-library-seeds-nl.ts';

type Row = Record<string, unknown>;

type CatalogEdition = {
  id: string | number;
  title: string | null;
  isbn_10: string | null;
  isbn_13: string | null;
  language: string | null;
  publisher: string | null;
  open_library_edition_id: string | null;
};

type CatalogWork = {
  id: string | number;
  title: string;
  first_publish_year: number | null;
  open_library_id: string | null;
  source_type: string | null;
  work_type: string | null;
  authors: { name?: string } | Array<{ name?: string }> | null;
  editions: CatalogEdition[];
};

type OpenLibraryEdition = {
  key?: string;
  title?: string;
  subtitle?: string;
  physical_format?: string;
  isbn_10?: string[];
  isbn_13?: string[];
  languages?: Array<{ key?: string }>;
  publish_date?: string;
  publishers?: string[];
  covers?: number[];
};

type RankedOpenLibraryEdition = EditionCandidate & {
  raw: OpenLibraryEdition;
};

export type RepresentativeEditionRepair = {
  workId: string;
  workTitle: string;
  author: string;
  firstPublishYear: number | null;
  editionRowId: string;
  current: {
    openLibraryEditionId: string | null;
    title: string | null;
    isbn13: string | null;
    suspiciousReasons: SuspiciousEditionReason[];
  };
  replacement: {
    openLibraryEditionId: string;
    title: string;
    physicalFormat: string;
    isbn10: string | null;
    isbn13: string | null;
    language: string | null;
    publisher: string | null;
    coverUrls: string[];
  };
};

export type RepresentativeEditionAudit = {
  catalogWorkCount: number;
  suspiciousRepresentativeCount: number;
  repairableCount: number;
  unrepairableWorkIds: string[];
  repairs: RepresentativeEditionRepair[];
};

const DUTCH_OPEN_LIBRARY_WORK_IDS = new Set(
  NETHERLANDS_SEEDS.map((seed) => seed.expectedOpenLibraryWorkId).filter(
    (workId): workId is string => Boolean(workId),
  ),
);

function firstAuthorName(work: CatalogWork): string {
  const author = Array.isArray(work.authors) ? work.authors[0] : work.authors;
  return author?.name?.trim() || 'Unknown author';
}

function preferredLanguagesForWork(work: CatalogWork): string[] {
  return work.source_type === 'lumiscore_native' ||
    (work.open_library_id && DUTCH_OPEN_LIBRARY_WORK_IDS.has(work.open_library_id))
    ? ['nld']
    : ['eng'];
}

function rankingContext(work: CatalogWork): EditionRankingContext {
  return {
    workTitle: work.title,
    workType: work.work_type,
    firstPublishYear: work.first_publish_year,
    preferredLanguages: preferredLanguagesForWork(work),
  };
}

function storedEditionCandidate(edition: CatalogEdition): EditionCandidate & {
  row: CatalogEdition;
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

function normalizeOpenLibraryEditionId(value: string | undefined): string | null {
  const id = value?.split('/').filter(Boolean).at(-1)?.toUpperCase();
  return id && /^OL\d+M$/.test(id) ? id : null;
}

function rankedOpenLibraryEdition(
  edition: OpenLibraryEdition,
): RankedOpenLibraryEdition {
  return {
    raw: edition,
    openLibraryEditionId: normalizeOpenLibraryEditionId(edition.key),
    title: edition.title ?? null,
    subtitle: edition.subtitle ?? null,
    physicalFormat: edition.physical_format ?? null,
    languageCodes: (edition.languages ?? [])
      .map((language) => language.key ?? '')
      .filter(Boolean),
    isbn10: edition.isbn_10 ?? [],
    isbn13: edition.isbn_13 ?? [],
    publishDate: edition.publish_date ?? null,
    publishers: edition.publishers ?? [],
    coverIds: (edition.covers ?? []).filter(
      (coverId) => Number.isSafeInteger(coverId) && coverId > 0,
    ),
  };
}

async function fetchOpenLibraryEditions(
  workId: string,
): Promise<RankedOpenLibraryEdition[]> {
  const url = new URL(`https://openlibrary.org/works/${workId}/editions.json`);
  url.searchParams.set('limit', '500');

  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          Accept: 'application/json',
          'User-Agent':
            'LumiScoreRepresentativeEditionAudit/1.0 (https://lumiscore.greenf88.chatgpt.site)',
        },
        signal: AbortSignal.timeout(15_000),
      });
      if (response.ok) {
        const result = (await response.json()) as { entries?: OpenLibraryEdition[] };
        return (result.entries ?? []).map(rankedOpenLibraryEdition);
      }
      lastError = new Error(`Open Library returned ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Could not load editions for ${workId}.`);
}

async function loadCatalogWorks(client: SupabaseClient): Promise<CatalogWork[]> {
  const works: CatalogWork[] = [];
  const pageSize = 500;
  for (let from = 0; ; from += pageSize) {
    const result = await client
      .from('works')
      .select(
        'id,title,first_publish_year,open_library_id,source_type,work_type,authors(name),editions(id,title,isbn_10,isbn_13,language,publisher,open_library_edition_id)',
      )
      .order('id', { ascending: true })
      .range(from, from + pageSize - 1);
    if (result.error) throw result.error;

    const page = (result.data ?? []) as unknown as CatalogWork[];
    works.push(...page);
    if (page.length < pageSize) return works;
  }
}

async function mapWithConcurrency<T, R>(
  values: readonly T[],
  concurrency: number,
  mapper: (value: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(values.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < values.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(values[index]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker()),
  );
  return results;
}

function firstString(value: string | readonly string[] | null | undefined) {
  if (Array.isArray(value)) return value[0]?.trim() || null;
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function normalizedIsbn13(edition: EditionCandidate): string | null {
  return (Array.isArray(edition.isbn13) ? edition.isbn13 : [edition.isbn13])
    .map((isbn) => normalizeIsbn13(isbn))
    .find((isbn): isbn is string => isbn !== null) ?? null;
}

function buildCoverUrls(edition: RankedOpenLibraryEdition): string[] {
  return uniqueCoverUrls([
    ...(edition.coverIds ?? []).map(getOpenLibraryCoverIdUrl),
    getOpenLibraryCoverUrl(normalizedIsbn13(edition)),
    getOpenLibraryOlidCoverUrl(edition.openLibraryEditionId),
  ]);
}

function replacementFor(
  work: CatalogWork,
  editions: RankedOpenLibraryEdition[],
): RankedOpenLibraryEdition | null {
  const context = rankingContext(work);
  const normalEditions = editions.filter(
    (edition) => !isSuspiciousRepresentativeEdition(edition, context),
  );
  const normalEditionsWithIsbn13 = normalEditions.filter((edition) =>
    normalizedIsbn13(edition),
  );
  return selectRepresentativeEdition(
    normalEditionsWithIsbn13.length > 0
      ? normalEditionsWithIsbn13
      : normalEditions,
    context,
  );
}

export async function createRepresentativeEditionAudit(
  client: SupabaseClient,
): Promise<RepresentativeEditionAudit> {
  const works = await loadCatalogWorks(client);
  const suspicious = works.flatMap((work) => {
    const context = rankingContext(work);
    const representative = selectRepresentativeEdition(
      work.editions.map(storedEditionCandidate),
      context,
    );
    return representative &&
      isSuspiciousRepresentativeEdition(representative, context)
      ? [{ work, representative }]
      : [];
  });

  const planned = await mapWithConcurrency(suspicious, 4, async (entry) => {
    const workId = entry.work.open_library_id;
    if (!workId) return { workId: String(entry.work.id), repair: null };

    const replacement = replacementFor(
      entry.work,
      await fetchOpenLibraryEditions(workId),
    );
    const replacementId = replacement?.openLibraryEditionId;
    if (!replacement || !replacementId) {
      return { workId: String(entry.work.id), repair: null };
    }

    const current = entry.representative.row;
    const language = replacement.languageCodes?.[0]
      ? normalizeEditionLanguage(replacement.languageCodes[0])
      : null;
    const replacementTitle = replacement.title?.trim() || entry.work.title;
    const repair: RepresentativeEditionRepair = {
      workId: String(entry.work.id),
      workTitle: entry.work.title,
      author: firstAuthorName(entry.work),
      firstPublishYear: entry.work.first_publish_year,
      editionRowId: String(current.id),
      current: {
        openLibraryEditionId: current.open_library_edition_id,
        title: current.title,
        isbn13: current.isbn_13,
        suspiciousReasons: getSuspiciousEditionReasons(entry.representative),
      },
      replacement: {
        openLibraryEditionId: replacementId,
        title: replacementTitle,
        physicalFormat: getRepresentativeEditionFormat(replacement),
        isbn10: firstString(replacement.isbn10),
        isbn13: normalizedIsbn13(replacement),
        language,
        publisher: firstString(replacement.publishers),
        coverUrls: buildCoverUrls(replacement),
      },
    };
    return { workId: String(entry.work.id), repair };
  });

  const repairs = planned.flatMap((entry) => (entry.repair ? [entry.repair] : []));
  return {
    catalogWorkCount: works.length,
    suspiciousRepresentativeCount: suspicious.length,
    repairableCount: repairs.length,
    unrepairableWorkIds: planned
      .filter((entry) => !entry.repair)
      .map((entry) => entry.workId),
    repairs,
  };
}

export function repairPayload(repair: RepresentativeEditionRepair): Row {
  return {
    open_library_edition_id: repair.replacement.openLibraryEditionId,
    title: repair.replacement.title,
    isbn_10: repair.replacement.isbn10,
    isbn_13: repair.replacement.isbn13,
    language: repair.replacement.language,
    publisher: repair.replacement.publisher,
  };
}
