import { LUMISCORE_SITE_ORIGIN } from '@/lib/seo/site-origin';

export async function GET() {
  return new Response([
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    'Disallow: /auth/',
    'Disallow: /login',
    'Disallow: /search',
    '',
    `Sitemap: ${new URL('/sitemap.xml', LUMISCORE_SITE_ORIGIN)}`,
    '',
  ].join('\n'), {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=21600',
      'Content-Type': 'text/plain; charset=utf-8',
    },
  });
}
