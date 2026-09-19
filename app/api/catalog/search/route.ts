import { NextResponse } from 'next/server';
import {
  CATALOG_SEARCH_LIMIT,
  isCatalogSearchQuery,
  normalizeCatalogSearchQuery,
} from '@/lib/books/catalog-search';
import { measureServerOperation } from '@/lib/performance/server-timing';

export async function GET(request: Request) {
  const query = normalizeCatalogSearchQuery(
    new URL(request.url).searchParams.get('q') ?? '',
  );

  if (!isCatalogSearchQuery(query)) {
    return NextResponse.json({ results: [] }, {
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60' },
    });
  }

  try {
    const { searchCatalog } = await import('@/lib/supabase/catalog-search');
    const results = await measureServerOperation(
      'catalog.search_api',
      'public',
      () => searchCatalog(query, CATALOG_SEARCH_LIMIT),
    );

    return NextResponse.json(
      { results },
      {
        headers: {
          'Cache-Control': 'public, max-age=30, s-maxage=60, stale-while-revalidate=300',
        },
      },
    );
  } catch (error) {
    console.error('Catalog search failed.', error);
    return NextResponse.json(
      { error: 'Search is temporarily unavailable.', results: [] },
      { status: 503 },
    );
  }
}
