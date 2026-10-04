import { NextResponse, type NextRequest } from 'next/server';
import { PRIVATE_RESPONSE_HEADERS } from '@/lib/auth/request';
import { prototypeAllowed,parseDeckQuery } from '@/lib/bookmatch/model';
import { readServerEnvironment } from '@/lib/server-environment';
import { resolveRequestLocale } from '@/lib/i18n/server';
import { loadBookmatchDeck } from '@/lib/supabase/bookmatch';
export async function GET(request:NextRequest) {
  const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:PRIVATE_RESPONSE_HEADERS});
  if(!prototypeAllowed({node:process.env.NODE_ENV,vercel:process.env.VERCEL_ENV,url:readServerEnvironment('NEXT_PUBLIC_SUPABASE_URL')})) return json({error:'not-found'},404);
  const query=parseDeckQuery(new URL(request.url));
  if(!query) return json({error:'invalid-deck-query'},400);
  try {
    const {locale}=await resolveRequestLocale();
    return json(await loadBookmatchDeck(locale,query.seed,query.seen));
  } catch {return json({error:'deck-unavailable'},503);}
}
