import type { Metadata } from 'next';
import { cache } from 'react';
import { LumiScoreBrowsePage } from '@/app/components/LumiScoreBrowsePage';
import { LumiScoreMetadata } from '@/app/components/LumiScoreMetadata';
import {
  normalizeCatalogBrowsePage,
  normalizeCatalogBrowseSort,
} from '@/lib/books/catalog-browse';
import { resolveRequestLocale } from '@/lib/i18n/server';
import type { CatalogBrowsePage } from '@/lib/supabase/books';

type BrowsePageProps = {
  searchParams: Promise<{
    page?: string | string[];
    sort?: string | string[];
  }>;
};

export const dynamic = 'force-dynamic';

const load = cache(async (
  page: number,
  sort: ReturnType<typeof normalizeCatalogBrowseSort>,
  locale: 'en' | 'nl',
): Promise<(CatalogBrowsePage & { available: boolean })> => {
  try {
    const { loadCatalogBrowsePage } = await import('@/lib/supabase/books');
    return {
      ...(await loadCatalogBrowsePage(page, sort, locale)),
      available: true,
    };
  } catch (error) {
    console.error('Browse catalog load failed.', error);
    return {
      books: [],
      total: 0,
      page: 1,
      pageSize: 30,
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
    sort: normalizeCatalogBrowseSort(params.sort),
  };
}

export async function generateMetadata({
  searchParams,
}: BrowsePageProps): Promise<Metadata> {
  const { page, sort } = await readBrowseState(searchParams);
  return {
    title: 'Browse books — LumiScore',
    description: 'Explore the LumiScore catalog and find your next book.',
    alternates: { canonical: '/browse' },
    robots: page === 1 && sort === 'az'
      ? { index: true, follow: true }
      : { index: false, follow: true },
  };
}

export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const [{ page, sort }, { locale }, authState] = await Promise.all([
    readBrowseState(searchParams),
    resolveRequestLocale(),
    import('@/lib/supabase/auth')
      .then(({ loadHeaderAuthState }) => loadHeaderAuthState())
      .catch(() => ({ authenticated: false })),
  ]);
  const data = await load(page, sort, locale);
  const noIndex = data.page !== 1 || data.sort !== 'az';

  return (
    <>
      <LumiScoreMetadata
        title="Browse books — LumiScore"
        description="Explore the LumiScore catalog and find your next book."
        canonicalPath="/browse"
        noIndex={noIndex}
      />
      <LumiScoreBrowsePage data={data} authState={authState} />
    </>
  );
}
