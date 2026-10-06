import { TasteRatingResult } from '@/app/components/TasteRatingResult';
import { loadHeaderAuthState } from '@/lib/supabase/auth';
import { createPageMetadata } from '@/lib/seo/page-metadata';
export const dynamic = 'force-dynamic';
export const metadata = createPageMetadata({title:'Your reading taste — LumiScore',canonicalPath:'/taste-test/result',noIndex:true});
export default async function Page() {
  const authState = await loadHeaderAuthState().catch(()=>({authenticated:false}));
  return <TasteRatingResult authState={authState} />;
}
