import type { Metadata } from 'next';
import { LumiScoreBrowsePage } from '@/app/components/LumiScoreBrowsePage';
import { browseHasQuery } from '@/lib/seo/page-metadata';
import { createLocalizedPageMetadata } from '@/lib/seo/localized-metadata';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { editorialQuery, editorialHref, type CatalogParams } from '@/lib/catalog/editorial-query';
import { unavailableEditorialPage } from '@/lib/supabase/editorial-catalog';
type BrowsePageProps = { searchParams: Promise<CatalogParams> };
export const dynamic = 'force-dynamic';
export async function generateMetadata({ searchParams }: BrowsePageProps): Promise<Metadata> {
  return createLocalizedPageMetadata({
    title: 'Browse books — LumiScore',
    description: 'Explore the LumiScore catalog and find your next book.',
    canonicalPath: '/browse', noIndex: browseHasQuery(await searchParams),
  });
}
export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const [params, { locale }, authState] = await Promise.all([
    searchParams, resolveRequestLocale(),
    import('@/lib/supabase/auth').then(({ loadHeaderAuthState }) => loadHeaderAuthState())
      .catch(() => ({ authenticated: false })),
  ]);
  const state = editorialQuery(params);
  let data = unavailableEditorialPage(state);
  try {
    const { loadEditorialCatalog } = await import('@/lib/supabase/editorial-catalog');
    data = await loadEditorialCatalog(state, locale);
  } catch (error) { console.error('Browse editorial catalog load failed.', error); }
  const current = { ...state, page: data.page };
  return <LumiScoreBrowsePage data={data} authState={authState}
    returnTo={editorialHref('/browse', current)} filters={current} />;
}
