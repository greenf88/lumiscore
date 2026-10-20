import type { Book } from '../../app/data/books.ts';
import type { PublicSearchSelection } from './search-selection-cache.ts';
import { collectCatalogSearchAliases } from '../books/catalog-search.ts';

/** Only compact public ordering keys, never hydrated off-page Works/editions.
 * Keep JS relevance and en/base collation: SQL collation can differ at ties. */
export function readSearchProjection(data: unknown, query: string): Pick<PublicSearchSelection, 'books' | 'aliases' | 'projected'> {
  const body = data as { contract?: string; candidates?: unknown[] } | null;
  if (body?.contract !== 'strict-spine-v1' || !Array.isArray(body.candidates) || body.candidates.length > 10000) {
    throw new Error('Invalid public search projection');
  }
  const books: Book[] = [], titles: { workId: string; title: string }[] = [], seen = new Set<string>();
  for (const candidate of body.candidates) {
    const row = candidate as Record<string, unknown>;
    const workId = String(row.workId ?? ''), editionId = String(row.editionId ?? '');
    if (!/^[1-9]\d*$/.test(workId) || !Number.isSafeInteger(Number(workId)) || !/^[1-9]\d*$/.test(editionId)
      || seen.has(workId) || typeof row.title !== 'string' || !row.title.trim() || typeof row.author !== 'string'
      || !Array.isArray(row.aliases) || row.aliases.some(s => typeof s !== 'string')) throw new Error('Invalid public search candidate');
    seen.add(workId);
    books.push({ id: 'work-' + workId, workId, editionId, title: row.title, author: row.author,
      source: 'supabase', score: null, match: null, ratingsCount: null, cover: 'orbit' });
    for (const title of row.aliases as string[]) titles.push({ workId, title });
  }
  return { books, aliases: collectCatalogSearchAliases(query, titles).aliasesByWorkId, projected: true };
}

export function validateProjectedPage(expected: readonly Book[], actual: readonly Book[]) {
  const byId = new Map(actual.map(book => [book.workId, book]));
  if (actual.length !== expected.length || byId.size !== expected.length) throw new Error('Search page identity changed; retry');
  return expected.map(key => {
    const book = byId.get(key.workId);
    if (!book || book.editionId !== key.editionId || book.title !== key.title || book.author !== key.author) {
      throw new Error('Search page edition changed; retry');
    }
    return book;
  });
}
