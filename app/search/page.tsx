import type { Metadata } from 'next';
import { LumiScoreSearchPage } from '@/app/components/LumiScoreSearchPage';
import { LumiScoreMetadata } from '@/app/components/LumiScoreMetadata';
import type { Book } from '@/app/data/books';
import {
  CATALOG_SEARCH_PAGE_LIMIT,
  isCatalogSearchQuery,
  normalizeCatalogSearchQuery,
} from '@/lib/books/catalog-search';
import {
  serializeSearchReturnPath,
  type SearchParamValues,
} from '@/lib/navigation/search-return';

type SearchPageProps = {
  searchParams: Promise<SearchParamValues>;
};

export const dynamic = 'force-dynamic';

function readQuery(searchParams: SearchParamValues) {
  const { q } = searchParams;
  return normalizeCatalogSearchQuery(Array.isArray(q) ? q[0] ?? '' : q ?? '');
}

export async function generateMetadata({
  searchParams,
}: SearchPageProps): Promise<Metadata> {
  const query = readQuery(await searchParams);
  return {
    title: query ? `Search: ${query} — LumiScore` : 'Search books — LumiScore',
    description: query
      ? `Search LumiScore for books and authors matching ${query}.`
      : 'Search the full LumiScore book catalog by title or author.',
    robots: { index: false, follow: true },
  };
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolvedSearchParams = await searchParams;
  const query = readQuery(resolvedSearchParams);
  const searchReturnTo = serializeSearchReturnPath(resolvedSearchParams);
  const authStatePromise = import('@/lib/supabase/auth')
    .then(({ loadHeaderAuthState }) => loadHeaderAuthState())
    .catch(() => ({ authenticated: false }));
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

  const authState = await authStatePromise;
  const title = query ? `Search: ${query} — LumiScore` : 'Search books — LumiScore';
  const description = query
    ? `Search LumiScore for books and authors matching ${query}.`
    : 'Search the full LumiScore book catalog by title or author.';

  return (
    <>
      <LumiScoreMetadata title={title} description={description} noIndex />
      <LumiScoreSearchPage
        initialQuery={query}
        results={results}
        searchFailed={searchFailed}
        authState={authState}
        searchReturnTo={searchReturnTo}
      />
    </>
  );
}
