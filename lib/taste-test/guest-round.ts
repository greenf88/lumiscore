import type { Book } from '../../app/data/books.ts';
import { isBookPresentationAllowed } from '../books/strict-edition.ts';
import type { Locale } from '../i18n/config.ts';
import { parseRating } from '../ratings/model.ts';
import { buildTasteProfile } from './profile.ts';
import type { TasteVector } from './traits.ts';

export const GUEST_ROUND_GOAL = 10;
export type GuestOffer = { book: Book & { workId: string }; traits: TasteVector };
export type GuestDecision = { workId: string; rating: number | null };
export type GuestInventoryRow = { work_id: number; series_ids: number[] };

export function selectGuestBooks(inventory: readonly GuestInventoryRow[], books: readonly Book[], locale: Locale) {
  const byId = new Map(books.map(book => [book.workId, book]));
  const usedSeries = new Set<number>();
  const selected: Array<Book & { workId: string }> = [];
  for (const { work_id, series_ids } of inventory) {
    const workId = String(work_id);
    const book = byId.get(workId);
    if (!book || !isBookPresentationAllowed(book, locale) || series_ids.some(id => usedSeries.has(id))) continue;
    selected.push({ ...book, workId });
    series_ids.forEach(id => usedSeries.add(id));
  }
  return selected;
}

export function guestRoundState(offers: readonly GuestOffer[], decisions: readonly GuestDecision[]) {
  const decided = new Map(decisions.map(decision => [decision.workId, decision.rating]));
  const ratings = offers.flatMap(({ book, traits }) => {
    const rating = parseRating(decided.get(book.workId));
    return rating === null ? [] : [{ workId: book.workId, rating, traits }];
  });
  const remaining = offers.filter(({ book }) => !decided.has(book.workId));
  return { ratings, remaining, next: remaining[0] };
}

export function guestRoundResult(offers: readonly GuestOffer[], decisions: readonly GuestDecision[], locale: Locale) {
  return buildTasteProfile({}, guestRoundState(offers, decisions).ratings, locale);
}
