import type { Metadata } from 'next';
import { LumiScoreSearchPage } from '@/app/components/LumiScoreSearchPage';
import type { Book } from '@/app/data/books';
import {
  CATALOG_SEARCH_PAGE_LIMIT,
  isCatalogSearchQuery,
  normalizeCatalogSearchQuery,
} from '@/lib/books/catalog-search';

type SearchPageProps = {
  searchParams: Promise<{ q?: string | string[] }>;
};

export const dynamic = 'force-dynamic';

async function readQuery(searchParams: SearchPageProps['searchParams']) {
  const { q } = await searchParams;
  return normalizeCatalogSearchQuery(Array.isArray(q) ? q[0] ?? '' : q ?? '');
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const query = await readQuery(searchParams);
  return {
    title: query ? `Search: ${query} — LumiScore` : 'Search books — LumiScore',
    description: query
      ? `Search LumiScore for books and authors matching ${query}.`
      : 'Search the full LumiScore book catalog by title or author.',
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const query = await readQuery(searchParams);
  let results: Book[] = [];
  let searchFailed = false;

  if (isCatalogSearchQuery(query)) {
    try {
      const { searchCatalog } = await import('@/lib/supabase/catalog-search');
      results = await searchCatalog(query, CATALOG_SEARCH_PAGE_LIMIT);
    } catch (error) {
      console.error('Search page catalog query failed.', error);
      searchFailed = true;
    }
  }

  return (
    <LumiScoreSearchPage
      initialQuery={query}
      results={results}
      searchFailed={searchFailed}
    />
  );
}
