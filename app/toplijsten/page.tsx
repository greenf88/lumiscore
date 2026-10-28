
import { LocaleLink } from '@/app/components/LumiScoreLocale';
import { DiscoveryPageShell } from '@/app/components/DiscoveryPageShell';
import { editorialTopLists } from '@/lib/catalog/top-lists';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { createLocalizedPageMetadata } from '@/lib/seo/localized-metadata';
export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  const { locale } = await resolveRequestLocale();
  return createLocalizedPageMetadata({ title: locale === 'nl' ? 'Redactionele toplijsten — LumiScore' : 'Editorial reading lists — LumiScore',
    description: locale === 'nl' ? 'Kies een leesrichting: van fantasy en sciencefiction tot historische romans, thrillers en feelgood. Redactionele selecties met een reden bij ieder boek.' : 'Choose a reading direction, from fantasy and science fiction to historical novels, thrillers and feel-good reads. Editorial selections with a reason for every book.', canonicalPath: '/toplijsten' });
}
export default async function TopListsPage() {
  const [{ locale }, authState] = await Promise.all([resolveRequestLocale(), import('@/lib/supabase/auth').then(m=>m.loadHeaderAuthState()).catch(()=>({authenticated:false}))]);
  return <DiscoveryPageShell path="/toplijsten" authState={authState}><section className="featured-section editorial-lists">
    <p className="eyebrow">{locale === 'nl' ? 'Redactionele leesroutes' : 'Editorial reading routes'}</p>
    <h1>{locale === 'nl' ? 'Waar wil je in verdwijnen?' : 'Where will you read next?'}</h1>
    <p>{locale === 'nl' ? 'Kies een onderwerp dat je nieuwsgierig maakt. Dit zijn redactionele selecties, geen ranglijsten op lezersscore.' : 'Choose a theme that sparks your curiosity. These are editorial selections, not rankings by reader score.'}</p>
    <div className="reading-list-grid">{editorialTopLists.map(list=><article className="reading-list-card" key={list.slug}><h2 id={'list-'+list.slug}>{list.title[locale]}</h2><p>{list.description[locale]}</p><LocaleLink className="ui-control ui-action ui-primary" aria-labelledby={'explore-'+list.slug+' list-'+list.slug} href={'/toplijsten/'+list.slug}><span id={'explore-'+list.slug}>{locale === 'nl' ? 'Bekijk de lijst' : 'Explore the list'}</span><span aria-hidden="true">→</span></LocaleLink></article>)}</div>
    <div className="reading-list-actions"><LocaleLink className="ui-control ui-action ui-primary" href="/taste-test">{locale === 'nl' ? 'Ontdek je leessmaak →' : 'Discover your reading taste →'}</LocaleLink><LocaleLink className="ui-control ui-action ui-secondary" href="/browse">{locale === 'nl' ? 'Ontdek alle boeken' : 'Browse all books'}</LocaleLink></div>
  </section></DiscoveryPageShell>;
}
