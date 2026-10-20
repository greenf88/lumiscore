import type { Locale } from '../i18n/config.ts';
export type SearchCacheRead = 'fresh' | 'cache' | 'coalesced';
export function newSearchObservation(locale: Locale) {
  return { locale, cache: 'fresh' as SearchCacheRead, databaseRequests: 0, worksLoaded: 0, editionsLoaded: 0,
    candidateIdsLoaded: 0, eligibleTotal: 0, shown: 0, coverSourceRequests: 0, selectionMs: 0, scoresMs: 0 };
}
/** Operational counters only, never query text, Work IDs, scores or user fields.
 * Not an analytics endpoint, write, profile cache or per-person event stream. */
export function searchObservationEvent(value: ReturnType<typeof newSearchObservation>) {
  return { event: 'public_search_counts', dataClass: 'public', locale: value.locale, cache: value.cache,
    databaseRequests: value.databaseRequests, worksLoaded: value.worksLoaded, editionsLoaded: value.editionsLoaded,
    candidateIdsLoaded: value.candidateIdsLoaded, eligibleTotal: value.eligibleTotal, shown: value.shown,
    coverSourceRequests: value.coverSourceRequests, selectionMs: Math.round(value.selectionMs), scoresMs: Math.round(value.scoresMs) };
}
