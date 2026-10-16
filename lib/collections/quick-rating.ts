import type {CollectionBook} from './model.ts';

export const QUICK_RATING_COLLECTION = 'suzanne-vermeer';
export type QuickRatingSession = {
  version: 1; userId: string; collectionId: string;
  newRatedIds: string[]; skippedIds: string[];
};

export function uniqueCollectionBooks(books: readonly CollectionBook[]): CollectionBook[] {
  const seen = new Set<string>();
  return books.filter(item => {
    if (!item.workId || item.book.workId !== item.workId || seen.has(item.workId)) return false;
    seen.add(item.workId); return true;
  });
}

export function quickRatingStorageKey(userId: string, collectionId: string): string {
  return `lumiscore-collection-rating-v1:${encodeURIComponent(userId)}:${encodeURIComponent(collectionId)}`;
}

export function reconcileQuickSession(value: unknown, userId: string, collectionId: string,
  memberIds: readonly string[], ratedIds: readonly string[]): QuickRatingSession {
  const members = new Set(memberIds), rated = new Set(ratedIds);
  const valid = value && typeof value === 'object' && 'version' in value && value.version === 1
    && 'userId' in value && value.userId === userId && 'collectionId' in value && value.collectionId === collectionId;
  const session = valid ? value as QuickRatingSession : null;
  const strings = (input: unknown) => Array.isArray(input) ? [...new Set(input.filter((id): id is string => typeof id === 'string' && members.has(id)))] : [];
  return {version: 1, userId, collectionId,
    newRatedIds: strings(session?.newRatedIds).filter(id => rated.has(id)),
    skippedIds: strings(session?.skippedIds).filter(id => !rated.has(id))};
}

export function quickRatingProgress(books: readonly CollectionBook[], ratedIds: readonly string[], session: QuickRatingSession) {
  const members = uniqueCollectionBooks(books), rated = new Set(ratedIds), skipped = new Set(session.skippedIds);
  const newRated = session.newRatedIds.filter(id => rated.has(id) && members.some(book => book.workId === id)).length;
  const previouslyRated = members.filter(item => rated.has(item.workId)).length - newRated;
  const remaining = members.filter(item => !rated.has(item.workId) && !skipped.has(item.workId));
  const skippedCount = members.filter(item => !rated.has(item.workId) && skipped.has(item.workId)).length;
  return {remaining, newRated, previouslyRated, skipped: skippedCount, total: members.length,
    viewed: members.length - previouslyRated - remaining.length,
    toView: members.length - previouslyRated};
}
