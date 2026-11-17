import type { Book } from '../../app/data/books.ts';

/** JSON boundary: React's streamed resources must never leave an RSC response. */
export type PublicBook = Omit<Book, 'editionCoverUrls'> & { editionCoverUrls?: never };

export function hasDeferredCover(value: unknown): value is Promise<string[]> {
  return value !== null && typeof value === 'object' && 'then' in value && typeof value.then === 'function';
}

export async function publicBook(book: Book): Promise<PublicBook> {
  const { editionCoverUrls, ...data } = book;
  const resolved = hasDeferredCover(editionCoverUrls)
    ? await editionCoverUrls.catch(() => []) : [];
  return { ...data, coverUrls: [...new Set([...(data.coverUrls ?? []), ...resolved])]
    .filter(url => typeof url === 'string' && /^https?:\/\//.test(url)) };
}

/** Also tolerates an older cached response containing a serialized promise. */
export function parsePublicBooks(value: unknown): PublicBook[] {
  if (!Array.isArray(value)) throw new Error('Invalid book results');
  return value.flatMap(item => {
    if (!item || typeof item !== 'object' || typeof item.id !== 'string' ||
      typeof item.title !== 'string' || typeof item.author !== 'string' || typeof item.cover !== 'string') return [];
    const data = { ...item };
    delete data.editionCoverUrls;
    data.coverUrls = Array.isArray(data.coverUrls)
      ? data.coverUrls.filter((url: unknown) => typeof url === 'string' && /^https?:\/\//.test(url)) : [];
    return [data as PublicBook];
  });
}
