import {redirect} from 'next/navigation';
import {getVerifiedServerUser,loadHeaderAuthState} from '@/lib/supabase/auth';
import {loadReadingProfileForOwner} from '@/lib/supabase/reading-profile';
import {resolveRequestLocale} from '@/lib/i18n/server';
import {localizedHref} from '@/lib/i18n/paths';
import {createLocalizedPageMetadata} from '@/lib/seo/localized-metadata';
import {LumiScoreReadingProfile} from '@/app/components/LumiScoreReadingProfile';
export const dynamic='force-dynamic';
export async function generateMetadata(){return createLocalizedPageMetadata({title:'My reading profile — LumiScore',canonicalPath:'/account',noIndex:true});}
export default async function AccountPage(){
  const [{client,user},{locale}]=await Promise.all([getVerifiedServerUser(),resolveRequestLocale()]);
  if(!user)redirect(localizedHref('/login?next='+encodeURIComponent(localizedHref('/account',locale)),locale));
  const [authState,data]=await Promise.all([loadHeaderAuthState(),loadReadingProfileForOwner(client,user.id,locale).catch(()=>null)]);
  return <LumiScoreReadingProfile authState={authState} email={user.email??null} data={data} />;
}
