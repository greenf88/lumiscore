import { buildSitemapIndex } from '@/lib/seo/sitemap';
import { sitemapResponse } from '@/lib/seo/sitemap-response';

export function GET() {
  return sitemapResponse(buildSitemapIndex());
}
