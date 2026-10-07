import { DiscoveryPageShell } from '@/app/components/DiscoveryPageShell';
import { RecommendationOverview } from '@/app/components/RecommendationOverview';
import { recommendationLimit } from '@/lib/catalog/discovery';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { createLocalizedPageMetadata } from '@/lib/seo/localized-metadata';
import type { HomepagePersonalization } from '@/lib/supabase/taste-test';
export const dynamic = 'force-dynamic';
export async function generateMetadata() { return createLocalizedPageMetadata({ title: 'Recommendations — LumiScore', canonicalPath: '/recommendations', noIndex: true }); }
export default async function RecommendationsPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ locale }, params, authState] = await Promise.all([resolveRequestLocale(), searchParams,
    import('@/lib/supabase/auth').then(m => m.loadHeaderAuthState()).catch(() => ({ authenticated: false }))]);
  const limit = recommendationLimit(params.limit);
  const personalization = await import('@/lib/supabase/taste-test')
    .then(({loadHomepagePersonalization}) => loadHomepagePersonalization(locale, limit))
    .catch((): HomepagePersonalization => ({unavailable:true,authenticated:false,ratingCount:0,tasteTestAnsweredCount:0,hasEvidence:false,recommendations:[]}));
  return <DiscoveryPageShell authState={authState} path={`/recommendations?limit=${limit}`}>
    <RecommendationOverview personalization={personalization} limit={limit} />
  </DiscoveryPageShell>;
}
