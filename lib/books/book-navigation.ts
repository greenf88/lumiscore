import type { Book } from '@/app/data/books';
import { isCatalogWorkId } from './book-detail.ts';
import { appendSearchReturnContext } from '../navigation/search-return.ts';

export function getBookHref(
  book: Book,
  searchReturnTo?: string | null,
): string | null {
  if (book.source !== 'supabase' || !book.workId) return null;

  const workId = String(book.workId).trim();
  if (!isCatalogWorkId(workId)) return null;

  return appendSearchReturnContext(
    `/book/${encodeURIComponent(workId)}`,
    searchReturnTo,
  );
}
