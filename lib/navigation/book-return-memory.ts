import { splitLocalePath } from '../i18n/paths.ts';
import { getSafeBrowseReturnPath } from './browse-return.ts';
import { getSafeSearchReturnPath } from './search-return.ts';
import { recommendationReturnPath } from '../catalog/discovery.ts';

const ORIGIN = 'https://lumisco.re';
const MAX_AGE = 30 * 60 * 1_000;
const BOOK_PATH = /^\/(?:en\/|nl\/)?book\/[1-9]\d*$/;

export type LocalBookReturn = {
  href: string;
  kind: 'home' | 'browse' | 'search' | 'collections' | 'collection' | 'editorial' | 'recommendations';
};

/** Local navigation only: never a claim about collection membership or SEO. */
export function safeLocalBookReturn(value: unknown): LocalBookReturn | null {
  if (typeof value !== 'string' || value.length > 2_048 || /[\\\u0000-\u001f\u007f]/u.test(value)) return null;
  if (value === '/') return { kind: 'home', href: value };
  const search = getSafeSearchReturnPath(value);
  if (search) return { kind: 'search', href: search };
  const browse = getSafeBrowseReturnPath(value);
  if (browse) return { kind: 'browse', href: browse };
  const recommendations = recommendationReturnPath(value);
  if (recommendations) return { kind: 'recommendations', href: recommendations };
  if (/^\/collections(?:\?type=(?:series|universe|author_collection))?$/.test(value)) return { kind: 'collections', href: value };
  if (/^\/collection\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 132) return { kind: 'collection', href: value };
  if (/^\/toplijsten\/[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 132) return { kind: 'editorial', href: value };
  return null;
}

/** Keep navigation state out of crawlable book hrefs, including malformed state. */
export function cleanBookLink(href: string): { href: string; returnPath: string | null } {
  if (!href.startsWith('/') || href.startsWith('//') || /[\\\u0000-\u0020\u007f]/u.test(href)) return { href, returnPath: null };
  const url = new URL(href, ORIGIN);
  if (!BOOK_PATH.test(url.pathname)) return { href, returnPath: null };
  const contexts = url.searchParams.getAll('returnTo');
  const context = contexts.length === 1 ? safeLocalBookReturn(contexts[0]) : null;
  url.searchParams.delete('returnTo');
  return { href: url.pathname + url.search + url.hash, returnPath: context?.href ?? null };
}

export function bookReturnMemoryKey(bookPath: string): string {
  return `lumiscore-book-return:v1:${bookPath}`;
}

export function serializeBookReturnMemory(bookHref: string, returnPath: string | null, sourceUrl: string, now = Date.now()): string | null {
  if (!returnPath || !safeLocalBookReturn(returnPath)) return null;
  const source = new URL(sourceUrl);
  const book = new URL(bookHref, source);
  if (book.origin !== source.origin || !BOOK_PATH.test(book.pathname)) return null;
  return JSON.stringify({ version: 1, book: book.pathname, path: returnPath, source: source.pathname + source.search, at: now });
}

/** Referrers recover normal/new-tab clicks when optional storage is unavailable. */
export function resolveLocalBookReturn({ currentUrl, referrer, stored, navigationType, now = Date.now() }: {
  currentUrl: string;
  referrer: string;
  stored: string | null;
  navigationType?: string;
  now?: number;
}): LocalBookReturn | null {
  const current = new URL(currentUrl);
  if (!BOOK_PATH.test(current.pathname) || current.searchParams.has('returnTo')) return null;
  let previous: URL | null = null;
  try { if (referrer) previous = new URL(referrer); } catch { return null; }
  if (previous && previous.origin !== current.origin) return null;
  const previousPath = previous ? previous.pathname + previous.search : '';
  const referrerReturn = previous ? safeLocalBookReturn(splitLocalePath(previousPath).path) : null;
  try {
    const memory = stored ? JSON.parse(stored) : null;
    const matchesSource = previous && memory?.source === previousPath;
    const returningToDocument = navigationType === 'reload' || navigationType === 'back_forward';
    const returningFromAccount = previous && /^\/(?:en\/|nl\/)?(?:login|register|reading-preferences|auth\/callback)(?:\?|$)/.test(previousPath);
    if (memory?.version === 1 && memory.book === current.pathname && Number.isFinite(memory.at) && memory.at <= now && now - memory.at < MAX_AGE &&
        (matchesSource || returningToDocument || returningFromAccount)) {
      const navigation = safeLocalBookReturn(memory.path);
      if (navigation) return navigation;
    }
  } catch { /* Corrupt or unavailable optional state must not prevent navigation. */ }
  return referrerReturn;
}
