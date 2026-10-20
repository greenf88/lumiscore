import type {SupabaseClient} from '@supabase/supabase-js';
import type {StrictEditionRow} from '../books/strict-edition.ts';
export const EDITION_PRESENTATION_SELECT='id,work_id,title,language,isbn_10,isbn_13,open_library_edition_id,publisher';
/** Deterministic REST pagination, shared by catalog and taste. No N+1 per Work. */
export async function loadEditionRows(client:SupabaseClient,workIds:readonly string[],signal?:AbortSignal):Promise<StrictEditionRow[]>{
  const ids=[...new Set(workIds)];const rows:StrictEditionRow[]=[];
  for(let start=0;start<ids.length;start+=200)for(let offset=0;;offset+=1000){
    const query=client.from('editions').select(EDITION_PRESENTATION_SELECT).in('work_id',ids.slice(start,start+200)).order('id').range(offset,offset+999);
    const {data,error}=await(signal?query.abortSignal(signal):query);
    if(error)throw error;if(!Array.isArray(data))throw new Error('Edition metadata unavailable');
    rows.push(...data as StrictEditionRow[]);if(data.length<1000)break;
  }
  return rows;
}
