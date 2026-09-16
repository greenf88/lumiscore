import { LUMISCORE_PRODUCTION_ORIGIN } from '@/app/components/LumiScoreMetadata';
import { supabase } from '@/lib/supabase/client';
import { REVIEWED_COLLECTION_SEEDS } from '@/lib/collections/seed-data';

const PAGE_SIZE = 1_000;

function sitemapEntry(path: string, priority?: string): string {
  const location = new URL(path, LUMISCORE_PRODUCTION_ORIGIN).toString();
  return `<url><loc>${location}</loc>${priority ? `<priority>${priority}</priority>` : ''}</url>`;
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
    const workIds = await loadAllWorkIds();
    const entries = [
      sitemapEntry('/', '1.0'),
      sitemapEntry('/taste-test', '0.8'),
      ...REVIEWED_COLLECTION_SEEDS.map(({ slug }) =>
        sitemapEntry(`/collection/${slug}`, '0.6')),
      ...workIds.map((workId) => sitemapEntry(`/book/${workId}`, '0.7')),
    ].join('');

    return new Response(
      `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`,
      {
        headers: {
          'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
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
