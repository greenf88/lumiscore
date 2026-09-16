import { LUMISCORE_SITE_ORIGIN } from '@/lib/seo/site-origin';
import { supabase } from '@/lib/supabase/client';
import { buildPublicSitemapPaths } from '@/lib/seo/sitemap';

const PAGE_SIZE = 1_000;

function sitemapEntry(path: string, priority?: string): string {
  const location = new URL(path, LUMISCORE_SITE_ORIGIN).toString();
  return `<url><loc>${location}</loc>${priority ? `<priority>${priority}</priority>` : ''}</url>`;
}

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
    const entries = buildPublicSitemapPaths(workIds, collectionSlugs)
      .map((path) => sitemapEntry(
        path,
        path === '/' ? '1.0' : path === '/taste-test' ? '0.8' : path.startsWith('/book/') ? '0.7' : '0.6',
      ))
      .join('');

    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`,
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
