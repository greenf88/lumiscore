import type { CollectionSummary, CollectionType } from './model.ts';

export const COLLECTION_DIRECTORY_FILTERS = [
  'all',
  'series',
  'universe',
  'author_collection',
] as const;
export type CollectionDirectoryFilter =
  (typeof COLLECTION_DIRECTORY_FILTERS)[number];

export type CollectionDirectoryMembership = {
  collectionId: string;
  workId: string;
  sequenceNumber: number | null;
  publicationOrder: number | null;
};

export type CollectionDirectoryBaseItem = {
  collection: CollectionSummary;
  cataloguedBookCount: number;
  cataloguedMainSeriesCount: number;
  catalogComplete: boolean;
  representativeWorkIds: string[];
};

const COLLECTION_TYPE_ORDER: Record<CollectionType, number> = {
  series: 0,
  author_collection: 1,
  universe: 2,
};

export function normalizeCollectionDirectoryFilter(
  value: unknown,
): CollectionDirectoryFilter {
  const candidate = Array.isArray(value) ? value[0] : value;
  return COLLECTION_DIRECTORY_FILTERS.includes(
    candidate as CollectionDirectoryFilter,
  )
    ? candidate as CollectionDirectoryFilter
    : 'all';
}

export function getCollectionDirectoryHref(
  filter: CollectionDirectoryFilter,
): string {
  return filter === 'all'
    ? '/collections'
    : `/collections?type=${encodeURIComponent(filter)}`;
}

export function getCollectionHref(slug: string): string {
  return `/collection/${encodeURIComponent(slug)}`;
}

function membershipOrder(
  type: CollectionType,
  left: CollectionDirectoryMembership,
  right: CollectionDirectoryMembership,
): number {
  const leftOrder = type === 'series'
    ? left.sequenceNumber
    : left.publicationOrder;
  const rightOrder = type === 'series'
    ? right.sequenceNumber
    : right.publicationOrder;
  return (leftOrder ?? Number.MAX_SAFE_INTEGER) -
    (rightOrder ?? Number.MAX_SAFE_INTEGER) ||
    Number(left.workId) - Number(right.workId) ||
    left.workId.localeCompare(right.workId, 'en');
}

export function buildCollectionDirectoryBaseItems(
  collections: readonly CollectionSummary[],
  memberships: readonly CollectionDirectoryMembership[],
): CollectionDirectoryBaseItem[] {
  const uniqueCollections = new Map<string, CollectionSummary>();
  for (const collection of collections) {
    if (!uniqueCollections.has(collection.id)) {
      uniqueCollections.set(collection.id, collection);
    }
  }

  return [...uniqueCollections.values()]
    .map((collection) => {
      const collectionMemberships = memberships
        .filter(({ collectionId }) => collectionId === collection.id)
        .toSorted((left, right) =>
          membershipOrder(collection.collectionType, left, right));
      const workIds = [...new Set(
        collectionMemberships.map(({ workId }) => workId),
      )];
      const mainSeriesPositions = new Set(
        collectionMemberships.flatMap(({ sequenceNumber }) =>
          sequenceNumber !== null &&
          Number.isInteger(sequenceNumber) &&
          sequenceNumber > 0
            ? [sequenceNumber]
            : []),
      );
      const expectedTotal = collection.collectionType === 'series'
        ? collection.expectedMainSeriesTotal
        : null;
      const catalogComplete = expectedTotal !== null &&
        mainSeriesPositions.size === expectedTotal &&
        Array.from({ length: expectedTotal }, (_, index) => index + 1)
          .every((position) => mainSeriesPositions.has(position));

      return {
        collection,
        cataloguedBookCount: workIds.length,
        cataloguedMainSeriesCount: mainSeriesPositions.size,
        catalogComplete,
        representativeWorkIds: workIds.slice(0, 3),
      };
    })
    .toSorted((left, right) =>
      COLLECTION_TYPE_ORDER[left.collection.collectionType] -
        COLLECTION_TYPE_ORDER[right.collection.collectionType] ||
      left.collection.name.localeCompare(right.collection.name, 'en', {
        sensitivity: 'base',
      }) ||
      left.collection.id.localeCompare(right.collection.id, 'en'));
}

export function filterCollectionDirectoryItems<T extends { collection: CollectionSummary }>(
  items: readonly T[],
  filter: CollectionDirectoryFilter,
): T[] {
  return filter === 'all'
    ? [...items]
    : items.filter(({ collection }) => collection.collectionType === filter);
}

export type CollectionDirectoryCoverage =
  | { kind: 'complete'; count: number; total: number }
  | { kind: 'incomplete'; count: number; total: number }
  | { kind: 'count'; count: number; total: null };

export function getCollectionDirectoryCoverage(item: Pick<
  CollectionDirectoryBaseItem,
  'collection' | 'cataloguedBookCount' | 'cataloguedMainSeriesCount' | 'catalogComplete'
>): CollectionDirectoryCoverage {
  const total = item.collection.collectionType === 'series'
    ? item.collection.expectedMainSeriesTotal
    : null;
  if (total === null) {
    return { kind: 'count', count: item.cataloguedBookCount, total: null };
  }
  return {
    kind: item.catalogComplete ? 'complete' : 'incomplete',
    count: item.cataloguedMainSeriesCount,
    total,
  };
}
