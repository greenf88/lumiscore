import type { Book } from '@/app/data/books';
import { isCatalogWorkId } from './book-detail.ts';

export function getBookHref(book: Book): string | null {
  if (book.source !== 'supabase' || !book.workId) return null;

  const workId = String(book.workId).trim();
  return isCatalogWorkId(workId)
    ? `/book/${encodeURIComponent(workId)}`
    : null;
}
