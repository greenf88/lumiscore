import type { Metadata } from 'next';
import { cache } from 'react';
import { LumiScoreBrowsePage } from '@/app/components/LumiScoreBrowsePage';
import { LumiScoreMetadata } from '@/app/components/LumiScoreMetadata';
import {
  CATALOG_BROWSE_PAGE_SIZE,
  normalizeCatalogBrowsePage,
  normalizeCatalogBrowsePageSize,
  normalizeCatalogBrowseSort,
} from '@/lib/books/catalog-browse';
import { resolveRequestLocale } from '@/lib/i18n/server';
import {
  browsePathFromSearchParams,
  updateBrowseReturnPath,
} from '@/lib/navigation/browse-return';
import type { CatalogBrowsePage } from '@/lib/supabase/books';

type BrowsePageProps = {
  searchParams: Promise<{
    page?: string | string[];
    pageSize?: string | string[];
    sort?: string | string[];
    [key: string]: string | string[] | undefined;
  }>;
};

export const dynamic = 'force-dynamic';

const load = cache(async (
  page: number,
  sort: ReturnType<typeof normalizeCatalogBrowseSort>,
  pageSize: ReturnType<typeof normalizeCatalogBrowsePageSize>,
  locale: 'en' | 'nl',
): Promise<(CatalogBrowsePage & { available: boolean })> => {
  try {
    const { loadCatalogBrowsePage } = await import('@/lib/supabase/books');
    return {
      ...(await loadCatalogBrowsePage(page, sort, pageSize, locale)),
      available: true,
    };
  } catch (error) {
    console.error('Browse catalog load failed.', error);
    return {
      books: [],
      total: 0,
      page: 1,
      pageSize: CATALOG_BROWSE_PAGE_SIZE,
      pageCount: 1,
      sort,
      available: false,
    };
  }
});

async function readBrowseState(searchParams: BrowsePageProps['searchParams']) {
  const params = await searchParams;
  return {
    page: normalizeCatalogBrowsePage(params.page),
    pageSize: normalizeCatalogBrowsePageSize(params.pageSize),
    sort: normalizeCatalogBrowseSort(params.sort),
    requestedPath: browsePathFromSearchParams(params),
  };
}

export async function generateMetadata({
  searchParams,
}: BrowsePageProps): Promise<Metadata> {
  const { requestedPath } = await readBrowseState(searchParams);
  return {
    title: 'Browse books — LumiScore',
    description: 'Explore the LumiScore catalog and find your next book.',
    alternates: { canonical: '/browse' },
    robots: requestedPath === '/browse'
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const [{ page, pageSize, sort, requestedPath }, { locale }, authState] = await Promise.all([
    readBrowseState(searchParams),
    resolveRequestLocale(),
    import('@/lib/supabase/auth')
      .then(({ loadHeaderAuthState }) => loadHeaderAuthState())
      .catch(() => ({ authenticated: false })),
  ]);
  const data = await load(page, sort, pageSize, locale);
  const returnTo = updateBrowseReturnPath(requestedPath, {
    page: data.page,
    pageSize: data.pageSize,
    sort: data.sort,
  });
  const noIndex = returnTo !== '/browse';

  return (
    <>
      <LumiScoreMetadata
        title="Browse books — LumiScore"
        description="Explore the LumiScore catalog and find your next book."
        canonicalPath="/browse"
        noIndex={noIndex}
      />
      <LumiScoreBrowsePage data={data} authState={authState} returnTo={returnTo} />
    </>
  );
}
