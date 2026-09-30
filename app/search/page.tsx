import type { Metadata } from 'next';
import { LumiScoreSearchPage } from '@/app/components/LumiScoreSearchPage';
import { createPageMetadata } from '@/lib/seo/page-metadata';
import { editorialQuery, editorialHref } from '@/lib/catalog/editorial-query';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { unavailableEditorialPage } from '@/lib/supabase/editorial-catalog';
import {
  normalizeCatalogSearchQuery,
} from '@/lib/books/catalog-search';
import {
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
  return createPageMetadata({
    title: query ? `Search: ${query} — LumiScore` : 'Search books — LumiScore',
    description: query
      ? `Search LumiScore for books and authors matching ${query}.`
      : 'Search the full LumiScore book catalog by title or author.',
    canonicalPath: '/search',
    noIndex: true,
  });
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const resolvedSearchParams = await searchParams;
  const query = readQuery(resolvedSearchParams);
  const state = editorialQuery(resolvedSearchParams);
  const authStatePromise = import('@/lib/supabase/auth')
    .then(({ loadHeaderAuthState }) => loadHeaderAuthState())
    .catch(() => ({ authenticated: false }));
  const { locale } = await resolveRequestLocale();
  let data = unavailableEditorialPage(state);
  let searchFailed = false;

  try {
    const { loadEditorialCatalog } = await import('@/lib/supabase/editorial-catalog');
    data = await loadEditorialCatalog(state, locale);
  } catch (error) {
    console.error('Search page catalog query failed.', error);
    searchFailed = true;
  }

  const authState = await authStatePromise;
  const current = { ...state, page: data.page };

  return (
    <>
      <LumiScoreSearchPage
        initialQuery={query}
        results={data.books}
        total={data.total}
        facets={data.facets}
        filters={current}
        pageCount={data.pageCount}
        selectionCount={data.selectionCount}
        searchFailed={searchFailed}
        authState={authState}
        searchReturnTo={editorialHref('/search', current)}
      />
    </>
  );
}
