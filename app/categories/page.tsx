
import { LocaleLink } from '@/app/components/LumiScoreLocale';
import { DiscoveryPageShell } from '@/app/components/DiscoveryPageShell';
import { createLocalizedPageMetadata } from '@/lib/seo/localized-metadata';
import { resolveRequestLocale } from '@/lib/i18n/server';
export const dynamic = 'force-dynamic';
export async function generateMetadata() { return createLocalizedPageMetadata({ title: 'Categories — LumiScore', canonicalPath: '/categories' }); }
export default async function CategoriesPage() {
  const [{ locale }, authState, data] = await Promise.all([
    resolveRequestLocale(), import('@/lib/supabase/auth').then(m => m.loadHeaderAuthState()).catch(() => ({ authenticated: false })),
    import('@/lib/supabase/editorial-catalog').then(async m => {
      const { editorialQuery } = await import('@/lib/catalog/editorial-query');
      return m.loadEditorialCatalog(editorialQuery({}), 'en', false);
    }).catch(() => null),
  ]);
  const nl = locale === 'nl';
  return <DiscoveryPageShell authState={authState} path="/categories"><section className="featured-section">
    <h1>{nl ? 'Categorieën' : 'Categories'}</h1>
    {data ? <><p>{data.categories.length} {nl ? 'publieke categorieën. Boeken zonder classificatie blijven vindbaar in het algemene overzicht.' : 'public categories. Unclassified books remain available in the general catalog.'}</p>
      <div className="category-overview">{data.categories.map(c => <LocaleLink key={c.id} href={`/browse?category=${encodeURIComponent(c.id)}`}>
        <strong>{nl ? c.nl : c.en}</strong><span>{data.facets[c.id] ?? 0} {nl ? 'boeken' : 'books'}{!data.facets[c.id] ? nl ? ' · nog geen gekoppelde boeken' : ' · no linked books yet' : ''}</span></LocaleLink>)}</div></>
      : <p role="status">{nl ? 'De publieke categoriebron is tijdelijk niet beschikbaar.' : 'The public category source is temporarily unavailable.'}</p>}
    <LocaleLink href="/browse">{nl ? 'Alle boeken, inclusief ongeclassificeerd' : 'All books, including unclassified'}</LocaleLink>
  </section></DiscoveryPageShell>;
}
