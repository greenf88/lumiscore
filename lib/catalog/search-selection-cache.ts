import type { Book } from '../../app/data/books.ts';
import type { EditorialQuery } from './editorial-query.ts';
import type { Locale } from '../i18n/config.ts';
import type { CatalogSearchAliases } from '../books/catalog-search.ts';
import type { AuthorOption, PublicCategory } from './discovery.ts';
import type { SearchCacheRead } from './search-observation.ts';

export type PublicSearchSelection = {
  books: Book[];
  aliases: CatalogSearchAliases;
  categories: PublicCategory[];
  selectedAuthor: AuthorOption | null;
  projected?: boolean;
};
/** Page/size are deliberately absent: all pages share ONE eligible selection.
 * Locale, filters and database order must never cross cache boundaries. */
export function searchSelectionKey(state: EditorialQuery, locale: Locale) {
  return JSON.stringify([locale, state.query, [...state.categories].sort(), [...state.languages].sort(),
    state.author, state.selection, state.sort]);
}

/** Per-instance public identity cache, NOT a page/score/profile/CDN cache.
 * 15s TTL, <=8 entries, <=5000 selected Works total, <=8 coalesced in-flight keys.
 * Errors are never cached. Scores are loaded fresh for each visible page. */
export function createSearchSelectionCache(now = Date.now) {
  const ready = new Map<string, { value: PublicSearchSelection; expires: number }>();
  const pending = new Map<string, Promise<PublicSearchSelection>>();
  const weight = () => [...ready.values()].reduce((n, row) => n + row.value.books.length, 0);
  return async (key: string, read: () => Promise<PublicSearchSelection>, observe?: (state: SearchCacheRead) => void) => {
    for (const [id, row] of ready) if (row.expires <= now()) ready.delete(id);
    const hit = ready.get(key);
    if (hit) { observe?.('cache'); return hit.value; }
    if (pending.has(key)) { observe?.('coalesced'); return pending.get(key)!; }
    observe?.('fresh');
    const load = async () => {
      const value = await read();
      if (value.books.some(b => b.score !== null || b.match !== null || b.ratingsCount !== null)) {
        throw new Error('Search identity cache cannot contain scores or personal matches.');
      }
      if (value.books.length <= 5000) {
        while (ready.size && (ready.size >= 8 || weight() + value.books.length > 5000)) ready.delete(ready.keys().next().value!);
        ready.set(key, { value, expires: now() + 15000 });
      }
      return value;
    };
    if (pending.size >= 8) return load();
    const task = load().finally(() => pending.delete(key));
    pending.set(key, task);
    return task;
  };
}

/** At most400 Work identities per window (<1000-row API cap).
 * Caller loads complete editions in parallel200-ID batches. No per-Work loop. */
export async function readSearchIdentityBatches<T>(ids: readonly string[], read: (ids: string[]) => Promise<T[]>) {
  const rows: T[] = [];
  for (let start = 0; start < ids.length; start += 400) {
    rows.push(...await read(ids.slice(start, start + 400)));
  }
  return rows;
}
