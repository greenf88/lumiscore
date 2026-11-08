// Optional durable public metadata only. No auth/session/reader data.
import {createClient} from '@supabase/supabase-js';
import {readServerEnvironment} from '../server-environment.ts';
import type {Book} from '../../app/data/books.ts';
import type {Locale} from '../i18n/config.ts';
import {descriptionBinding,type DescriptionSnapshot} from '../books/description-snapshot.ts';
import {ReviewedPresentationCache} from '../books/reviewed-presentation-cache.ts';
const table='catalog_description_snapshots';
const fields='work_id,edition_id,locale,binding_hash,bound_author_id,bound_title,bound_language,bound_isbn13,bound_open_library_work_id,text,source_key,fetched_at,checked_at,provider_status,validation';
const cache=new ReviewedPresentationCache<DescriptionSnapshot|null>();
let unavailableUntil=0;
function client(write=false){
 const url=readServerEnvironment('NEXT_PUBLIC_SUPABASE_URL');
 const key=write ? readServerEnvironment('SUPABASE_SECRET_KEY')??readServerEnvironment('SUPABASE_SERVICE_ROLE_KEY')
  : readServerEnvironment('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY');
 return url&&key?createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false}}):null;
}
function diagnostic(kind:string,code?:string){console.warn(JSON.stringify({event:'description_snapshot_unavailable',kind,code:code??null}));}
export async function loadDescriptionSnapshot(book:Book,locale:Locale):Promise<DescriptionSnapshot|null>{
 const binding=descriptionBinding(book,locale);if(!binding||Date.now()<unavailableUntil)return null;
 const db=client();if(!db)return null;
 try{return await cache.get(binding,async()=>{
  const r=await db.from(table).select(fields).eq('work_id',book.workId!).eq('edition_id',book.editionId!).eq('locale',locale)
   .abortSignal(AbortSignal.timeout(800)).maybeSingle();
  if(r.error){if(['PGRST205','42P01','42501'].includes(r.error.code))unavailableUntil=Date.now()+60000;throw Error(r.error.code);}
  return r.data as DescriptionSnapshot|null;
 });}catch{diagnostic('read');return null;}
}
export async function saveDescriptionSnapshot(row:DescriptionSnapshot):Promise<void>{
 if(Date.now()<unavailableUntil)return;
 const db=client(true);if(!db)return;
 // Schema guards reject older concurrent responses. A failure never replaces
 // valid text with null, error documents or a permanent missing-content marker.
 try {
  const r=await db.from(table).upsert(row,{onConflict:'work_id,edition_id,locale'}).abortSignal(AbortSignal.timeout(1000));
  if(r.error){diagnostic('write',r.error.code);return;}cache.invalidate(row.binding_hash);
 } catch {diagnostic('write_transport');}
}

export async function markDescriptionSnapshotFailure(row:DescriptionSnapshot,status:'temporary_failure'|'confirmed_missing'):Promise<void>{
 if(Date.now()<unavailableUntil)return;const db=client(true);if(!db)return;
 try {const r=await db.from(table).update({provider_status:status,checked_at:new Date().toISOString()})
  .eq('work_id',row.work_id).eq('edition_id',row.edition_id).eq('locale',row.locale).eq('binding_hash',row.binding_hash)
  .eq('fetched_at',row.fetched_at).abortSignal(AbortSignal.timeout(1000));
 if(r.error)diagnostic('provider_status',r.error.code);else cache.invalidate(row.binding_hash);
 } catch {diagnostic('provider_status_transport');}
}
