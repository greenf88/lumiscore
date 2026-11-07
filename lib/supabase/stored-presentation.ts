import type { Book } from '../../app/data/books.ts';
import type { Locale } from '../i18n/config.ts';
import { applyStoredPresentation, storedPresentationSelection, type StoredDescription, type StoredEditionMetadata } from '../books/stored-presentation.ts';
import { supabase } from './client';
import { ReviewedPresentationCache } from '../books/reviewed-presentation-cache.ts';

/** Two indexed public reads for the visible selection only, never a catalogue load.
 * No scores, profile, cookies or user client enter the cache. Short expiry also
 * refreshes approved data updates; failures are NOT cached as absence. A failed
 * refresh can retain prior reviewed rows for at most five minutes, with the
 * current Work/author/edition bindings checked again below. A successful empty
 * result revokes the previous value immediately. Existing
 * legacy registry approvals are separate and must be retired explicitly if revoked. */
const cache = new ReviewedPresentationCache<{descriptions:StoredDescription[];editions:StoredEditionMetadata[]}>();
export async function hydrateStoredPresentation(books:readonly Book[],locale:Locale,onRead?:(requests:number)=>void):Promise<Book[]> {
  const {workIds:ids,editionIds,key}=storedPresentationSelection(books,locale);
  if(!ids.length)return [...books];
  try {const data=await cache.get(key, async()=>{
    onRead?.(2);
    const signal=AbortSignal.timeout(1500);
    const [d,e]=await Promise.all([
      supabase.from('catalog_work_descriptions').select('work_id,language,bound_author_id,text,source_type,source_name,source_url,reviewed_at,review_status')
        .in('work_id',ids).eq('language',locale).limit(ids.length).abortSignal(signal),
      supabase.from('catalog_edition_metadata').select('edition_id,work_id,bound_author_id,bound_title,bound_language,bound_isbn13,format,cover_url,card_cover_url,evidence_url,review_status')
        .in('edition_id',editionIds).limit(editionIds.length).abortSignal(signal),
    ]);
    if(d.error||e.error)throw new Error('Reviewed public presentation unavailable');
    return {descriptions:d.data as StoredDescription[],editions:e.data as StoredEditionMetadata[]};
  });return applyStoredPresentation(books,locale,data.descriptions,data.editions);}
  catch {return books.map(book=>({...book,storedPresentationUnavailable:true}));}
}
