import {canonicalizeRatedStatuses} from './status-mutations.ts';
import {isReadingStatus} from './model.ts';
export type ProfileRatingRow = {work_id: number | string; rating: number};
export type ProfileStatusRow = {work_id: number | string; status: string};
export type ReadingTotals = {read: number; rated: number; wantToRead: number; reading: number};

/** Independent, overlapping counts of unique Works; a rating implies Read. */
export function readingProfileTotals(ratings: readonly ProfileRatingRow[], rows: readonly ProfileStatusRow[]): ReadingTotals {
  const ratedWorkIds = new Set(ratings.filter(r=>Number.isInteger(r.rating)&&r.rating>=1&&r.rating<=10).map(r=>String(r.work_id)));
  const statuses = new Map(rows.flatMap(r=>isReadingStatus(r.status)?[[String(r.work_id),r.status] as const]:[]));
  const canonical = canonicalizeRatedStatuses({statuses,ratedWorkIds});
  const count = (status: string) => [...canonical.statuses.values()].filter(x=>x===status).length;
  return {read:count('read'),rated:ratedWorkIds.size,wantToRead:count('want_to_read'),reading:count('reading')};
}
