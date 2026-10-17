import type { SupabaseClient } from '@supabase/supabase-js';
import type { Book } from '../../app/data/books.ts';
import type { Locale } from '../i18n/config.ts';
import { withStrictEdition, selectStrictEdition, type StrictEditionRow, type EditionBoundCover } from '../books/strict-edition.ts';
import { buildEffectiveWorkTraitVector } from '../recommendations/work-trait-evidence.ts';
import { getReviewedWorkTraitCorrection } from '../recommendations/reviewed-work-trait-corrections.ts';
import { loadWorkTraitEvidenceBatched } from './work-trait-evidence.ts';
import { tasteEligibility, type TasteIdentity, type TasteMembership, type OfferHistory } from '../taste-test/eligibility.ts';
import { loadStoredCoverResolutionsBatched } from './cover-resolutions.ts';

const editionSelect = 'id,work_id,title,language,isbn_10,isbn_13,open_library_edition_id,publisher';
async function paged<T>(client: SupabaseClient, table: string, select: string, key: string, ids?: readonly string[], userId?: string) {
  const rows: T[] = [];
  const batches = ids ? Array.from({length:Math.ceil(ids.length/200)},(_,i)=>ids.slice(i*200,(i+1)*200)) : [null];
  for (const batch of batches) for (let offset=0;;offset+=1000) {
    let q=client.from(table).select(select).order(key);
    if(batch)q=q.in(table==='works'?'id':'work_id',batch);
    if(userId)q=q.eq('user_id',userId);
    const {data,error}=await q.range(offset,offset+999);
    if(error)throw error;if(!Array.isArray(data))throw new Error('Safety metadata unavailable');
    rows.push(...data as unknown as T[]);if(data.length<1000)break;
  }
  return rows;
}
type StoredEditionCover = EditionBoundCover & {work_id:string|number};
export async function loadStrictRecommendationBooks(client: SupabaseClient, books: readonly Book[], language: Locale,
  providedCovers?: readonly StoredEditionCover[]): Promise<Book[]> {
  const ids=[...new Set(books.flatMap(b=>b.workId?[b.workId]:[]))];
  const cached = async (): Promise<readonly StoredEditionCover[]> => {
    if(providedCovers)return providedCovers;
    // Existing server-only cache reader. Bound batch size; never create/resolve a
    // cover or accept a Work-keyed result as evidence for an edition.
    const batches=Array.from({length:Math.ceil(ids.length/200)},(_,i)=>ids.slice(i*200,(i+1)*200));
    const responses=await Promise.all(batches.map(batch=>loadStoredCoverResolutionsBatched(batch)));
    return responses.flatMap(r=>r.entries.map(e=>({work_id:e.workId,state:e.state,source_key:e.sourceKey,cover_url:e.coverUrl})));
  };
  const [editions,covers]=await Promise.all([paged<StrictEditionRow>(client,'editions',editionSelect,'id',ids),cached()]);
  const byWork=new Map<string,StrictEditionRow[]>();
  const coversByWork=new Map<string,StoredEditionCover[]>();
  for(const e of editions){const id=String(e.work_id);byWork.set(id,[...(byWork.get(id)??[]),e]);}
  for(const c of covers){const id=String(c.work_id);coversByWork.set(id,[...(coversByWork.get(id)??[]),c]);}
  return books.flatMap(book=>{
    const edition=selectStrictEdition(byWork.get(book.workId!)??[],language,book.title);
    const strict=withStrictEdition(book,edition,language,coversByWork.get(book.workId!)??[]);return strict?[strict]:[];
  });
}
type SafetyRow = {
  id: number; title: string; work_type: string | null; subjects: string[] | null;
  open_library_id: string | null; native_identity_key: string | null;
  authors: {name:string} | {name:string}[] | null; editions: StrictEditionRow[];
  work_catalog_categories: {category_id:string}[];
  collection_books: { sequence_number:number|null; subgroup:string|null; collections: {
    id:number;slug:string;name:string;collection_type:string;expected_main_series_total:number|null
  } | null }[];
};
export function identityFromSafetyRow(row: SafetyRow): TasteIdentity {
  const author=Array.isArray(row.authors)?row.authors[0]?.name:row.authors?.name;
  return {workId:String(row.id),title:row.title,author:author??null,identityKey:row.open_library_id??row.native_identity_key,
    workType:row.work_type,labels:[...(row.subjects??[]),...(row.work_catalog_categories??[]).map(x=>x.category_id.replaceAll('_',' '))],
    editions:row.editions??[],memberships:(row.collection_books??[]).flatMap(m=>m.collections?[{
      collectionId:String(m.collections.id),slug:m.collections.slug,name:m.collections.name,type:m.collections.collection_type,
      sequence:m.sequence_number,subgroup:m.subgroup,expectedTotal:m.collections.expected_main_series_total
    }]:[])};
}
export async function loadTasteIdentities(client: SupabaseClient, ids: readonly string[]) {
  const rows=await paged<SafetyRow>(client,'works',
    'id,title,work_type,subjects,open_library_id,native_identity_key,authors(name),editions('+editionSelect+'),work_catalog_categories(category_id),collection_books(sequence_number,subgroup,collections(id,slug,name,collection_type,expected_main_series_total))',
    'id',[...new Set(ids)]);
  return rows.map(identityFromSafetyRow);
}
export async function loadTasteEligibility(client: SupabaseClient, ids: readonly string[], language: Locale) {
  const [identities,raw]=await Promise.all([loadTasteIdentities(client,ids),loadWorkTraitEvidenceBatched(client,ids)]);
  return new Map(identities.map(identity=>{
    const rows=raw.get(identity.workId)??[];
    const effective=buildEffectiveWorkTraitVector(rows,getReviewedWorkTraitCorrection(identity.workId));
    // Cooking evidence can live in source labels even if subjects were not stored.
    const full={...identity,labels:[...identity.labels,...rows.flatMap(r=>r.rawLabels)]};
    return [identity.workId,{identity:full,...tasteEligibility(full,effective,language)}] as const;
  }));
}
export async function loadOwnOfferHistory(client: SupabaseClient, userId: string): Promise<OfferHistory[]> {
  const rows=await paged<{work_id:number;round_id:string;decision:OfferHistory['decision']}>(client,'taste_rating_offers','work_id,round_id,decision','work_id',undefined,userId);
  return rows.map(r=>({workId:String(r.work_id),roundId:r.round_id,decision:r.decision}));
}
export async function loadSeriesMemberships(client: SupabaseClient): Promise<Map<string,TasteMembership[]>> {
  type Row={work_id:number;sequence_number:number|null;subgroup:string|null;collections:{
    id:number;slug:string;name:string;collection_type:string;expected_main_series_total:number|null
  }};
  // Stable composite ordering; complete public graph, not one truncated related page.
  const rows:Row[]=[];
  for(let offset=0;;offset+=1000){
    const {data,error}=await client.from('collection_books').select('work_id,sequence_number,subgroup,collections(id,slug,name,collection_type,expected_main_series_total)').order('collection_id').order('work_id').range(offset,offset+999);
    if(error)throw error;if(!Array.isArray(data))throw new Error('Series metadata unavailable');rows.push(...data as unknown as Row[]);if(data.length<1000)break;
  }
  const grouped=new Map<string,TasteMembership[]>();
  for(const r of rows){if(!r.collections)continue;const id=String(r.work_id),c=r.collections;
    grouped.set(id,[...(grouped.get(id)??[]),{collectionId:String(c.id),slug:c.slug,name:c.name,type:c.collection_type,
      sequence:r.sequence_number,subgroup:r.subgroup,expectedTotal:c.expected_main_series_total}]);}
  return grouped;
}
