import { TasteRatingResult } from '@/app/components/TasteRatingResult';
import { loadHeaderAuthState } from '@/lib/supabase/auth';
import { createLocalizedPageMetadata } from '@/lib/seo/localized-metadata';
export const dynamic = 'force-dynamic';
export async function generateMetadata() { return createLocalizedPageMetadata({title:'Your reading taste — LumiScore',canonicalPath:'/taste-test/result',noIndex:true}); }
export default async function Page() {
  const authState = await loadHeaderAuthState().catch(()=>({authenticated:false}));
  return <TasteRatingResult authState={authState} />;
}
