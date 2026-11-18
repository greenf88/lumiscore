import { supabase } from './client';
import { loadEditionRows } from './edition-rows';
import { selectSitemapBookLocales, type SitemapWork } from '../seo/book-locales';
import { selectCollectionLocales } from '../seo/collection-locales';

/** Public bibliographic reads only; fail on unavailable data, never retire a
 * collection or label it empty because a dependency failed. */
export async function loadCollectionIndexableLocales(slug: string, workIds: readonly string[]) {
  const ids = [...new Set(workIds)];
  const signal = AbortSignal.timeout(10_000);
  const works: SitemapWork[] = [];
  const editionsPromise = loadEditionRows(supabase, ids, signal);
  const worksPromise = (async () => {
    for (let start = 0; start < ids.length; start += 200) {
      const { data, error } = await supabase.from('works').select('id,title')
        .in('id', ids.slice(start, start + 200)).abortSignal(signal);
      if (error) throw error;
      if (!data) throw new Error('Collection book identities unavailable.');
      works.push(...data);
    }
    return works;
  })();
  const [allWorks, editions] = await Promise.all([worksPromise, editionsPromise]);
  return selectCollectionLocales([{ id: slug, slug }], ids.map(work_id => ({ collection_id: slug, work_id })),
    selectSitemapBookLocales(allWorks, editions)).get(slug) ?? [];
}
