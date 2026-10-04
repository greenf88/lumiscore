import {NextResponse,type NextRequest} from 'next/server';
import {isSameOriginRequest,PRIVATE_RESPONSE_HEADERS} from '@/lib/auth/request';
import {isCatalogWorkId} from '@/lib/books/book-detail';
import {prototypeAllowed} from '@/lib/bookmatch/model';
import {readServerEnvironment} from '@/lib/server-environment';
import {getVerifiedServerUser} from '@/lib/supabase/auth';
export async function POST(request:NextRequest) {
  const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:PRIVATE_RESPONSE_HEADERS});
  if(!prototypeAllowed({node:process.env.NODE_ENV,vercel:process.env.VERCEL_ENV,url:readServerEnvironment('NEXT_PUBLIC_SUPABASE_URL')})) return json({error:'not-found'},404);
  if(!isSameOriginRequest(request)) return json({error:'forbidden'},403);
  try {
    const body=await request.text();
    if(body.length>128) return json({error:'invalid-work'},400);
    const input=JSON.parse(body) as Record<string,unknown>;
    if(!input || Object.keys(input).length!==1 || typeof input.workId!=='string' || !isCatalogWorkId(input.workId)) return json({error:'invalid-work'},400);
    const {client,user}=await getVerifiedServerUser();
    if(!user) return json({error:'sign-in-required'},401);
    // Atomic insert-only wishlist action: no existing status is ever updated.
    const {error}=await client.from('user_book_status').upsert({user_id:user.id,work_id:Number(input.workId),status:'want_to_read'}, {onConflict:'user_id,work_id',ignoreDuplicates:true});
    if(error) throw error;
    const result=await client.from('user_book_status').select('status').eq('user_id',user.id).eq('work_id',Number(input.workId)).single();
    if(result.error) throw result.error;
    return json({status:result.data.status});
  } catch {return json({error:'wishlist-action-unconfirmed'},503);}
}
