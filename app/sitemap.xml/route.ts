import { supabase } from '@/lib/supabase/client';
import { buildLocalizedSitemap } from '@/lib/seo/sitemap';

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
    const page = (data ?? []).flatMap((row) =>
      typeof row.slug === 'string' && row.slug.trim() ? [row.slug.trim()] : [],
    );
    slugs.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return slugs;
}

async function loadAllWorkIds(): Promise<string[]> {
  const workIds: string[] = [];

  for (let start = 0; ; start += PAGE_SIZE) {
    const { data, error } = await supabase
      .from('works')
      .select('id')
      .order('id', { ascending: true })
      .range(start, start + PAGE_SIZE - 1);

    if (error) throw error;
    const page = (data ?? []).flatMap((row) =>
      typeof row.id === 'number' || typeof row.id === 'string'
        ? [String(row.id)]
        : [],
    );
    workIds.push(...page);
    if (page.length < PAGE_SIZE) break;
  }

  return workIds;
}

export async function GET() {
  try {
    const [workIds, collectionSlugs] = await Promise.all([
      loadAllWorkIds(),
      loadAllCollectionSlugs(),
    ]);
    return new Response(
      buildLocalizedSitemap(workIds, collectionSlugs),
      {
        headers: {
          'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=21600',
          'Content-Type': 'application/xml; charset=utf-8',
        },
      },
    );
  } catch (error) {
    console.error('Sitemap catalog load failed.', error);
    return new Response('Sitemap temporarily unavailable.', {
      status: 503,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
