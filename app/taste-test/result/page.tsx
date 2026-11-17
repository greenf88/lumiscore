import { Suspense } from 'react';
import { TasteRatingResult, TasteResultLoading } from '@/app/components/TasteRatingResult';
import { loadHeaderAuthState } from '@/lib/supabase/auth';
import { createLocalizedPageMetadata } from '@/lib/seo/localized-metadata';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { loadRatingResult } from '@/lib/supabase/rating-result';
import type { HeaderAuthState } from '@/lib/auth/header';
import type { Locale } from '@/lib/i18n/config';
export const dynamic = 'force-dynamic';
export async function generateMetadata() { return createLocalizedPageMetadata({title:'Your reading taste — LumiScore',canonicalPath:'/taste-test/result',noIndex:true}); }
export default async function Page() {
  const [authState,{locale}] = await Promise.all([loadHeaderAuthState().catch(()=>({authenticated:false})),resolveRequestLocale()]);
  return <Suspense fallback={<TasteResultLoading authState={authState} />}><Result authState={authState} locale={locale} /></Suspense>;
}
async function Result({authState,locale}:{authState:HeaderAuthState;locale:Locale}) {
  // Start on the server: no document → hydration → API waterfall on mobile.
  const initialResult = await loadRatingResult(locale).catch(()=>null);
  return <TasteRatingResult authState={authState} initialResult={initialResult} initialLocale={locale} initialFailed={!initialResult} />;
}
