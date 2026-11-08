import type { Metadata } from 'next';
import { LumiScoreBrowsePage } from '@/app/components/LumiScoreBrowsePage';
import { browsePagePath, publicBrowsePage } from '@/lib/seo/browse-pagination';
import { redirect } from 'next/navigation';
import { localizedHref } from '@/lib/i18n/paths';
import { createLocalizedPageMetadata } from '@/lib/seo/localized-metadata';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { browseQuery, editorialHref, type CatalogParams } from '@/lib/catalog/editorial-query';
import { unavailableEditorialPage } from '@/lib/supabase/editorial-catalog';
type BrowsePageProps = { searchParams: Promise<CatalogParams> };
export const dynamic = 'force-dynamic';
export async function generateMetadata({ searchParams }: BrowsePageProps): Promise<Metadata> {
  const page = publicBrowsePage(await searchParams);
  return createLocalizedPageMetadata({
    title: 'Browse books — LumiScore',
    description: 'Discover books with reader ratings on LumiScore. Filter the catalog by category, publication year and language to choose your next read.',
    canonicalPath: page === null ? '/browse' : browsePagePath(page), noIndex: page === null,
    // Locale catalogs differ in count/order: page N is not a verified translated
    // equivalent of page N in another language (and may not even exist there).
    includeLanguageAlternates: page === 1,
  });
}
export default async function BrowsePage({ searchParams }: BrowsePageProps) {
  const [params, { locale }, authState] = await Promise.all([
    searchParams, resolveRequestLocale(),
    import('@/lib/supabase/auth').then(({ loadHeaderAuthState }) => loadHeaderAuthState())
      .catch(() => ({ authenticated: false })),
  ]);
  const state = browseQuery(params);
  let data = unavailableEditorialPage(state);
  try {
    const { loadEditorialCatalog } = await import('@/lib/supabase/editorial-catalog');
    data = await loadEditorialCatalog(state, locale, true, true);
  } catch { /* Sanitized bounded-read diagnostics are emitted by the shared loader.
    The HTTP response boundary recognizes the unavailable marker and returns503. */ }
  // The bounded RPC clamps excessive page numbers. Redirect normal pagination
  // to that real page instead of indexing duplicate final-page content.
  if (data.available && publicBrowsePage(params) !== null && data.page !== state.page) {
    redirect(localizedHref(browsePagePath(data.page), locale));
  }
  const current = { ...state, page: data.page };
  return <LumiScoreBrowsePage data={data} authState={authState}
    returnTo={editorialHref('/browse', current)} filters={current} />;
}
