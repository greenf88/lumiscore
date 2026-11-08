import type {Locale} from '../i18n/config.ts';
import type {VerifiedPageRevision} from '../seo/verified-lastmod.ts';
import {publicBookRevisionHash,type PublicSourceDisposition} from '../seo/public-revision-projection.ts';
import {loadCatalogBooksByIds} from './books.ts';
import {supabase} from './client.ts';
/** Only the existing PR92 ledger is public. The event journal is never read here.
 * Bounded keyset reads and batches; no external descriptions/cover fetches. */
export async function loadPublishedBookRevisions(locale:Locale):Promise<Map<string,VerifiedPageRevision>> {
 const result=new Map<string,VerifiedPageRevision>();
 try{
 let after=0;
 for(let page=0;page<20;page++){
  const {data,error}=await supabase.from('catalog_public_page_revisions').select('work_id,locale,presentation_hash,content_changed_at,receipt_sha256')
   .eq('locale',locale).gt('work_id',after).order('work_id').limit(1000).abortSignal(AbortSignal.timeout(1500));
  if(error||!data)throw Error('Revision ledger unavailable');
  for(let start=0;start<data.length;start+=50){
   const rows=data.slice(start,start+50),ids=rows.map(r=>String(r.work_id));
   const [books,links]=await Promise.all([loadCatalogBooksByIds(ids,undefined,locale),supabase.from('collection_books')
    .select('work_id,collection_id,sequence_number,publication_order,subgroup,collections(slug,name,collection_type,description,expected_main_series_total)')
    .in('work_id',ids).limit(1001).abortSignal(AbortSignal.timeout(1500))]);
   if(links.error||!links.data||links.data.length>1000)throw Error('Incomplete public relations');
   const withoutText=books.filter(b=>!b.storedDescription&&b.editionId);
   const dispositions=withoutText.length?await supabase.from('catalog_description_snapshots')
    .select('work_id,edition_id,locale,source_key,provider_status').in('edition_id',withoutText.map(b=>b.editionId!)).eq('locale',locale)
    .limit(withoutText.length+1).abortSignal(AbortSignal.timeout(1500)):{data:[],error:null};
   if(dispositions.error||!dispositions.data||dispositions.data.length>withoutText.length)throw Error('Disposition unavailable');
   for(const row of rows){const b=books.find(b=>b.workId===String(row.work_id));
    const disposition=(dispositions.data as PublicSourceDisposition[]).find(s=>String(s.work_id)===String(row.work_id)&&String(s.edition_id)===b?.editionId);
    const currentHash=b?publicBookRevisionHash(b,locale,links.data.filter(l=>String(l.work_id)===String(row.work_id)),disposition):null;
    result.set(`/${locale}/book/${row.work_id}`,{currentHash,recordedHash:row.presentation_hash,changedAt:row.content_changed_at,receiptSha256:row.receipt_sha256});
   }
  }
  if(data.length<1000)return result;
  const last=Number(data.at(-1)?.work_id);if(!Number.isSafeInteger(last)||last<=after)throw Error('Revision pagination did not advance');after=last;
 }
 throw Error('Revision safety bound exceeded');
 }catch{console.warn(JSON.stringify({event:'public_revision_dates_unavailable',locale}));return new Map();}
}
