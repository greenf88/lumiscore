import { supabase } from '@/lib/supabase/client';
import { buildLocalizedSitemap, type SITEMAP_SHARDS } from '@/lib/seo/sitemap';
import { selectSitemapBookLocales, type SitemapWork } from '@/lib/seo/book-locales';
import { EDITION_PRESENTATION_SELECT } from '@/lib/supabase/edition-rows';
import type { StrictEditionRow } from '@/lib/books/strict-edition';

const PAGE_SIZE = 1_000;


async function loadAllCollectionSlugs(): Promise<string[]> {
  const slugs: string[] = [];

  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('collections')
      .select('slug')
      .order('slug', { ascending: true })
      .range(start, start + PAGE_SIZE - 1);

    if (error) throw error;
    if (!data) throw new Error('Sitemap collections unavailable.');
    const page = data.flatMap((row) =>
      typeof row.slug === 'string' && row.slug.trim() ? [row.slug.trim()] : [],
    );
    slugs.push(...page);
    if (data.length < PAGE_SIZE) break;
  }

  return slugs;
}

async function loadById<T>(table: 'works' | 'editions', fields: string): Promise<T[]> {
  const rows: T[] = [];
  let after: string | number = 0;
  for (;;) {
    const { data, error }: { data: unknown[] | null; error: unknown } = await supabase.from(table).select(fields)
      .gt('id', after).order('id').limit(PAGE_SIZE);
    if (error) throw error;
    if (!data) throw new Error(`Sitemap ${table} unavailable.`);
    rows.push(...data as unknown as T[]);
    if (data.length < PAGE_SIZE) return rows;
    const last: unknown = (data.at(-1) as { id?: unknown } | undefined)?.id;
    if ((typeof last !== 'number' && typeof last !== 'string') || String(last) === String(after)) {
      throw new Error(`Sitemap ${table} pagination did not advance.`);
    }
    after = last;
  }
}

import { sitemapResponse } from './sitemap-response';

export async function serveSitemapShard(shard: keyof typeof SITEMAP_SHARDS): Promise<Response> {
  try {
    if (shard === 'pages') return sitemapResponse(buildLocalizedSitemap([], await loadAllCollectionSlugs(), shard));
    const [works, editions] = await Promise.all([
      loadById<SitemapWork>('works', 'id,title'),
      loadById<StrictEditionRow>('editions', EDITION_PRESENTATION_SELECT),
    ]);
    return sitemapResponse(buildLocalizedSitemap(selectSitemapBookLocales(works, editions), [], shard));
  } catch (error) {
    console.error('Sitemap catalog load failed.', error);
    return new Response('Sitemap temporarily unavailable.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}
