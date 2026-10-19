import type { Book } from '@/app/data/books';
import { normalizeIsbn13, normalizeOpenLibraryId } from '@/lib/books/covers';
import { selectStrictEdition, withStrictEdition, unavailableEdition, type StrictEditionRow } from '@/lib/books/strict-edition';
import { withEditionCoverEvidence, deferEditionCoverEvidence } from '@/lib/books/edition-cover-evidence';
import { getWorkFirstPublishYear } from '@/lib/books/edition-ranking';
import type { Locale } from '@/lib/i18n/config';
import {
  DUTCH_LANGUAGE_DATABASE_CODES,
  isDutchLanguageBook,
  REVIEWED_DUTCH_LANGUAGE_ISBN13,
} from '@/lib/books/language';
import {
  applyRatingSummaries,
  ratingSummaryMap,
  type PublicRatingSummaryRow,
  type PublicRatingSummary,
} from '@/lib/ratings/card-summaries';
import { highestRatedPageArgs, readHighestRatedPage } from '@/lib/ratings/highest-rated-page';
import {
  CATALOG_BROWSE_PAGE_SIZE,
  type CatalogBrowsePageSize,
  clampCatalogBrowsePage,
  getCatalogBrowseOrder,
  getCatalogBrowsePageCount,
  getCatalogBrowseRange,
  normalizeCatalogBrowsePage,
  type CatalogBrowseSort,
} from '@/lib/books/catalog-browse';
import { supabase } from './client';
import {loadEditionRows} from './edition-rows.ts';
import {
  loadPublicRatingSummaries,
  loadPublicRatingSummariesBatched,
} from './public-rating-summaries';

type DatabaseRow = Record<string, unknown>;
async function completeEditions(works:DatabaseRow[]):Promise<DatabaseRow[]>{
  const rows=await loadEditionRows(supabase,works.flatMap(w=>getWorkId(w)?[getWorkId(w)!]:[]));
  const byWork=new Map<string,StrictEditionRow[]>();
  for(const row of rows){const key=String(row.work_id);byWork.set(key,[...(byWork.get(key)??[]),row]);}
  return works.map(work=>({...work,editions:byWork.get(getWorkId(work)!)??[]}));
}

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

function strictEditions(rows:DatabaseRow[]):StrictEditionRow[]{
  return rows.flatMap(row=>{const id=readString(row,['id']);return id?[{
    id,work_id:readString(row,WORK_ID_COLUMNS)??undefined,title:readString(row,['title']),language:readString(row,['language','language_code']),
    isbn_10:readString(row,['isbn_10','isbn10']),isbn_13:readIsbn13(row),publisher:readString(row,['publisher']),
    open_library_edition_id:readOpenLibraryId(row,OPEN_LIBRARY_EDITION_ID_COLUMNS,'edition'),
  }]:[];});
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
  const edition=selectStrictEdition(strictEditions(relatedEditions),locale,title);
  const base:Book={id:`work-${workId}`,source:'supabase',workId,
    sourceType:readString(work,['source_type']),openLibraryWorkId:readOpenLibraryId(work,OPEN_LIBRARY_WORK_ID_COLUMNS,'work'),
    title,author:author?readString(author,['name','author_name'])??'Unknown author':'Unknown author',
    firstPublishYear:getWorkFirstPublishYear(readNumber(work,['first_publish_year','first_published_year'])),
    score:null,ratingsCount:null,match:null,cover:COVER_STYLES[index%COVER_STYLES.length]};
  return withStrictEdition(base,edition,locale);
}

export function mapCatalogWorks(rows: unknown, locale:Locale='en'): Book[] {
  return asRows(rows)
    .map((work, index) => mapCatalogBook(work, [], [], index, locale))
    .filter((book): book is Book => book !== null);
}

export async function loadCatalogBooks(limit = 50): Promise<Book[]> {
  return (await loadHomepageCatalog(limit)).books;
}

export async function loadCatalogBooksByIds(
  workIds: readonly string[],
  prefetchedSummaries?: ReadonlyMap<string, PublicRatingSummary>,
  locale: Locale = 'en',
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

  const [works, summaries] = await Promise.all([
    completeEditions(asRows(result.data)),
    prefetchedSummaries ?? loadPublicRatingSummariesBatched(supabase, ids.map(String)),
  ]);
  const catalogBooks = works
    .map((work, index) => mapCatalogBook(work, [], [], index, locale))
    .filter((book): book is Book => book !== null);
  return applyRatingSummaries(catalogBooks, summaries);
}

export async function loadCatalogBooksByIdsWithStoredCovers(
  workIds: readonly string[],
  prefetchedSummaries?: ReadonlyMap<string, PublicRatingSummary>,
  locale: Locale = 'en',
  streamCovers = false,
): Promise<Book[]> {
  const books = await loadCatalogBooksByIds(workIds, prefetchedSummaries, locale);
  // Legacy Work/ISBN cache is not edition evidence and was deliberately discarded.
  // Do not read an unused privileged cache before displaying a public book card.
  return streamCovers ? deferEditionCoverEvidence(books) : withEditionCoverEvidence(books);
}

export type CatalogBrowsePage = {
  books: Book[];
  total: number;
  page: number;
  pageSize: CatalogBrowsePageSize;
  pageCount: number;
  sort: CatalogBrowseSort;
};

async function queryCatalogBrowseRows(
  page: number,
  sort: CatalogBrowseSort,
  pageSize: CatalogBrowsePageSize,
) {
  const { from, to } = getCatalogBrowseRange(page, pageSize);
  let query = supabase
    .from('works')
    .select(HOMEPAGE_CATALOG_SELECT, { count: 'exact' });

  for (const order of getCatalogBrowseOrder(sort)) {
    query = query.order(order.column, {
      ascending: order.ascending,
      ...(order.nullsFirst === undefined
        ? {}
        : { nullsFirst: order.nullsFirst }),
    });
  }

  return query.range(from, to);
}

export async function loadCatalogBrowsePage(
  requestedPage: number,
  sort: CatalogBrowseSort,
  pageSize: CatalogBrowsePageSize = CATALOG_BROWSE_PAGE_SIZE,
  locale: Locale = 'en',
): Promise<CatalogBrowsePage> {
  const normalizedPage = normalizeCatalogBrowsePage(requestedPage);
  let result = await queryCatalogBrowseRows(normalizedPage, sort, pageSize);
  if (result.error) throw result.error;

  const total = result.count ?? result.data?.length ?? 0;
  const page = clampCatalogBrowsePage(
    normalizedPage,
    total,
    pageSize,
  );
  if (page !== normalizedPage) {
    result = await queryCatalogBrowseRows(page, sort, pageSize);
    if (result.error) throw result.error;
  }

  const catalogBooks = (await completeEditions(asRows(result.data)))
    .map((work, index) => mapCatalogBook(work, [], [], index, locale))
    .filter((book): book is Book => book !== null);
  const workIds = catalogBooks.flatMap((book) =>
    book.workId ? [book.workId] : []);
  const summaries = await loadPublicRatingSummariesBatched(supabase, workIds);

  return {
    books: await withEditionCoverEvidence(applyRatingSummaries(catalogBooks, summaries)),
    total,
    page,
    pageSize,
    pageCount: getCatalogBrowsePageCount(total, pageSize),
    sort,
  };
}

export async function loadHomepageCatalog(limit = 18, locale:Locale='en'): Promise<{
  books: Book[];
  total: number;
}> {
  const safeLimit = Math.min(100, Math.max(1, Math.trunc(limit)));
  const { works, authors, editions, total } = await loadCatalogRows(safeLimit);

  const catalogBooks = (await completeEditions(works))
    .map((work, index) => mapCatalogBook(work, authors, editions, index,locale))
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
  const books = await loadCatalogBooksByIds(workIds,undefined,'nl');
  return withEditionCoverEvidence(books.filter(isDutchLanguageBook));
}

export async function loadHighestRatedCatalog(limit = 8, locale:Locale='en', streamCovers = false): Promise<{
  books: Book[];
  total: number;
}> {
  const rankedPage = await supabase.rpc('catalog_discovery_page', highestRatedPageArgs(limit));
  if (rankedPage.error) throw rankedPage.error;
  const { ids, total } = readHighestRatedPage(rankedPage.data, limit);
  if (ids.length === 0) return { books: [], total };
  // Do not turn a failed aggregate request into a misleading empty catalog.
  const summaryResponse = await supabase.rpc('get_work_rating_summaries_v2', { target_work_ids: ids.map(Number) });
  if (summaryResponse.error) throw summaryResponse.error;
  if (!Array.isArray(summaryResponse.data)) throw new Error('Highest-rated summaries unavailable.');
  const summaries = ratingSummaryMap(summaryResponse.data as PublicRatingSummaryRow[]);
  const books = await loadCatalogBooksByIds(
    ids,
    summaries, locale,
  );
  const booksById = new Map(
    books.flatMap((book): Array<[string, Book]> =>
      book.workId ? [[book.workId, book]] : []),
  );

  const rankedBooks = ids.flatMap((workId) => {
      const book = booksById.get(workId);
      return book && book.score !== null && Boolean(book.ratingBand) ? [book] : [];
    });
  return {
    books: streamCovers ? deferEditionCoverEvidence(rankedBooks) : await withEditionCoverEvidence(rankedBooks),
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
  const rawWork = asRow(result.data);
  if (!rawWork) return null;
  const work=(await completeEditions([rawWork]))[0];
  const book=mapCatalogBook(work,[],[],0,locale);
  if(book)return (await withEditionCoverEvidence([book]))[0];
  const title=readString(work,['title'])??'';
  return unavailableEdition({id:`work-${workId}`,source:'supabase',workId,title,
    author:readString(getRelatedAuthor(work,[])??{},['name'])??'Unknown author',
    openLibraryWorkId:readOpenLibraryId(work,OPEN_LIBRARY_WORK_ID_COLUMNS,'work'),
    cover:'orbit',score:null,ratingsCount:null,match:null},locale);
}
