import type { Book } from '../../app/data/books.ts';
import type { Locale } from '../i18n/config.ts';
import { editorialRpcArgs, type EditorialQuery } from './editorial-query.ts';

export function eligibleBrowseArgs(state: EditorialQuery, locale: Locale) {
  return { ...editorialRpcArgs(state), p_locale: locale,
    p_page: Math.min(state.page, 2147483647), p_page_size: state.pageSize,
    p_author_id: state.author ? Number(state.author) : null };
}

/** Fail closed if a backend or concurrent catalog change violates the bounded
 * selection. Never turn 16 selected Works into a successful 15-card page. */
export function readEligibleBrowsePage(data: unknown, state: EditorialQuery, locale: Locale) {
  const d = data as Record<string, unknown> | null;
  const total = Number(d?.total), page = Number(d?.page), pageCount = Number(d?.pageCount);
  if (d?.contract !== 'eligible-browse-v3' || d.locale !== locale || d.pageSize !== state.pageSize
    || !Number.isSafeInteger(total) || total < 0 || pageCount !== Math.max(1, Math.ceil(total / state.pageSize))
    || page !== Math.min(state.page, pageCount) || !Array.isArray(d.workIds)
    || d.workIds.length !== Math.min(state.pageSize, Math.max(0, total - (page - 1) * state.pageSize))) {
    throw new Error('Invalid eligible catalog page');
  }
  const ids = d.workIds.map(String);
  if (new Set(ids).size !== ids.length || ids.some(id => !/^[1-9]\d*$/.test(id) || !Number.isSafeInteger(Number(id)))) {
    throw new Error('Invalid eligible catalog identities');
  }
  return { ids, total, page, pageCount };
}

export function alignEligibleBrowseBooks(ids: readonly string[], books: readonly Book[]) {
  const byId = new Map(books.map(book => [book.workId, book]));
  if (books.length !== ids.length || byId.size !== ids.length || ids.some(id => !byId.has(id))) {
    throw new Error('Catalog selection changed during hydration; retry');
  }
  return ids.map(id => byId.get(id)!);
}
