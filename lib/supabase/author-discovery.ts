import { createAuthorBookLinksLoader } from '../books/author-discovery';
import { loadEditionRows } from './edition-rows';
import { mapCatalogWorks } from './books';
import { supabase } from './client';

export const loadAuthorBookLinks = createAuthorBookLinksLoader({
  async readPage(args, signal) {
    const { data, error } = await supabase.rpc('catalog_browse_page_v3', args).abortSignal(signal);
    if (error) throw error;
    return data;
  },
  async readBooks(ids, locale, signal) {
    const [works, editions] = await Promise.all([
      supabase.from('works').select('id,title,author_id,open_library_id,authors(id,name)').in('id', ids).abortSignal(signal),
      loadEditionRows(supabase, ids, signal),
    ]);
    if (works.error) throw works.error;
    if (!Array.isArray(works.data)) throw new Error('Author books unavailable');
    return mapCatalogWorks(works.data.map(work => ({ ...work, editions: editions.filter(edition => String(edition.work_id) === String(work.id)) })), locale);
  },
});
