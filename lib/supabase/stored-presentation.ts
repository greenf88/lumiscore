import type { Book } from '../../app/data/books.ts';
import type { Locale } from '../i18n/config.ts';
import { applyStoredPresentation, storedPresentationSelection, type StoredDescription, type StoredEditionMetadata } from '../books/stored-presentation.ts';
import { supabase } from './client';

/** Two indexed public reads for the visible selection only, never a catalogue load.
 * No scores, profile, cookies or user client enter the cache. Short expiry also
 * refreshes approved data updates; failures are NOT cached as absence. Existing
 * legacy registry approvals are separate and must be retired explicitly if revoked. */
const cache=new Map<string,{expires:number; data:Promise<{descriptions:StoredDescription[];editions:StoredEditionMetadata[]}>}>();
export async function hydrateStoredPresentation(books:readonly Book[],locale:Locale,onRead?:(requests:number)=>void):Promise<Book[]> {
  const {workIds:ids,editionIds,key}=storedPresentationSelection(books,locale);
  if(!ids.length)return [...books];
  let entry=cache.get(key);
  if(!entry||entry.expires<=Date.now()){
    onRead?.(2);
    const signal=AbortSignal.timeout(1500);
    const data=Promise.all([
      supabase.from('catalog_work_descriptions').select('work_id,language,bound_author_id,text,source_type,source_name,source_url,reviewed_at,review_status')
        .in('work_id',ids).eq('language',locale).limit(ids.length).abortSignal(signal),
      supabase.from('catalog_edition_metadata').select('edition_id,work_id,bound_author_id,bound_title,bound_language,bound_isbn13,format,cover_url,card_cover_url,evidence_url,review_status')
        .in('edition_id',editionIds).limit(editionIds.length).abortSignal(signal),
    ]).then(([d,e])=>{
      if(d.error||e.error)throw new Error('Reviewed public presentation unavailable');
      return {descriptions:d.data as StoredDescription[],editions:e.data as StoredEditionMetadata[]};
    }).catch(error=>{cache.delete(key);throw error;});
    entry={expires:Date.now()+30_000,data};cache.set(key,entry);
    if(cache.size>200)cache.delete(cache.keys().next().value!);
  }
  try {const data=await entry.data;return applyStoredPresentation(books,locale,data.descriptions,data.editions);}
  catch {return books.map(book=>({...book,storedPresentationUnavailable:true}));}
}
