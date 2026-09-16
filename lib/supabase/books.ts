import type { Book } from '@/app/data/books';
import {
  getOpenLibraryCoverIdUrl,
  getOpenLibraryCoverUrl,
  getOpenLibraryOlidCoverUrl,
  hasOpenLibraryCoverIdentity,
  normalizeIsbn13,
  normalizeOpenLibraryId,
  uniqueCoverUrls,
} from '@/lib/books/covers';
import {
  getPreferredEditionLanguages,
  getWorkFirstPublishYear,
  rankEditionsForCover,
  selectRepresentativeEdition,
  type EditionCandidate,
  type EditionRankingContext,
} from '@/lib/books/edition-ranking';
import type { Locale } from '@/lib/i18n/config';
import {
  DUTCH_LANGUAGE_DATABASE_CODES,
  isDutchLanguageBook,
  REVIEWED_DUTCH_LANGUAGE_ISBN13,
} from '@/lib/books/language';
import {
  applyRatingSummaries,
  type PublicRatingSummary,
} from '@/lib/ratings/card-summaries';
import { rankHighestRatedWorks } from '@/lib/ratings/highest-rated';
import { supabase } from './client';
import {
  loadPublicRatingSummaries,
  loadPublicRatingSummariesBatched,
} from './public-rating-summaries';

type DatabaseRow = Record<string, unknown>;

const ISBN_13_COLUMNS = ['isbn13', 'isbn_13', 'isbn-13'] as const;
const AUTHOR_ID_COLUMNS = ['author_id', 'primary_author_id', 'author'] as const;
const WORK_ID_COLUMNS = ['work_id', 'workId', 'work'] as const;
const OPEN_LIBRARY_WORK_ID_COLUMNS = [
  'open_library_id',
  'open_library_work_id',
  'open_library_key',
  'openlibrary_id',
  'ol_id',
  'ol_key',
] as const;
const OPEN_LIBRARY_EDITION_ID_COLUMNS = [
  'open_library_edition_id',
  'open_library_id',
  'open_library_key',
  'openlibrary_id',
  'ol_id',
  'ol_key',
] as const;
const COVER_STYLES = ['orbit', 'laurel', 'copper', 'women', 'road', 'matter'] as const;
const HOMEPAGE_CATALOG_SELECT = [
  'id',
  'title',
  'first_publish_year',
  'open_library_id',
  'source_type',
  'work_type',
  'author_id',
  'cover_id',
  'authors(id,name)',
  'editions(id,open_library_edition_id,isbn_13,language)',
].join(',');
const BOOK_DETAIL_SELECT = [
  'id',
  'title',
  'first_publish_year',
  'open_library_id',
  'source_type',
  'work_type',
  'author_id',
  'cover_id',
  'authors(id,name)',
  'editions(id,open_library_edition_id,isbn_10,isbn_13,language,publisher,title)',
].join(',');

function asRow(value: unknown): DatabaseRow | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? (value as DatabaseRow)
    : null;
}

function asRows(value: unknown): DatabaseRow[] {
  if (Array.isArray(value)) {
    return value.map(asRow).filter((row): row is DatabaseRow => row !== null);
  }

  const row = asRow(value);
  return row ? [row] : [];
}

function readString(row: DatabaseRow, columns: readonly string[]): string | null {
  for (const column of columns) {
    const value = row[column];

    if (typeof value === 'string' || typeof value === 'number') {
      const text = String(value).trim();
      if (text) return text;
    }
  }

  return null;
}

function readNumber(row: DatabaseRow, columns: readonly string[]): number | null {
  const value = readString(row, columns);
  if (!value) return null;

  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function readIsbn13(edition: DatabaseRow): string | null {
  for (const column of ISBN_13_COLUMNS) {
    const value = edition[column];
    const candidates = Array.isArray(value) ? value : [value];

    for (const candidate of candidates) {
      if (typeof candidate === 'string' || typeof candidate === 'number') {
        const isbn13 = normalizeIsbn13(String(candidate));
        if (isbn13) return isbn13;
      }
    }
  }

  return null;
}

function readOpenLibraryId(
  row: DatabaseRow,
  columns: readonly string[],
  type: 'edition' | 'work',
): string | null {
  for (const column of columns) {
    const value = readString(row, [column]);
    const openLibraryId = normalizeOpenLibraryId(value, type);
    if (openLibraryId) return openLibraryId;
  }

  return null;
}

function readCoverIds(row: DatabaseRow): number[] {
  const values = ['cover_id', 'cover_i', 'covers'].flatMap((column) => {
    const value = row[column];
    return Array.isArray(value) ? value : [value];
  });

  return values
    .map((value) => Number(value))
    .filter(
      (value) => Number.isSafeInteger(value) && value > 0,
    );
}

type RankedEditionRow = EditionCandidate & { row: DatabaseRow };

function toRankedEditionRow(edition: DatabaseRow): RankedEditionRow {
  const language = readString(edition, ['language', 'language_code']);
  return {
    row: edition,
    id: readString(edition, ['id']),
    openLibraryEditionId: readOpenLibraryId(
      edition,
      OPEN_LIBRARY_EDITION_ID_COLUMNS,
      'edition',
    ),
    title: readString(edition, ['title']),
    subtitle: readString(edition, ['subtitle']),
    physicalFormat: readString(edition, ['physical_format', 'format']),
    languageCodes: language ? [language] : [],
    isbn10: readString(edition, ['isbn_10', 'isbn10']),
    isbn13: readIsbn13(edition),
    publishDate: readString(edition, ['publish_date', 'published_at']),
    publishers: readString(edition, ['publisher']),
    coverIds: readCoverIds(edition),
  };
}

function getEditionRankingContext(
  work: DatabaseRow,
  title: string,
  locale: Locale = 'en',
): EditionRankingContext {
  const sourceType = readString(work, ['source_type']);
  return {
    workTitle: title,
    workType: readString(work, ['work_type']),
    firstPublishYear: getWorkFirstPublishYear(
      readNumber(work, ['first_publish_year', 'first_published_year']),
    ),
    preferredLanguages: getPreferredEditionLanguages(locale, sourceType),
  };
}

function getStoredCoverCandidates(
  work: DatabaseRow,
  editions: DatabaseRow[],
  context: EditionRankingContext,
): string[] {
  const preferredEditions = rankEditionsForCover(
    editions.map(toRankedEditionRow),
    context,
  ).map((edition) => edition.row);
  const editionOpenLibraryIds = preferredEditions.map((edition) =>
    readOpenLibraryId(
      edition,
      OPEN_LIBRARY_EDITION_ID_COLUMNS,
      'edition',
    ),
  );
  const storedCoverIds = [
    ...preferredEditions.flatMap(readCoverIds),
    ...readCoverIds(work),
  ];
  const mayUseOpenLibraryIsbnCandidate = hasOpenLibraryCoverIdentity({
    workId: readOpenLibraryId(
      work,
      OPEN_LIBRARY_WORK_ID_COLUMNS,
      'work',
    ),
    editionIds: editionOpenLibraryIds,
    coverIds: storedCoverIds,
  });

  return uniqueCoverUrls([
    ...(mayUseOpenLibraryIsbnCandidate
      ? preferredEditions.map((edition) =>
          getOpenLibraryCoverUrl(readIsbn13(edition)),
        )
      : []),
    ...preferredEditions.map((edition) =>
      getOpenLibraryOlidCoverUrl(
        readOpenLibraryId(
          edition,
          OPEN_LIBRARY_EDITION_ID_COLUMNS,
          'edition',
        ),
      ),
    ),
    ...storedCoverIds.map(getOpenLibraryCoverIdUrl),
  ]);
}

function getWorkId(work: DatabaseRow): string | null {
  return readString(work, ['id']);
}

function getRelatedAuthor(
  work: DatabaseRow,
  authors: DatabaseRow[],
): DatabaseRow | null {
  const embedded = [...asRows(work.author), ...asRows(work.authors)][0];
  if (embedded) return embedded;

  const authorId = readString(work, AUTHOR_ID_COLUMNS);
  return (
    authors.find((author) => readString(author, ['id']) === authorId) ?? null
  );
}

function getRelatedEditions(
  work: DatabaseRow,
  editions: DatabaseRow[],
): DatabaseRow[] {
  const embeddedEditions = asRows(work.editions);
  if (embeddedEditions.length > 0) return embeddedEditions;

  const workId = getWorkId(work);
  if (!workId) return [];

  return editions.filter(
    (edition) => readString(edition, WORK_ID_COLUMNS) === workId,
  );
}

async function loadCatalogRows(limit: number): Promise<{
  works: DatabaseRow[];
  authors: DatabaseRow[];
  editions: DatabaseRow[];
  total: number | null;
}> {
  const joined = await supabase
    .from('works')
    .select(HOMEPAGE_CATALOG_SELECT, { count: 'exact' })
    .order('title', { ascending: true })
    .limit(limit);

  if (!joined.error) {
    return {
      works: asRows(joined.data),
      authors: [],
      editions: [],
      total: joined.count,
    };
  }

  const [worksResult, authorsResult, editionsResult] = await Promise.all([
    supabase
      .from('works')
      .select('*', { count: 'exact' })
      .order('title', { ascending: true })
      .limit(limit),
    supabase.from('authors').select('*'),
    supabase.from('editions').select('*'),
  ]);

  if (worksResult.error) throw worksResult.error;
  if (authorsResult.error) throw authorsResult.error;
  if (editionsResult.error) throw editionsResult.error;

  return {
    works: asRows(worksResult.data),
    authors: asRows(authorsResult.data),
    editions: asRows(editionsResult.data),
    total: worksResult.count,
  };
}

function mapCatalogBook(
  work: DatabaseRow,
  authors: DatabaseRow[],
  editions: DatabaseRow[],
  index: number,
  locale: Locale = 'en',
): Book | null {
  const workId = getWorkId(work);
  const title = readString(work, ['title', 'name']);
  if (!workId || !title) return null;

  const author = getRelatedAuthor(work, authors);
  const relatedEditions = getRelatedEditions(work, editions);
  const editionRankingContext = getEditionRankingContext(work, title, locale);
  const edition =
    selectRepresentativeEdition(
      relatedEditions.map(toRankedEditionRow),
      editionRankingContext,
    )?.row ?? null;
  const openLibraryWorkId = readOpenLibraryId(
    work,
    OPEN_LIBRARY_WORK_ID_COLUMNS,
    'work',
  );
  const openLibraryEditionId = edition
    ? readOpenLibraryId(
        edition,
        OPEN_LIBRARY_EDITION_ID_COLUMNS,
        'edition',
      )
    : null;

  return {
    id: `work-${workId}`,
    source: 'supabase',
    workId,
    editionId: edition ? readString(edition, ['id']) : null,
    sourceType: readString(work, ['source_type']),
    openLibraryWorkId,
    openLibraryEditionId,
    title,
    author: author
      ? readString(author, ['name', 'author_name']) ?? 'Unknown author'
      : 'Unknown author',
    firstPublishYear: getWorkFirstPublishYear(
      readNumber(work, ['first_publish_year', 'first_published_year']),
    ),
    isbn10: edition ? readString(edition, ['isbn_10', 'isbn10']) : null,
    isbn13: edition ? readIsbn13(edition) : null,
    editionTitle: edition ? readString(edition, ['title']) : null,
    editionPublisher: edition ? readString(edition, ['publisher']) : null,
    editionLanguage: edition
      ? readString(edition, ['language', 'language_code'])
      : null,
    coverUrls: getStoredCoverCandidates(
      work,
      relatedEditions,
      editionRankingContext,
    ),
    score: null,
    ratingsCount: null,
    match: null,
    cover: COVER_STYLES[index % COVER_STYLES.length],
  };
}

export function mapCatalogWorks(rows: unknown): Book[] {
  return asRows(rows)
    .map((work, index) => mapCatalogBook(work, [], [], index))
    .filter((book): book is Book => book !== null);
}

export async function loadCatalogBooks(limit = 50): Promise<Book[]> {
  return (await loadHomepageCatalog(limit)).books;
}

export async function loadCatalogBooksByIds(
  workIds: readonly string[],
  prefetchedSummaries?: ReadonlyMap<string, PublicRatingSummary>,
): Promise<Book[]> {
  const ids = [...new Set(
    workIds
      .map(Number)
      .filter((id) => Number.isSafeInteger(id) && id > 0),
  )];
  if (ids.length === 0) return [];

  const result = await supabase
    .from('works')
    .select(HOMEPAGE_CATALOG_SELECT)
    .in('id', ids);
  if (result.error) throw result.error;

  const catalogBooks = asRows(result.data)
    .map((work, index) => mapCatalogBook(work, [], [], index))
    .filter((book): book is Book => book !== null);
  const summaries = prefetchedSummaries ?? await loadPublicRatingSummaries(
    supabase,
    catalogBooks.flatMap((book) => (book.workId ? [book.workId] : [])),
  );
  return applyRatingSummaries(catalogBooks, summaries);
}

export async function loadHomepageCatalog(limit = 18): Promise<{
  books: Book[];
  total: number;
}> {
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
  const { works, authors, editions, total } = await loadCatalogRows(safeLimit);

  const catalogBooks = works
    .map((work, index) => mapCatalogBook(work, authors, editions, index))
    .filter((book): book is Book => book !== null)
    .sort((left, right) =>
      left.title.localeCompare(right.title, 'en', { sensitivity: 'base' }),
    );

  const summaries = await loadPublicRatingSummaries(
    supabase,
    catalogBooks.flatMap((book) => (book.workId ? [book.workId] : [])),
  );

  return {
    books: applyRatingSummaries(catalogBooks, summaries),
    total: total ?? catalogBooks.length,
  };
}

export async function loadDutchDiscoveryCatalogCandidates(): Promise<Book[]> {
  const [structuredLanguageEditions, reviewedSeedEditions] = await Promise.all([
    supabase
      .from('editions')
      .select('work_id')
      .in('language', [...DUTCH_LANGUAGE_DATABASE_CODES]),
    supabase
      .from('editions')
      .select('work_id')
      .in('isbn_13', [...REVIEWED_DUTCH_LANGUAGE_ISBN13]),
  ]);
  if (structuredLanguageEditions.error) throw structuredLanguageEditions.error;
  if (reviewedSeedEditions.error) throw reviewedSeedEditions.error;

  const workIds = [...new Set([
    ...(structuredLanguageEditions.data ?? []),
    ...(reviewedSeedEditions.data ?? []),
  ].flatMap((row) => {
    const workId = String(row.work_id ?? '').trim();
    return workId ? [workId] : [];
  }))];
  const books = await loadCatalogBooksByIds(workIds);
  return books.filter(isDutchLanguageBook);
}

export async function loadHighestRatedCatalog(limit = 18): Promise<{
  books: Book[];
  total: number;
}> {
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
  const firstPage = await supabase
    .from('works')
    .select('id,title', { count: 'exact' })
    .order('id', { ascending: true })
    .range(0, 999);
  if (firstPage.error) throw firstPage.error;

  const total = firstPage.count ?? firstPage.data?.length ?? 0;
  const remainingStarts = Array.from(
    { length: Math.max(0, Math.ceil(total / 1000) - 1) },
    (_, index) => (index + 1) * 1000,
  );
  const remainingPages = await Promise.all(remainingStarts.map((start) =>
    supabase
      .from('works')
      .select('id,title')
      .order('id', { ascending: true })
      .range(start, start + 999),
  ));
  const failedPage = remainingPages.find(({ error }) => error);
  if (failedPage?.error) throw failedPage.error;

  const identities = [
    ...(firstPage.data ?? []),
    ...remainingPages.flatMap(({ data }) => data ?? []),
  ].flatMap((row) => {
    const workId = String(row.id ?? '').trim();
    const title = typeof row.title === 'string' ? row.title.trim() : '';
    return workId && title ? [{ workId, title }] : [];
  });
  const summaries = await loadPublicRatingSummariesBatched(
    supabase,
    identities.map(({ workId }) => workId),
  );
  const ranked = rankHighestRatedWorks(
    identities.map(({ workId, title }) => ({
      workId,
      title,
      score: summaries.get(workId)?.lumiscore ?? null,
      ratingCount: summaries.get(workId)?.ratingCount ?? 0,
    })),
    safeLimit,
  );
  const books = await loadCatalogBooksByIds(
    ranked.map(({ workId }) => workId),
    summaries,
  );
  const booksById = new Map(
    books.flatMap((book): Array<[string, Book]> =>
      book.workId ? [[book.workId, book]] : []),
  );

  return {
    books: ranked.flatMap(({ workId }) => {
      const book = booksById.get(workId);
      return book ? [book] : [];
    }),
    total,
  };
}

export async function loadCatalogBook(
  workId: string,
  locale: Locale = 'en',
): Promise<Book | null> {
  const result = await supabase
    .from('works')
    .select(BOOK_DETAIL_SELECT)
    .eq('id', workId)
    .maybeSingle();

  if (result.error) throw result.error;
  const work = asRow(result.data);
  return work ? mapCatalogBook(work, [], [], 0, locale) : null;
}
