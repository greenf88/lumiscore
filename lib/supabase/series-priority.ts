import type { SupabaseClient } from '@supabase/supabase-js';
import type { Locale } from '../i18n/config.ts';
import { loadSeriesMemberships,loadStrictRecommendationBooks } from './taste-safety.ts';
import { loadCatalogBooksByIds } from './books.ts';
import { seriesPriorities } from '../recommendations/series-priority.ts';
import type { ReaderRatingRow,ReaderStatusRow } from './reader-taste-profile.ts';
import { isReadingStatus } from '../collections/model.ts';

export async function loadSeriesPriorities(client:SupabaseClient,ratings:readonly ReaderRatingRow[],statuses:readonly ReaderStatusRow[],language:Locale){
  if(!ratings.some(r=>r.rating>=9))return [];
  const memberships=await loadSeriesMemberships(client);
  const rated=new Map(ratings.map(r=>[String(r.work_id),r]));
  const slugs=new Set([...memberships].flatMap(([id,ms])=>ms.filter(m=>m.type==='series'&&m.sequence===1&&(rated.get(id)?.rating??0)>=9).map(m=>m.slug)));
  const ids=[...memberships].filter(([,ms])=>ms.some(m=>slugs.has(m.slug))).map(([id])=>id);
  const books=await loadStrictRecommendationBooks(client,await loadCatalogBooksByIds(ids,undefined,language),language);
  return seriesPriorities({memberships,books:new Map(books.map(b=>[b.workId!,b])),language,
    ratings:ratings.map(r=>({workId:String(r.work_id),rating:r.rating,updatedAt:r.updated_at})),
    statuses:new Map(statuses.flatMap(s=>isReadingStatus(s.status)?[[String(s.work_id),s.status] as const]:[]))});
}
