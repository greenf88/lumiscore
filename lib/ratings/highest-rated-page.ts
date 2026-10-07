// Server ranking spans the entire filtered catalog. Only this bounded page crosses the API.
export function highestRatedPageArgs(limit: number) {
  if (!Number.isFinite(limit)) throw new Error('Invalid highest-rated limit.');
  const size = Math.min(100, Math.max(1, Math.trunc(limit)));
  return { p_query: '', p_categories: [], p_selection: '', p_languages: [],
    p_sort: 'highest', p_page: 1, p_page_size: size <= 32 ? 32 : size <= 64 ? 64 : 128,
    p_alias_ids: [], p_author_id: null };
}

export function readHighestRatedPage(value: unknown, limit: number): { ids: string[]; total: number } {
  const args = highestRatedPageArgs(limit);
  if (!value || typeof value !== 'object') throw new Error('Highest-rated page unavailable.');
  const page = value as Record<string, unknown>;
  if (!Array.isArray(page.workIds) || page.workIds.length > args.p_page_size ||
      !Number.isSafeInteger(page.total) || Number(page.total) < page.workIds.length || page.page !== 1) {
    throw new Error('Invalid highest-rated page.');
  }
  const ids = page.workIds.map(id => {
    if (typeof id !== 'number' && !(typeof id === 'string' && /^\d+$/.test(id))) throw new Error('Invalid ranked Work identity.');
    if (!Number.isSafeInteger(Number(id)) || Number(id) <= 0) throw new Error('Invalid ranked Work identity.');
    return String(id);
  });
  if (new Set(ids).size !== ids.length) throw new Error('Duplicate ranked Work identity.');
  return { ids: ids.slice(0, Math.min(100, Math.max(1, Math.trunc(limit)))), total: Number(page.total) };
}
