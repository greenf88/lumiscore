import type {BookDescriptionResolution} from './description-resolution.ts';
/** Public only and locale is part of the request URL. Keep corrections and
 * withdrawals observable; never cache provider failures as a missing synopsis. */
export function publicDescriptionCacheControl(state:BookDescriptionResolution['state']):string {
 if(state==='temporary_failure')return 'public, max-age=0, s-maxage=60';
 if(state==='confirmed_missing')return 'public, max-age=60, s-maxage=300';
 return 'public, max-age=60, s-maxage=300, stale-while-revalidate=300';
}
