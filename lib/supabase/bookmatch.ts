import { createServerSupabaseClient } from './server.ts';
import { loadRecommendationCatalog } from './recommendation-catalog.ts';
import { mapCatalogWorks, loadCatalogBooksByIdsWithStoredCovers } from './books.ts';
import { reliableResultTraits } from '../taste-test/rating-result.ts';
import { TASTE_TRAITS } from '../taste-test/traits.ts';
import { TASTE_TEST_WORK_IDS } from '../taste-test/config.ts';
import { shuffleRank, type MatchCard } from '../bookmatch/model.ts';
import type { Locale } from '../i18n/config.ts';

export async function loadBookmatchDeck(locale:Locale,seed:string,seen:ReadonlySet<string>) {
  const client=await createServerSupabaseClient();
  const {data:{user},error}=await client.auth.getUser();
  if(error && ((error.status??0)>=500 || error.name==='AuthRetryableFetchError')) throw error;
  const excluded=new Set([...TASTE_TEST_WORK_IDS,...seen]);
  if(user) {
    for(const table of ['ratings','user_book_status'] as const) {
      for(let offset=0;;offset+=1000) {
        let query=client.from(table).select('work_id').eq('user_id',user.id).order('work_id').range(offset,offset+999);
        if(table==='user_book_status') query=query.eq('status','read');
        const {data,error}=await query;
        if(error) throw error;
        for(const row of data??[]) excluded.add(String(row.work_id));
        if((data?.length??0)<1000) break;
      }
    }
  }
  const catalog=await loadRecommendationCatalog(client,mapCatalogWorks);
  const eligible=catalog.candidates.flatMap(x=> {
    const id=x.book.workId;
    if(!id || excluded.has(id)) return [];
    const traits=reliableResultTraits(catalog.traitsById.get(id));
    return TASTE_TRAITS.some(t=>traits[t]>0)?[{book:x.book,traits}]:[];
  }).sort((a,b)=>shuffleRank(seed,a.book.workId!)-shuffleRank(seed,b.book.workId!));
  const available=new Set<string>();
  // Stop after a bounded deck is filled; queries/hydration stay server-side.
  const selected:MatchCard[]=[];
  for(let start=0;start<eligible.length && selected.length<80;start+=100) {
    const batch=eligible.slice(start,start+100);
    for(let offset=0;;offset+=1000) {
      const {data,error}=await client.from('editions').select('id,work_id').in('work_id',batch.map(x=>Number(x.book.workId)))
        .or(locale==='nl'?'language.ilike.nl,language.ilike.nld,language.ilike.dut':'language.ilike.en,language.ilike.eng').order('id').range(offset,offset+999);
      if(error) throw error;
      for(const row of data??[]) available.add(String(row.work_id));
      if((data?.length??0)<1000) break;
    }
    for(const card of batch) if(available.has(card.book.workId!) && selected.length<80) selected.push(card);
  }
  const books=await loadCatalogBooksByIdsWithStoredCovers(selected.map(x=>x.book.workId!),undefined,locale);
  const byId=new Map(books.map(x=>[x.workId,x]));
  return {owner:user?.id??'guest',cards:selected.flatMap(x=>byId.has(x.book.workId)?[{...x,book:byId.get(x.book.workId)!}]:[])};
}
