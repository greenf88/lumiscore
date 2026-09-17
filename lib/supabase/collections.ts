import type { Book } from '../../app/data/books.ts';
import {
  calculateCollectionProgress,
  calculateSeriesProgress,
  selectHighestRatedUnread,
  selectSeriesContinuation,
  type CollectionBook,
  type CollectionProgress,
  type CollectionSummary,
  type ReadingStatus,
  type SeriesProgress,
} from '../collections/model.ts';
import { getReviewedSeriesMetadata } from '../collections/reviewed-series-metadata.ts';
import { getVerifiedServerUser } from './auth.ts';
import { loadCatalogBooksByIds } from './books.ts';
import { loadReadWorkIdsForCurrentUser } from './book-status.ts';

type CollectionRow = {
  id: number | string;
  slug: string;
  name: string;
  collection_type: CollectionSummary['collectionType'];
  description: string | null;
  expected_main_series_total: number | string | null;
};
type MembershipRow = {
  collection_id: number | string;
  work_id: number | string;
  sequence_number: number | string | null;
  publication_order: number | string | null;
  subgroup: string | null;
  collections?: CollectionRow | CollectionRow[] | null;
};
type StatusRow = { work_id: number | string; status: ReadingStatus };

export type CollectionPageData = {
  collection: CollectionSummary;
  books: CollectionBook[];
  authenticated: boolean;
  statuses: Record<string, ReadingStatus>;
  progress: CollectionProgress | SeriesProgress;
  highlightedUnreadWorkId: string | null;
};

export type BookCollectionContext = {
  collection: CollectionSummary;
  position: number | null;
  total: number | null;
  progress: CollectionProgress | null;
};

export type HomepageSeriesContinuation = {
  collection: CollectionSummary;
  progress: SeriesProgress;
  nextBook: Book;
};

function asNumber(value: unknown): number | null {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function mapCollection(row: CollectionRow): CollectionSummary {
  const reviewedSeries = row.collection_type === 'series'
    ? getReviewedSeriesMetadata(row.slug)
    : null;
  const storedExpectedTotal = row.expected_main_series_total === null
    ? null
    : asNumber(row.expected_main_series_total);
  return {
    id: String(row.id),
    slug: row.slug,
    name: row.name,
    collectionType: row.collection_type,
    description: row.description,
    expectedMainSeriesTotal: storedExpectedTotal ?? reviewedSeries?.expectedMainSeriesTotal ?? null,
  };
}

function relatedCollection(row: MembershipRow): CollectionRow | null {
  return Array.isArray(row.collections)
    ? row.collections[0] ?? null
    : row.collections ?? null;
}

function mapMembership(row: MembershipRow, book: Book): CollectionBook {
  return {
    workId: String(row.work_id),
    sequenceNumber: row.sequence_number === null ? null : asNumber(row.sequence_number),
    publicationOrder: row.publication_order === null ? null : asNumber(row.publication_order),
    subgroup: row.subgroup,
    book,
  };
}

function statusRecord(rows: readonly StatusRow[]): Record<string, ReadingStatus> {
  return Object.fromEntries(rows.map((row) => [String(row.work_id), row.status]));
}

function sortCollectionBooks(
  type: CollectionSummary['collectionType'],
  books: CollectionBook[],
): CollectionBook[] {
  return [...books].sort((left, right) => {
    if (type === 'series') {
      return (left.sequenceNumber ?? Number.MAX_SAFE_INTEGER) -
        (right.sequenceNumber ?? Number.MAX_SAFE_INTEGER);
    }
    return (left.publicationOrder ?? Number.MAX_SAFE_INTEGER) -
      (right.publicationOrder ?? Number.MAX_SAFE_INTEGER) ||
      left.book.title.localeCompare(right.book.title, 'en', { sensitivity: 'base' });
  });
}

export async function loadCollectionPageData(slug: string): Promise<CollectionPageData | null> {
  const { client, user } = await getVerifiedServerUser();
  const collectionResult = await client
    .from('collections')
    .select('id,slug,name,collection_type,description,expected_main_series_total')
    .eq('slug', slug)
    .maybeSingle();
  if (collectionResult.error) throw collectionResult.error;
  if (!collectionResult.data) return null;

  const collection = mapCollection(collectionResult.data as CollectionRow);
  const membershipResult = await client
    .from('collection_books')
    .select('collection_id,work_id,sequence_number,publication_order,subgroup')
    .eq('collection_id', collection.id);
  if (membershipResult.error) throw membershipResult.error;
  const memberships = (membershipResult.data ?? []) as MembershipRow[];
  const workIds = memberships.map((row) => String(row.work_id));
  const [catalogBooks, statusesResult] = await Promise.all([
    loadCatalogBooksByIds(workIds),
    user && workIds.length > 0
      ? client.from('user_book_status').select('work_id,status')
        .eq('user_id', user.id).in('work_id', workIds.map(Number))
      : Promise.resolve({ data: [] as StatusRow[], error: null }),
  ]);
  if (statusesResult.error) throw statusesResult.error;
  const booksById = new Map(catalogBooks.flatMap((book): Array<[string, Book]> =>
    book.workId ? [[book.workId, book]] : []));
  const books = sortCollectionBooks(collection.collectionType, memberships.flatMap((row) => {
    const book = booksById.get(String(row.work_id));
    return book ? [mapMembership(row, book)] : [];
  }));
  const statuses = statusRecord((statusesResult.data ?? []) as StatusRow[]);
  const statusMap = new Map(Object.entries(statuses));
  const progress = collection.collectionType === 'series'
    ? calculateSeriesProgress(books, statusMap, collection.expectedMainSeriesTotal)
    : calculateCollectionProgress(books, statusMap);
  const highlighted = collection.collectionType === 'author_collection'
    ? selectHighestRatedUnread(books, statusMap)
    : null;

  return {
    collection,
    books,
    authenticated: Boolean(user),
    statuses,
    progress,
    highlightedUnreadWorkId: highlighted?.workId ?? null,
  };
}

export async function loadBookCollectionContext(
  workId: string,
): Promise<BookCollectionContext | null> {
  const { client, user } = await getVerifiedServerUser();
  const membershipResult = await client
    .from('collection_books')
    .select('collection_id,work_id,sequence_number,publication_order,subgroup,collections(id,slug,name,collection_type,description,expected_main_series_total)')
    .eq('work_id', Number(workId));
  if (membershipResult.error) throw membershipResult.error;
  const memberships = (membershipResult.data ?? []) as unknown as MembershipRow[];
  const primary = [...memberships].sort((left, right) => {
    const rank = (row: MembershipRow) => {
      const type = relatedCollection(row)?.collection_type;
      return type === 'series' && row.sequence_number !== null
        ? 0
        : type === 'author_collection'
          ? 1
          : 2;
    };
    return rank(left) - rank(right);
  })[0];
  const collectionRow = primary ? relatedCollection(primary) : null;
  if (!primary || !collectionRow) return null;

  const collection = mapCollection(collectionRow);
  const allMembershipsResult = await client
    .from('collection_books')
    .select('work_id,sequence_number')
    .eq('collection_id', collection.id);
  if (allMembershipsResult.error) throw allMembershipsResult.error;
  const allMemberships = (allMembershipsResult.data ?? []) as MembershipRow[];
  const contextBooks = allMemberships.map((row) => mapMembership(
    row,
    placeholderBook(String(row.work_id)),
  ));
  const emptyStatusMap = new Map<string, ReadingStatus>();
  const denominatorProgress = collection.collectionType === 'series'
    ? calculateSeriesProgress(
      contextBooks,
      emptyStatusMap,
      collection.expectedMainSeriesTotal,
    )
    : calculateCollectionProgress(contextBooks, emptyStatusMap);
  let progress: CollectionProgress | null = null;
  if (user && allMemberships.length > 0) {
    const statusResult = await client
      .from('user_book_status')
      .select('work_id,status')
      .eq('user_id', user.id)
      .in('work_id', allMemberships.map((row) => Number(row.work_id)));
    if (statusResult.error) throw statusResult.error;
    const statusMap = new Map(
      ((statusResult.data ?? []) as StatusRow[])
        .map((row) => [String(row.work_id), row.status] as const),
    );
    progress = collection.collectionType === 'series'
      ? calculateSeriesProgress(
        contextBooks,
        statusMap,
        collection.expectedMainSeriesTotal,
      )
      : calculateCollectionProgress(contextBooks, statusMap);
  }

  return {
    collection,
    position: primary.sequence_number === null ? null : asNumber(primary.sequence_number),
    total: denominatorProgress.total,
    progress,
  };
}

function placeholderBook(workId: string): Book {
  return {
    id: `work-${workId}`,
    source: 'supabase',
    workId,
    title: workId,
    author: '',
    score: null,
    ratingsCount: null,
    match: null,
    cover: 'orbit',
  };
}

export async function loadHomepageSeriesContinuation(): Promise<HomepageSeriesContinuation | null> {
  const [{ client }, readState] = await Promise.all([
    getVerifiedServerUser(),
    loadReadWorkIdsForCurrentUser(),
  ]);
  if (!readState.authenticated || readState.workIds.length === 0) return null;
  const readRows = readState.workIds.map((workId) => ({
    work_id: workId,
    status: 'read' as const,
  }));

  const touchedMemberships = await client
    .from('collection_books')
    .select('collection_id,work_id,sequence_number,collections(id,slug,name,collection_type,description,expected_main_series_total)')
    .in('work_id', readRows.map((row) => Number(row.work_id)));
  if (touchedMemberships.error) throw touchedMemberships.error;
  const touched = (touchedMemberships.data ?? []) as unknown as MembershipRow[];
  const collectionMap = new Map<string, CollectionSummary>();
  for (const membership of touched) {
    const row = relatedCollection(membership);
    if (row?.collection_type === 'series') {
      collectionMap.set(String(row.id), mapCollection(row));
    }
  }
  const collectionIds = [...collectionMap.keys()];
  if (collectionIds.length === 0) return null;

  const allMembershipsResult = await client
    .from('collection_books')
    .select('collection_id,work_id,sequence_number,publication_order,subgroup')
    .in('collection_id', collectionIds.map(Number));
  if (allMembershipsResult.error) throw allMembershipsResult.error;
  const allMemberships = (allMembershipsResult.data ?? []) as MembershipRow[];
  const statusMap = new Map(readRows.map((row) => [String(row.work_id), 'read' as const]));
  const candidates = [...collectionMap.entries()].map(([collectionId, collection]) => {
    const books = allMemberships
      .filter((row) => String(row.collection_id) === collectionId)
      .map((row) => mapMembership(row, placeholderBook(String(row.work_id))));
    return {
      collection,
      progress: calculateSeriesProgress(
        books,
        statusMap,
        collection.expectedMainSeriesTotal,
      ),
    };
  });
  const selected = selectSeriesContinuation(candidates);
  if (!selected?.progress.nextBook) return null;
  const [nextBook] = await loadCatalogBooksByIds([selected.progress.nextBook.workId]);
  return nextBook ? { ...selected, nextBook } : null;
}
