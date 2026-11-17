import { parsePublicBooks, type PublicBook } from '../books/public-book.ts';
import type { GuestDecision } from './guest-round.ts';
import type {GuestRatingResult} from './guest-rating-result.ts';
import {TASTE_TRAITS} from './traits.ts';
export const GUEST_ROUND_SESSION_TTL = 24 * 60 * 60 * 1000;
export const newGuestRoundExpiry = () => Date.now() + GUEST_ROUND_SESSION_TTL;
export const guestRoundSessionKey = (locale: string) => `lumiscore-guest-round-v2:${locale}`;
export type GuestRoundSession = { expires: number; decisions: GuestDecision[]; books: PublicBook[]; result?: GuestRatingResult };
function storedResult(value: GuestRatingResult | undefined): GuestRatingResult | undefined {
  if (!value?.profile || !Array.isArray(value.recommendations) || value.recommendations.length>5) return;
  const p=value.profile;
  if(!['LOW','MEDIUM','HIGH'].includes(p.confidence) || p.ratingCount!==10 || !Number.isInteger(p.classifiedCount) || !Number.isInteger(p.selectedCount) || !Array.isArray(p.affinities) || p.affinities.length>18 || !p.vector || TASTE_TRAITS.some(t=>!Number.isFinite(p.vector[t])))return;
  if(p.affinities.some(a=>!a || !TASTE_TRAITS.includes(a.trait) || ![a.books,a.positiveBooks,a.answerSupport].every(Number.isFinite) || (a.score!==null&&!Number.isFinite(a.score))))return;
  if(value.recommendations.some(x=>!x || typeof x.explanation!=='string' || x.explanation.length>1000 || !x.book?.workId || parsePublicBooks([x.book]).length!==1))return;
  return {...value,recommendations:value.recommendations.map(x=>({...x,book:parsePublicBooks([x.book])[0]}))};
}
export function readGuestRoundSession(raw: string | null, now = Date.now()): GuestRoundSession | null {
  try {
    const value = JSON.parse(raw ?? 'null');
    if (!value || !Number.isFinite(value.expires) || value.expires <= now || value.expires > now + GUEST_ROUND_SESSION_TTL ||
      !Array.isArray(value.decisions) || value.decisions.length > 200 || !Array.isArray(value.books) || value.books.length > 200) return null;
    const ids = new Set<string>(); let rated = 0;
    for (const row of value.decisions) {
      if (!row || typeof row.workId !== 'string' || !/^[1-9]\d*$/.test(row.workId) || !Number.isSafeInteger(Number(row.workId)) || ids.has(row.workId) ||
        (row.rating !== null && (!Number.isInteger(row.rating) || row.rating < 1 || row.rating > 10))) return null;
      ids.add(row.workId); if (row.rating !== null) rated++;
    }
    if (rated > 10) return null;
    return { expires: value.expires, decisions: value.decisions, books: parsePublicBooks(value.books), ...(rated===10 ? {result:storedResult(value.result)} : {}) };
  } catch { return null; }
}
