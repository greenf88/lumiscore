import { DiscoveryPageShell } from '@/app/components/DiscoveryPageShell';
import { editorialTopLists } from '@/lib/catalog/top-lists';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { createPageMetadata } from '@/lib/seo/page-metadata';
export const dynamic = 'force-dynamic';
export async function generateMetadata() {
  const { locale } = await resolveRequestLocale();
  return createPageMetadata({ title: locale === 'nl' ? 'Redactionele toplijsten — LumiScore' : 'Editorial reading lists — LumiScore',
    description: locale === 'nl' ? 'Ontdek onze Top 10 dystopie vanaf 1990 en Top 25 fantasy en sciencefiction.' : 'Explore our Top 10 dystopia from 1990 and Top 25 fantasy and science fiction.', canonicalPath: '/toplijsten' });
}
export default async function TopListsPage() {
  const [{ locale }, authState] = await Promise.all([resolveRequestLocale(), import('@/lib/supabase/auth').then(m=>m.loadHeaderAuthState()).catch(()=>({authenticated:false}))]);
  return <DiscoveryPageShell path="/toplijsten" authState={authState}><section className="featured-section editorial-lists">
    <p className="eyebrow">{locale === 'nl' ? 'Gekozen door de redactie' : 'Chosen by our editors'}</p>
    <h1>{locale === 'nl' ? 'Een goed verhaal begint hier' : 'A good story starts here'}</h1>
    <p>{locale === 'nl' ? 'Redactionele leestips, geen ranglijst van gebruikersscores. Begin met een wereld die je nieuwsgierig maakt.' : 'Editorial reading choices, not a ranking of reader scores. Start with a world that sparks your curiosity.'}</p>
    <div className="category-overview">{editorialTopLists.map(list=><a key={list.slug} href={'/toplijsten/'+list.slug}><h2>{list.title[locale]}</h2><p>{list.description[locale]}</p><span>{locale === 'nl' ? 'Bekijk de selectie →' : 'Explore the selection →'}</span></a>)}</div>
    <a href="/taste-test">{locale === 'nl' ? 'Liever persoonlijk advies? Doe de smaaktest →' : 'Prefer personal advice? Take the taste test →'}</a>
  </section></DiscoveryPageShell>;
}
