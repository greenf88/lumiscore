import { NextResponse } from 'next/server';
import {
  CATALOG_SEARCH_LIMIT,
  isCatalogSearchQuery,
  normalizeCatalogSearchQuery,
} from '@/lib/books/catalog-search';

export async function GET(request: Request) {
  const query = normalizeCatalogSearchQuery(
    new URL(request.url).searchParams.get('q') ?? '',
  );

  if (!isCatalogSearchQuery(query)) {
    return NextResponse.json({ results: [] });
  }

  try {
    const { searchCatalog } = await import('@/lib/supabase/catalog-search');
    const results = await searchCatalog(query, CATALOG_SEARCH_LIMIT);

    return NextResponse.json(
      { results },
      {
        headers: {
          'Cache-Control': 'no-store',
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
