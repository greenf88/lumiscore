import type { EditorialQuery } from './editorial-query.ts';

/** The existing RPC orders globally before LIMIT/OFFSET, and returns IDs only.
 * Its minimum is 32. Split that bounded ID window BEFORE hydrating books/covers.
 * Never sort or download the catalog in the browser; no schema change required.
 */
export function editorialWindow(state: EditorialQuery, data: { total: number; page: number; workIds: number[] }) {
  const total = Number(data.total);
  if (!Number.isSafeInteger(total) || total < 0 || !Array.isArray(data.workIds)) throw new Error('Invalid catalog page.');
  const pageCount = Math.max(1, Math.ceil(total / state.pageSize));
  const page = Math.min(state.page, pageCount);
  if (state.pageSize !== 16) return { ids: data.workIds.map(String), total, page: Number(data.page), pageCount };
  const expectedRpcPage = Math.ceil(page / 2);
  if (Number(data.page) !== expectedRpcPage || data.workIds.length > 32) throw new Error('Inconsistent catalog window.');
  const offset = (page - 1) % 2 * 16;
  return { ids: data.workIds.slice(offset, offset + 16).map(String), total, page, pageCount };
}
