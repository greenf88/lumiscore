import { NextResponse } from 'next/server';
import { getVerifiedServerUser } from '@/lib/supabase/auth';
import { PRIVATE_RESPONSE_HEADERS } from '@/lib/auth/request';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { normalizeCatalogSearchQuery } from '@/lib/books/catalog-search';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:PRIVATE_RESPONSE_HEADERS});
/** Owner-only, bounded search. Same DB eligibility as selection and resume.
 * Ordinary catalogue search and direct ratings deliberately remain unchanged. */
export async function GET(request:Request) {
 try {
  const {client,user}=await getVerifiedServerUser();
  if(!user)return json({error:'Sign in.'},401);
  const {locale}=await resolveRequestLocale(request);
  const query=normalizeCatalogSearchQuery(new URL(request.url).searchParams.get('q')??'').slice(0,100);
  if(query.length<2)return json({results:[]});
  const {data,error}=await client.rpc('taste_rating_candidates',{p_query:query,p_language:locale});
  if(error)throw error;
  if(!Array.isArray(data)||data.length>20)throw new Error('Invalid candidate window');
  const ids=data.map((r:{work_id:number|string})=>String(r.work_id));
  const {loadCatalogBooksByIdsWithStoredCovers}=await import('@/lib/supabase/books');
  const books=await loadCatalogBooksByIdsWithStoredCovers(ids,undefined,locale);
  return json({results:books,language:locale});
 } catch {return json({error:'Taste search unavailable.',results:[]},503);}
}
