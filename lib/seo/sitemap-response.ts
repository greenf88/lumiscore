export function sitemapResponse(xml: string): Response {
  return new Response(xml, { headers: {
    'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=21600',
    'Content-Type': 'application/xml; charset=utf-8',
  } });
}
