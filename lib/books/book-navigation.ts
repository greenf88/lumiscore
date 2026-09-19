import type { Book } from '@/app/data/books';
import { isCatalogWorkId } from './book-detail.ts';
import {
  appendBookReturnContext,
  type BookLinkReturnContext,
} from '../navigation/book-return.ts';

export function getBookHref(
  book: Book,
  returnContext?: BookLinkReturnContext | null,
): string | null {
  if (book.source !== 'supabase' || !book.workId) return null;

  const workId = String(book.workId).trim();
  if (!isCatalogWorkId(workId)) return null;

  return appendBookReturnContext(
    `/book/${encodeURIComponent(workId)}`,
    returnContext,
  );
}
