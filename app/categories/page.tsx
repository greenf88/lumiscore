
import { LocaleLink } from '@/app/components/LumiScoreLocale';
import { DiscoveryPageShell } from '@/app/components/DiscoveryPageShell';
import { createLocalizedPageMetadata } from '@/lib/seo/localized-metadata';
import { resolveRequestLocale } from '@/lib/i18n/server';
export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  return createLocalizedPageMetadata({
    title: 'Book categories — LumiScore',
    description: 'Browse books by category, from fiction and fantasy to non-fiction. Compare the available books and find a starting point for your next read.',
    canonicalPath: '/categories',
  });
}
export default async function CategoriesPage() {
  const { locale } = await resolveRequestLocale();
  const [authState, data] = await Promise.all([
    import('@/lib/supabase/auth').then(m => m.loadHeaderAuthState()).catch(() => ({ authenticated: false })),
    import('@/lib/supabase/editorial-catalog').then(async m => {
      const { editorialQuery } = await import('@/lib/catalog/editorial-query');
      return m.loadEditorialCatalog(editorialQuery({}), locale, false);
    }).catch(() => null),
  ]);
  const nl = locale === 'nl';
  return <DiscoveryPageShell authState={authState} path="/categories"><section className="featured-section">
    <h1>{nl ? 'Categorieën' : 'Categories'}</h1>
    <p>{nl ? 'Kies een categorie als je al weet welk soort boek je zoekt. In het boekenoverzicht kun je daarna verder filteren. Wil je liever op een verhaalelement kiezen? Bekijk dan onze redactionele leesroutes.' : 'Choose a category if you know what kind of book you want to read, then refine your choice in the catalog. If you prefer to start with a story element, explore our editorial reading routes.'}</p>
    <p><LocaleLink href="/toplijsten">{nl ? 'Ontdek de leesroutes' : 'Explore reading routes'}</LocaleLink></p>
    {data?.available && data.discoveryAvailable ? <><p>{data.categories.length} {nl ? 'publieke categorieën. De aantallen horen bij boeken met een beschikbare Nederlandse editie. Boeken zonder classificatie blijven vindbaar in het algemene overzicht.' : 'public categories. Counts refer to books with an available English edition. Unclassified books remain available in the general catalog.'}</p>
      <div className="category-overview">{data.categories.map(c => <LocaleLink key={c.id} href={`/browse?category=${encodeURIComponent(c.id)}`}>
        <strong>{nl ? c.nl : c.en}</strong><span>{data.facets[c.id] ?? 0} {nl ? 'boeken' : 'books'}{!data.facets[c.id] ? nl ? ' · nog geen beschikbare boeken' : ' · no available books yet' : ''}</span></LocaleLink>)}</div></>
      : <p role="status">{nl ? 'De publieke categoriebron is tijdelijk niet beschikbaar.' : 'The public category source is temporarily unavailable.'}</p>}
    <LocaleLink href="/browse">{nl ? 'Alle boeken, inclusief ongeclassificeerd' : 'All books, including unclassified'}</LocaleLink>
  </section></DiscoveryPageShell>;
}
