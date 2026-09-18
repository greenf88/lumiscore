import type { Book } from '../../app/data/books.ts';

export const COLLECTION_TYPES = ['series', 'universe', 'author_collection'] as const;
export type CollectionType = (typeof COLLECTION_TYPES)[number];

export const READING_STATUSES = ['want_to_read', 'reading', 'read', 'dnf'] as const;
export type ReadingStatus = (typeof READING_STATUSES)[number];

export type CollectionSummary = {
  id: string;
  slug: string;
  name: string;
  collectionType: CollectionType;
  description: string | null;
  expectedMainSeriesTotal: number | null;
};

export type CollectionBook = {
  workId: string;
  sequenceNumber: number | null;
  publicationOrder: number | null;
  subgroup: string | null;
  book: Book;
};

export type CollectionProgress = {
  read: number;
  cataloguedTotal: number;
  total: number | null;
  percentage: number | null;
};

export type SeriesProgress = CollectionProgress & {
  sequenceComplete: boolean;
  contiguousRead: number;
  continueBook: CollectionBook | null;
  nextBook: CollectionBook | null;
  actionBook: CollectionBook | null;
  catalogComplete: boolean;
  complete: boolean;
};

export type SeriesContinuationCandidate = {
  collection: CollectionSummary;
  progress: SeriesProgress;
  touched: boolean;
  lastInteractedAt: string | null;
};

const EMPTY_RATED_WORK_IDS: ReadonlySet<string> = new Set();

export function isReadingStatus(value: unknown): value is ReadingStatus {
  return READING_STATUSES.includes(value as ReadingStatus);
}

export function calculateCollectionProgress(
  books: readonly CollectionBook[],
  statuses: ReadonlyMap<string, ReadingStatus>,
  ratedWorkIds: ReadonlySet<string> = EMPTY_RATED_WORK_IDS,
): CollectionProgress {
  const read = books.filter(({ workId }) =>
    statuses.get(workId) === 'read' || ratedWorkIds.has(workId)).length;
  const total = books.length;
  return {
    read,
    cataloguedTotal: total,
    total,
    percentage: total === 0 ? 0 : Math.round((read / total) * 100),
  };
}

function safeExpectedSeriesTotal(
  books: readonly CollectionBook[],
  expectedMainSeriesTotal: number | null,
): number | null {
  if (
    expectedMainSeriesTotal === null ||
    !Number.isInteger(expectedMainSeriesTotal) ||
    expectedMainSeriesTotal <= 0
  ) {
    return null;
  }

  if (books.length > expectedMainSeriesTotal) return null;

  const numbered = books
    .map(({ sequenceNumber }) => sequenceNumber)
    .filter((position): position is number => position !== null);
  return numbered.some((position) => position > expectedMainSeriesTotal)
    ? null
    : expectedMainSeriesTotal;
}

function orderedSeriesBooks(books: readonly CollectionBook[]): CollectionBook[] | null {
  if (books.length === 0 || books.some(({ sequenceNumber }) => sequenceNumber === null)) {
    return null;
  }

  const ordered = [...books].sort(
    (left, right) => left.sequenceNumber! - right.sequenceNumber!,
  );
  const completeSequence = ordered.every(
    ({ sequenceNumber }, index) => sequenceNumber === index + 1,
  );
  return completeSequence ? ordered : null;
}

export function calculateSeriesProgress(
  books: readonly CollectionBook[],
  statuses: ReadonlyMap<string, ReadingStatus>,
  expectedMainSeriesTotal: number | null = null,
  ratedWorkIds: ReadonlySet<string> = EMPTY_RATED_WORK_IDS,
): SeriesProgress {
  const collectionProgress = calculateCollectionProgress(books, statuses, ratedWorkIds);
  const total = safeExpectedSeriesTotal(books, expectedMainSeriesTotal);
  const progress: CollectionProgress = {
    ...collectionProgress,
    total,
    percentage: total === null ? null : Math.round((collectionProgress.read / total) * 100),
  };
  const ordered = orderedSeriesBooks(books);
  if (!ordered) {
    return {
      ...progress,
      sequenceComplete: false,
      contiguousRead: 0,
      continueBook: null,
      nextBook: null,
      actionBook: null,
      catalogComplete: false,
      complete: false,
    };
  }

  const isCompleted = ({ workId }: CollectionBook) =>
    statuses.get(workId) === 'read' || ratedWorkIds.has(workId);
  let contiguousRead = 0;
  while (
    contiguousRead < ordered.length &&
    isCompleted(ordered[contiguousRead])
  ) {
    contiguousRead += 1;
  }

  const continueBook = ordered.find(({ workId }) =>
    statuses.get(workId) === 'reading' && !ratedWorkIds.has(workId)) ?? null;
  const nextBook = ordered.find((book) => !isCompleted(book)) ?? null;

  const catalogComplete = total !== null &&
    ordered.length === total &&
    ordered.every(({ sequenceNumber }, index) => sequenceNumber === index + 1);

  return {
    ...progress,
    sequenceComplete: true,
    contiguousRead,
    continueBook,
    nextBook,
    actionBook: continueBook ?? nextBook,
    catalogComplete,
    complete: catalogComplete && progress.read === total,
  };
}

export function selectHighestRatedUnread(
  books: readonly CollectionBook[],
  statuses: ReadonlyMap<string, ReadingStatus>,
): CollectionBook | null {
  const unread = books.filter(({ workId }) => statuses.get(workId) !== 'read');
  if (unread.length === 0) return null;

  return [...unread].sort((left, right) => {
    const leftRated = left.book.score !== null && (left.book.ratingsCount ?? 0) > 0;
    const rightRated = right.book.score !== null && (right.book.ratingsCount ?? 0) > 0;
    if (leftRated !== rightRated) return leftRated ? -1 : 1;
    if (leftRated && rightRated && left.book.score !== right.book.score) {
      return right.book.score! - left.book.score!;
    }
    if ((left.book.ratingsCount ?? 0) !== (right.book.ratingsCount ?? 0)) {
      return (right.book.ratingsCount ?? 0) - (left.book.ratingsCount ?? 0);
    }
    if ((left.book.firstPublishYear ?? Number.MAX_SAFE_INTEGER) !==
      (right.book.firstPublishYear ?? Number.MAX_SAFE_INTEGER)) {
      return (left.book.firstPublishYear ?? Number.MAX_SAFE_INTEGER) -
        (right.book.firstPublishYear ?? Number.MAX_SAFE_INTEGER);
    }
    return left.book.title.localeCompare(right.book.title, 'en', {
      sensitivity: 'base',
    });
  })[0];
}

export function selectSeriesContinuation<T extends {
  collection: CollectionSummary;
  progress: SeriesProgress;
}>(candidates: readonly T[]): T | null {
  return selectSeriesContinuations(
    candidates.map((candidate) => ({
      ...candidate,
      touched: candidate.progress.read > 0,
      lastInteractedAt: null,
    })),
    1,
  )[0] as T | undefined ?? null;
}

function activityTime(value: string | null): number {
  if (!value) return 0;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function continuationPriority(progress: SeriesProgress): number {
  if (progress.continueBook) return 0;
  if (progress.read > 0) return 1;
  return 2;
}

export function selectSeriesContinuations<T extends SeriesContinuationCandidate>(
  candidates: readonly T[],
  limit = 3,
): T[] {
  const safeLimit = Math.max(0, Math.trunc(limit));
  return [...candidates]
    .filter(({ collection, progress, touched }) =>
      touched &&
      collection.collectionType === 'series' &&
      progress.sequenceComplete &&
      !progress.complete &&
      progress.actionBook !== null)
    .sort((left, right) =>
      continuationPriority(left.progress) - continuationPriority(right.progress) ||
      activityTime(right.lastInteractedAt) - activityTime(left.lastInteractedAt) ||
      right.progress.contiguousRead - left.progress.contiguousRead ||
      (right.progress.percentage ?? -1) - (left.progress.percentage ?? -1) ||
      left.collection.name.localeCompare(right.collection.name, 'en', {
        sensitivity: 'base',
      }) ||
      left.collection.slug.localeCompare(right.collection.slug, 'en', {
        sensitivity: 'base',
      }))
    .slice(0, safeLimit);
}
