import { notFound } from 'next/navigation';
import { prototypeAllowed } from '@/lib/bookmatch/model';
import { readServerEnvironment } from '@/lib/server-environment';
import { loadHeaderAuthState,getVerifiedServerUser } from '@/lib/supabase/auth';
import { createPageMetadata } from '@/lib/seo/page-metadata';
import { Bookmatch } from '@/app/components/Bookmatch';
export const dynamic='force-dynamic';
export const metadata=createPageMetadata({title:'Boekmatch prototype — LumiScore',canonicalPath:'/bookmatch',noIndex:true});
export default async function Page() {
  if(!prototypeAllowed({node:process.env.NODE_ENV,vercel:process.env.VERCEL_ENV,url:readServerEnvironment('NEXT_PUBLIC_SUPABASE_URL')})) notFound();
  const [{user},authState]=await Promise.all([getVerifiedServerUser(),loadHeaderAuthState()]);
  return <Bookmatch owner={user?.id??'guest'} authState={authState}/>;
}
