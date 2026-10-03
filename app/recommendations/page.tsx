import { DiscoveryPageShell } from '@/app/components/DiscoveryPageShell';
import { RecommendationOverview } from '@/app/components/RecommendationOverview';
import { recommendationLimit } from '@/lib/catalog/discovery';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { createPageMetadata } from '@/lib/seo/page-metadata';
export const dynamic = 'force-dynamic';
export const metadata = createPageMetadata({ title: 'Recommendations — LumiScore', canonicalPath: '/recommendations', noIndex: true });
export default async function RecommendationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ locale }, params, authState] = await Promise.all([resolveRequestLocale(), searchParams,
    import('@/lib/supabase/auth').then(m => m.loadHeaderAuthState()).catch(() => ({ authenticated: false }))]);
  const limit = recommendationLimit(params.limit);
  const { loadHomepagePersonalization } = await import('@/lib/supabase/taste-test');
  const personalization = await loadHomepagePersonalization(locale, limit);
  return <DiscoveryPageShell authState={authState} path={`/recommendations?limit=${limit}`}>
    <form className="editorial-controls" method="get" action="/recommendations"><label>{locale === 'nl' ? 'Aantal aanbevelingen' : 'Recommendation count'}
      <select name="limit" defaultValue={limit}>{Array.from({ length: 16 }, (_, i) => i + 10).map(n => <option key={n}>{n}</option>)}</select></label>
      <button type="submit">{locale === 'nl' ? 'Toepassen' : 'Apply'}</button></form>
    <RecommendationOverview personalization={personalization} limit={limit} />
  </DiscoveryPageShell>;
}
