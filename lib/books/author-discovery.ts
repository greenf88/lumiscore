import type { Book } from '../../app/data/books.ts';
import type { Locale } from '../i18n/config.ts';
import { editorialQuery } from '../catalog/editorial-query.ts';
import { eligibleBrowseArgs, readEligibleBrowsePage } from '../catalog/eligible-browse.ts';
import { isBookPresentationAllowed } from './strict-edition.ts';

export type AuthorDiscoveryBook = Pick<Book, 'workId' | 'authorId' | 'title' | 'author' | 'openLibraryWorkId' | 'editionAvailable' | 'editionLanguage' | 'strictEditionLanguage'>;
export type AuthorBookLink = { workId: string; title: string; author: string };
const validId = (id: string | null | undefined): id is string => !!id && /^[1-9]\d*$/.test(id) && Number.isSafeInteger(Number(id));

export function sameAuthorBookLinks(book: AuthorDiscoveryBook, candidates: readonly AuthorDiscoveryBook[], locale: Locale): AuthorBookLink[] {
  if (!validId(book.workId) || !validId(book.authorId) || !isBookPresentationAllowed(book, locale)) return [];
  const seen = new Set([book.workId]), sources = new Set([book.openLibraryWorkId].filter(Boolean));
  const links: AuthorBookLink[] = [];
  for (const candidate of candidates) {
    if (!validId(candidate.workId) || candidate.authorId !== book.authorId || seen.has(candidate.workId)
      || !isBookPresentationAllowed(candidate, locale) || !candidate.title.trim() || !candidate.author.trim()
      || (candidate.openLibraryWorkId && sources.has(candidate.openLibraryWorkId))) continue;
    seen.add(candidate.workId);
    if (candidate.openLibraryWorkId) sources.add(candidate.openLibraryWorkId);
    links.push({ workId: candidate.workId, title: candidate.title, author: candidate.author });
    if (links.length === 3) break;
  }
  return links;
}

type Dependencies = {
  readPage: (args: ReturnType<typeof eligibleBrowseArgs>, signal: AbortSignal) => Promise<unknown>;
  readBooks: (ids: readonly string[], locale: Locale, signal: AbortSignal) => Promise<AuthorDiscoveryBook[]>;
};

/** Public identities only: <=100 author/locale/Work windows, 15-second freshness,
 * no stale fallback after errors. One page of <=64 IDs; at most four Works hydrated.
 * The optional panel never reads scores, covers, providers or reader state. */
export function createAuthorBookLinksLoader(deps: Dependencies, now = Date.now, timeoutMs = 1800) {
  const cache = new Map<string, { books?: AuthorDiscoveryBook[]; expires: number; pending?: Promise<AuthorDiscoveryBook[]> }>();
  return async (book: AuthorDiscoveryBook, locale: Locale): Promise<AuthorBookLink[]> => {
    if (!validId(book.workId) || !validId(book.authorId) || !isBookPresentationAllowed(book, locale)) return [];
    const key = locale + ':' + book.authorId + ':' + book.workId;
    let entry = cache.get(key);
    if (entry?.books && entry.expires > now()) return sameAuthorBookLinks(book, entry.books, locale);
    if (!entry?.pending) {
      entry = { expires: 0 };
      const current = entry;
      const signal = AbortSignal.timeout(timeoutMs);
      const state = editorialQuery({ author: book.authorId }, { pageSize: 64, sort: 'az' });
      const load = async () => {
        signal.throwIfAborted();
        const { ids } = readEligibleBrowsePage(await deps.readPage(eligibleBrowseArgs(state, locale), signal), state, locale);
        signal.throwIfAborted();
        const currentIndex = ids.indexOf(book.workId!);
        // A circular window gives every Work in this bounded page an incoming
        // link from its neighbours, rather than promoting only the first titles.
        const selected = currentIndex < 0 ? ids.slice(0, 4)
          : Array.from({ length: Math.min(4, ids.length) }, (_, i) => ids[(currentIndex + i) % ids.length]);
        const books = selected.length ? await deps.readBooks(selected, locale, signal) : [];
        // Preserve the eligible database order and reject unrequested identities.
        return selected.flatMap(id => books.filter(candidate => candidate.workId === id));
      };
      let abort: () => void = () => {};
      const timeout = new Promise<never>((_, reject) => { abort = () => reject(signal.reason); signal.addEventListener('abort', abort, { once: true }); });
      current.pending = Promise.race([Promise.resolve().then(load), timeout]).then(books => {
        current.books = books; current.expires = now() + 15_000;
        return books;
      }).catch((error: unknown) => {
        if (cache.get(key) === current) cache.delete(key);
        throw error;
      }).finally(() => { current.pending = undefined; signal.removeEventListener('abort', abort); });
      cache.set(key, current);
      while (cache.size > 100) cache.delete(cache.keys().next().value!);
    }
    try { return sameAuthorBookLinks(book, await entry.pending!, locale); }
    catch { return []; } // Related links are optional; core book errors keep their own policy.
  };
}
