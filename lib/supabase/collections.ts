import type { Book } from '../../app/data/books.ts';
import {
  calculateCollectionProgress,
  calculateSeriesProgress,
  selectHighestRatedUnread,
  selectSeriesContinuations,
  type CollectionBook,
  type CollectionProgress,
  type CollectionSummary,
  type ReadingStatus,
  type SeriesProgress,
} from '../collections/model.ts';
import { getReviewedSeriesMetadata } from '../collections/reviewed-series-metadata.ts';
import {
  buildCollectionDirectoryBaseItems,
  type CollectionDirectoryBaseItem,
  type CollectionDirectoryMembership,
} from '../collections/directory.ts';
import { getVerifiedServerUser } from './auth.ts';
import {
  loadCatalogBooksByIds,
  loadCatalogBooksByIdsWithStoredCovers,
} from './books.ts';
import { supabase } from './client.ts';
import { measureServerOperation } from '../performance/server-timing.ts';

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
type StatusRow = {
  work_id: number | string;
  status: ReadingStatus;
  updated_at?: string | null;
};
type RatingRow = { work_id: number | string; updated_at?: string | null };

export type CollectionPageData = {
  collection: CollectionSummary;
  books: CollectionBook[];
  authenticated: boolean;
  statuses: Record<string, ReadingStatus>;
  ratedWorkIds: string[];
  progress: CollectionProgress | SeriesProgress;
  highlightedUnreadWorkId: string | null;
};

export type BookCollectionContext = {
  collection: CollectionSummary;
  position: number | null;
  total: number | null;
  progress: CollectionProgress | null;
};

export type VerifiedBookCollectionReturnTarget = {
  slug: string;
  name: string;
};

export type HomepageSeriesContinuation = {
  collection: CollectionSummary;
  progress: SeriesProgress;
  action: 'continue_reading' | 'next_in_series';
  actionBook: Book;
  lastInteractedAt: string | null;
};

export type CollectionDirectoryItem = Omit<
  CollectionDirectoryBaseItem,
  'representativeWorkIds'
> & {
  representativeBooks: Book[];
};

export type CollectionsDirectoryData = {
  collections: CollectionDirectoryItem[];
  total: number;
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

export async function loadCollectionsDirectory(): Promise<CollectionsDirectoryData> {
  const [collectionsResult, membershipsResult] = await Promise.all([
    supabase
      .from('collections')
      .select('id,slug,name,collection_type,description,expected_main_series_total')
      .order('name', { ascending: true }),
    supabase
      .from('collection_books')
      .select('collection_id,work_id,sequence_number,publication_order')
      .order('collection_id', { ascending: true }),
  ]);
  if (collectionsResult.error) throw collectionsResult.error;
  if (membershipsResult.error) throw membershipsResult.error;

  const collections = ((collectionsResult.data ?? []) as CollectionRow[])
    .map(mapCollection);
  const memberships = (membershipsResult.data ?? []).map(
    (row): CollectionDirectoryMembership => ({
      collectionId: String(row.collection_id),
      workId: String(row.work_id),
      sequenceNumber: row.sequence_number === null
        ? null
        : asNumber(row.sequence_number),
      publicationOrder: row.publication_order === null
        ? null
        : asNumber(row.publication_order),
    }),
  );
  const baseItems = buildCollectionDirectoryBaseItems(collections, memberships);
  const representativeWorkIds = [
    ...new Set(baseItems.flatMap((item) => item.representativeWorkIds)),
  ];
  const representativeBooks = await loadCatalogBooksByIdsWithStoredCovers(
    representativeWorkIds,
    new Map(),
  );
  const booksByWorkId = new Map(
    representativeBooks.flatMap((book): Array<[string, Book]> =>
      book.workId ? [[book.workId, book]] : []),
  );

  return {
    collections: baseItems.map(({ representativeWorkIds: workIds, ...item }) => ({
      ...item,
      representativeBooks: workIds.flatMap((workId) => {
        const book = booksByWorkId.get(workId);
        return book ? [book] : [];
      }),
    })),
    total: baseItems.length,
  };
}

export async function loadCollectionPageData(slug: string): Promise<CollectionPageData | null> {
  const collectionResult = await supabase
    .from('collections')
    .select('id,slug,name,collection_type,description,expected_main_series_total')
    .eq('slug', slug)
    .maybeSingle();
  if (collectionResult.error) throw collectionResult.error;
  if (!collectionResult.data) return null;

  const collection = mapCollection(collectionResult.data as CollectionRow);
  const authPromise = measureServerOperation(
    'collection.auth',
    'private',
    getVerifiedServerUser,
  );
  const membershipResult = await supabase
    .from('collection_books')
    .select('collection_id,work_id,sequence_number,publication_order,subgroup')
    .eq('collection_id', collection.id);
  if (membershipResult.error) throw membershipResult.error;
  const memberships = (membershipResult.data ?? []) as MembershipRow[];
  const workIds = memberships.map((row) => String(row.work_id));
  const [catalogBooks, privateState] = await Promise.all([
    measureServerOperation(
      'collection.catalog',
      'public',
      () => loadCatalogBooksByIdsWithStoredCovers(workIds),
    ),
    authPromise.then(async ({ client, user }) => {
      const [statusesResult, ratingsResult] = await Promise.all([
        user && workIds.length > 0
          ? client.from('user_book_status').select('work_id,status')
            .eq('user_id', user.id).in('work_id', workIds.map(Number))
          : Promise.resolve({ data: [] as StatusRow[], error: null }),
        user && workIds.length > 0
          ? client.from('ratings').select('work_id')
            .eq('user_id', user.id).in('work_id', workIds.map(Number))
          : Promise.resolve({ data: [] as RatingRow[], error: null }),
      ]);
      return { user, statusesResult, ratingsResult };
    }),
  ]);
  const { user, statusesResult, ratingsResult } = privateState;
  if (statusesResult.error) throw statusesResult.error;
  if (ratingsResult.error) throw ratingsResult.error;
  const booksById = new Map(catalogBooks.flatMap((book): Array<[string, Book]> =>
    book.workId ? [[book.workId, book]] : []));
  const books = sortCollectionBooks(collection.collectionType, memberships.flatMap((row) => {
    const book = booksById.get(String(row.work_id));
    return book ? [mapMembership(row, book)] : [];
  }));
  const ratedWorkIds = ((ratingsResult.data ?? []) as RatingRow[])
    .map((row) => String(row.work_id));
  const statuses = statusRecord((statusesResult.data ?? []) as StatusRow[]);
  for (const workId of ratedWorkIds) statuses[workId] ??= 'read';
  const statusMap = new Map(Object.entries(statuses));
  const ratedWorkIdSet = new Set(ratedWorkIds);
  const progress = collection.collectionType === 'series'
    ? calculateSeriesProgress(
      books,
      statusMap,
      collection.expectedMainSeriesTotal,
      ratedWorkIdSet,
    )
    : calculateCollectionProgress(books, statusMap, ratedWorkIdSet);
  const highlighted = collection.collectionType === 'author_collection'
    ? selectHighestRatedUnread(books, statusMap)
    : null;

  return {
    collection,
    books,
    authenticated: Boolean(user),
    statuses,
    ratedWorkIds,
    progress,
    highlightedUnreadWorkId: highlighted?.workId ?? null,
  };
}

export async function loadBookCollectionContext(
  workId: string,
): Promise<BookCollectionContext | null> {
  const membershipResult = await supabase
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
  const authPromise = getVerifiedServerUser();
  const allMembershipsResult = await supabase
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
  const { client, user } = await authPromise;
  if (user && allMemberships.length > 0) {
    const workIds = allMemberships.map((row) => Number(row.work_id));
    const [statusResult, ratingsResult] = await Promise.all([
      client
        .from('user_book_status')
        .select('work_id,status')
        .eq('user_id', user.id)
        .in('work_id', workIds),
      client
        .from('ratings')
        .select('work_id')
        .eq('user_id', user.id)
        .in('work_id', workIds),
    ]);
    if (statusResult.error) throw statusResult.error;
    if (ratingsResult.error) throw ratingsResult.error;
    const statusMap = new Map(
      ((statusResult.data ?? []) as StatusRow[])
        .map((row) => [String(row.work_id), row.status] as const),
    );
    const ratedWorkIds = new Set(
      ((ratingsResult.data ?? []) as RatingRow[])
        .map((row) => String(row.work_id)),
    );
    progress = collection.collectionType === 'series'
      ? calculateSeriesProgress(
        contextBooks,
        statusMap,
        collection.expectedMainSeriesTotal,
        ratedWorkIds,
      )
      : calculateCollectionProgress(contextBooks, statusMap, ratedWorkIds);
  }

  return {
    collection,
    position: primary.sequence_number === null ? null : asNumber(primary.sequence_number),
    total: denominatorProgress.total,
    progress,
  };
}

export async function loadVerifiedBookCollectionReturnTarget(
  workId: string,
  slug: string,
): Promise<VerifiedBookCollectionReturnTarget | null> {
  if (!/^[1-9]\d*$/.test(workId)) return null;

  const membershipResult = await supabase
    .from('collection_books')
    .select('work_id,collections!inner(slug,name)')
    .eq('work_id', Number(workId))
    .eq('collections.slug', slug)
    .limit(1)
    .maybeSingle();
  if (membershipResult.error) throw membershipResult.error;

  const membership = membershipResult.data as unknown as {
    work_id: number | string;
    collections?: Pick<CollectionRow, 'slug' | 'name'> | Array<Pick<CollectionRow, 'slug' | 'name'>> | null;
  } | null;
  const collection = Array.isArray(membership?.collections)
    ? membership.collections[0] ?? null
    : membership?.collections ?? null;
  if (!collection || collection.slug !== slug) return null;

  return { slug: collection.slug, name: collection.name };
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

function latestInteraction(
  workIds: readonly string[],
  activityByWorkId: ReadonlyMap<string, string>,
): string | null {
  return workIds.reduce<string | null>((latest, workId) => {
    const value = activityByWorkId.get(workId);
    if (!value) return latest;
    return !latest || Date.parse(value) > Date.parse(latest) ? value : latest;
  }, null);
}

export async function loadHomepageSeriesContinuations(
  limit = 3,
): Promise<HomepageSeriesContinuation[]> {
  const { client, user } = await getVerifiedServerUser();
  if (!user) return [];

  const [statusesResult, ratingsResult, membershipsResult] = await Promise.all([
    client
      .from('user_book_status')
      .select('work_id,status,updated_at')
      .eq('user_id', user.id),
    client
      .from('ratings')
      .select('work_id,updated_at')
      .eq('user_id', user.id),
    client
      .from('collection_books')
      .select('collection_id,work_id,sequence_number,publication_order,subgroup,collections(id,slug,name,collection_type,description,expected_main_series_total)')
      .not('sequence_number', 'is', null),
  ]);
  if (statusesResult.error) throw statusesResult.error;
  if (ratingsResult.error) throw ratingsResult.error;
  if (membershipsResult.error) throw membershipsResult.error;

  const statusRows = (statusesResult.data ?? []) as StatusRow[];
  const ratingRows = (ratingsResult.data ?? []) as RatingRow[];
  const statusMap = new Map(
    statusRows.map((row) => [String(row.work_id), row.status] as const),
  );
  const ratedWorkIds = new Set(ratingRows.map((row) => String(row.work_id)));
  const touchedWorkIds = new Set([...statusMap.keys(), ...ratedWorkIds]);
  if (touchedWorkIds.size === 0) return [];

  const activityByWorkId = new Map<string, string>();
  for (const row of [...statusRows, ...ratingRows]) {
    if (!row.updated_at) continue;
    const workId = String(row.work_id);
    const existing = activityByWorkId.get(workId);
    if (!existing || Date.parse(row.updated_at) > Date.parse(existing)) {
      activityByWorkId.set(workId, row.updated_at);
    }
  }

  const allMemberships = (membershipsResult.data ?? []) as unknown as MembershipRow[];
  const collectionMap = new Map<string, CollectionSummary>();
  for (const membership of allMemberships) {
    const row = relatedCollection(membership);
    if (row?.collection_type === 'series') {
      collectionMap.set(String(row.id), mapCollection(row));
    }
  }
  const candidates = [...collectionMap.entries()].map(([collectionId, collection]) => {
    const collectionMemberships = allMemberships
      .filter((row) => String(row.collection_id) === collectionId);
    const books = collectionMemberships
      .map((row) => mapMembership(row, placeholderBook(String(row.work_id))));
    const touchedIds = collectionMemberships
      .map((row) => String(row.work_id))
      .filter((workId) => touchedWorkIds.has(workId));
    return {
      collection,
      progress: calculateSeriesProgress(
        books,
        statusMap,
        collection.expectedMainSeriesTotal,
        ratedWorkIds,
      ),
      touched: touchedIds.length > 0,
      lastInteractedAt: latestInteraction(touchedIds, activityByWorkId),
    };
  });
  const selected = selectSeriesContinuations(candidates, Math.min(3, limit));
  if (selected.length === 0) return [];
  const actionWorkIds = selected.flatMap(({ progress }) =>
    progress.actionBook ? [progress.actionBook.workId] : []);
  const actionBooks = await loadCatalogBooksByIds(actionWorkIds);
  const booksByWorkId = new Map(actionBooks.flatMap((book) =>
    book.workId ? [[book.workId, book] as const] : []));

  return selected.flatMap((candidate): HomepageSeriesContinuation[] => {
    const actionWorkId = candidate.progress.actionBook?.workId;
    const actionBook = actionWorkId ? booksByWorkId.get(actionWorkId) : null;
    if (!actionBook) return [];
    return [{
      ...candidate,
      action: candidate.progress.continueBook
        ? 'continue_reading'
        : 'next_in_series',
      actionBook,
    }];
  });
}

export async function loadHomepageSeriesContinuation(): Promise<HomepageSeriesContinuation | null> {
  return (await loadHomepageSeriesContinuations(1))[0] ?? null;
}
