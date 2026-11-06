import { serveSitemapShard } from '@/lib/seo/sitemap-server';

export function GET() {
  return serveSitemapShard('nl');
}
