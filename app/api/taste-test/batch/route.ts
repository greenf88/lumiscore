import {NextResponse,type NextRequest} from 'next/server';
import {getVerifiedServerUser} from '@/lib/supabase/auth';
import {isSameOriginRequest,PRIVATE_RESPONSE_HEADERS} from '@/lib/auth/request';
import {readServerEnvironment} from '@/lib/server-environment';
import {isProductionBackedReview} from '@/lib/supabase/review-target';
import {parseBufferedDecisions} from '@/lib/taste-test/buffered-round';
import type {RatingRoundState} from '@/lib/taste-test/rating-round';
import {resolveRequestLocale} from '@/lib/i18n/server';
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:PRIVATE_RESPONSE_HEADERS});
const protectedReview=()=>isProductionBackedReview({deploymentEnvironment:process.env.VERCEL_ENV,nodeEnvironment:process.env.NODE_ENV,supabaseUrl:readServerEnvironment('NEXT_PUBLIC_SUPABASE_URL')});
export async function GET(request:Request){
  try{
    const {client,user}=await getVerifiedServerUser();
    if(!user)return json({authenticated:false,available:true,state:null,books:[]});
    if(protectedReview())return json({authenticated:true,available:false,state:null,books:[]});
    const {data,error}=await client.rpc('taste_rating_state');if(error)throw error;
    const state=data as RatingRoundState;
    const {locale}=await resolveRequestLocale(request);
    let books:unknown[]=[];
    if(state.round&&!state.round.complete){
      const pool=await client.rpc('taste_rating_pool',{p_round_id:state.round.id});if(pool.error)throw pool.error;
      const ids=(pool.data as {work_id:number|string}[]).map(x=>String(x.work_id));
      const {loadCatalogBooksByIds}=await import('@/lib/supabase/books');
      const loaded=await loadCatalogBooksByIds(ids,undefined,locale);
      const byId=new Map(loaded.map(b=>[b.workId,b]));books=ids.flatMap(id=>byId.has(id)?[byId.get(id)!]:[]);
    }
    const decided=state.round?await client.from('taste_rating_offers').select('work_id,score').eq('round_id',state.round.id).neq('decision','offered'):null;
    if(decided?.error)throw decided.error;
    return json({authenticated:true,available:true,owner:user.id,state,books,decided:decided?.data?.map(d=>({workId:String(d.work_id),score:d.score}))??[]});
  }catch{return json({error:'Taste round unavailable.'},503);}
}
export async function POST(request:NextRequest){
  if(!isSameOriginRequest(request))return json({error:'Forbidden.'},403);
  let input;
  try{const raw=await request.text();if(raw.length>16000)throw new Error();input=JSON.parse(raw);}catch{return json({error:'Invalid batch.'},400);}
  const decisions=parseBufferedDecisions(input?.decisions);
  if(!decisions?.length||typeof input?.roundId!=='string'||!/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(input.roundId))return json({error:'Invalid batch.'},400);
  try{
    const {client,user}=await getVerifiedServerUser();if(!user)return json({error:'Sign in.'},401);
    if(protectedReview())return json({error:'separate-test-database-required'},503);
    // Owner is verified again at save time; a switched account cannot adopt a draft.
    if(input.owner!==user.id)return json({error:'Account changed.'},409);
    const {data,error}=await client.rpc('taste_rating_save_batch',{p_round_id:input.roundId,p_decisions:decisions});
    if(error)return json({error:'Unable to save batch.'},['22023','23505'].includes(error.code)?409:503);
    return json({state:data});
  }catch{return json({error:'Unable to save batch.'},503);}
}
