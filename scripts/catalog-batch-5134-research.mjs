// Deterministic offline construction from bounded discovery and verified bulk facts.
import {digest,validateBatch,EXPANSION_BATCH_SCHEMA} from './catalog-batch-core.mjs';
import {validIsbn,normalizeIdentity} from './catalog-selection-core.mjs';
const nonFiction=new Set(['nl-history','nl-science','nl-biography','nl-psychology','biography','history','science','psychology','society','economics']);
const specialist=new Set(['fantasy','science-fiction','thriller','dystopia']);
// Explicit reviewed quarantine, not corrections to existing bibliography.
export const REVIEW_EXCLUSIONS={
 OL35596580W:'DUPLICATE_AUTHOR_ALIAS: De avonden already exists under Gerard Kornelis van het Reve',
 OL18182178W:'BUNDLE: Goosebumps Vanishing collection',
 OL17822206W:'BUNDLE: The Selection Stories combines already separate novellas',
 OL17301107W:'BUNDLE: alternate The Selection Stories record',
 OL20024798W:'BUNDLE: Demigods and Magicians collects separate crossover stories',
 OL17310714W:'BUNDLE: Auggie and Me combines three companion stories',
 OL149142W:'BUNDLE: The Langoliers / Secret Window, Secret Garden',
 OL34794096W:'UNRELIABLE_FIRST_PUBLICATION_YEAR: Terug naar Oegstgeest split source record',
 OL643721W:'UNRELIABLE_FIRST_PUBLICATION_YEAR: Philip en de anderen source year is a later edition',
 OL8211890W:'EDITION_VOLUME_CONTRADICTION: source Work Ranma volume 33 versus Edition volume 31',
 OL17559343W:'UNCERTAIN_COMPOSITE_OR_COMPANION: generic Horus Heresy source is not a proved independent novel',
};
// More conservative discovery-only review, not a change to historical contracts.
// A slash can also be a legitimate title/fraction; uncertain cases stay out rather
// than promote a possible combined Edition to another net-new Work.
export function compositeReviewReason(record){
 const titles=record.title+' '+record.edition.title;
 if(titles.includes('/')||/\b(?:collection|boxed set|alle verhalen|verzamelde (?:gedichten|verhalen|werken)|complete (?:short )?(?:stories|poems)|complete stories and poems)\b/i.test(titles))return 'UNCERTAIN_COMPOSITE_EDITION';
 return REVIEW_EXCLUSIONS[record.open_library_id]?'REVIEW_QUARANTINE':null;
}
export function buildResearchRecords(discovery,dump,cached=[],worksDump,baseline){
 const byEdition=new Map(dump.editions.map(e=>[e.record.key,e])),accepted=[],rejected=[];
 const byWork=new Map((worksDump?.works??[]).map(w=>[w.record.key,w]));
 for(const c of discovery){
  if(REVIEW_EXCLUSIONS[c.work_id]){rejected.push({work:c.work_id,reason:'REVIEW_QUARANTINE',detail:REVIEW_EXCLUSIONS[c.work_id]});continue;}
  const found=byEdition.get('/books/'+c.edition_id),e=found?.record;
  const sourceWork=byWork.get('/works/'+c.work_id),inherited=e&&(e.authors?.length??0)===0&&sourceWork?.record?.authors?.length===1&&sourceWork.record.authors[0].author?.key==='/authors/'+c.author_id&&normalizeIdentity(sourceWork.record.title)===normalizeIdentity(c.title);
  if(!e||e.works?.length!==1||e.works[0].key!=='/works/'+c.work_id||(!inherited&&(e.authors?.length!==1||e.authors[0].key!=='/authors/'+c.author_id))||!e.isbn_13.includes(c.isbn)||!validIsbn(c.isbn)){rejected.push({work:c.work_id,reason:'INCOMPLETE_EXACT_DUMP_CHAIN'});continue;}
  const r={candidate_id:'LSPLUS5134-0001',title:c.title,author:{name:c.author,open_library_id:c.author_id},open_library_id:c.work_id,year:c.year,edition:{open_library_edition_id:c.edition_id,title:e.title,isbn_13:c.isbn,isbn_10:e.isbn_10.find(validIsbn)??null,language:e.languages[0]?.key?.split('/').at(-1)??null,publisher:e.publishers[0]??null},categories:[],collections:[],proof:{route:'ISBN_EDITION_WORK',isbn_13:c.isbn,edition_key:e.key,work_keys:e.works.map(w=>w.key),author_keys:(e.authors??[]).map(a=>a.key),physical_format:e.physical_format,pages:e.number_of_pages,source_url:dump.source.url,search_url:c.search_url,verified_at:c.verified_search_at,selection_reason:c.lane+'; want_to_read position '+c.rank,identity_review:'Exact dump ISBN/Edition/single parent/author; source discovery is not classification',dump:{sha1:dump.source.sha1,sha256:dump.source.sha256,revision:found.revision,modified:found.modified,record:e,record_sha256:found.record_sha256}},research:{lane:c.lane,rank:c.rank,all_isbns:c.all_isbns,cover_metadata_available:e.covers.length>0,original_language:'UNKNOWN',dutch_flemish_original:'UNKNOWN',classification:'UNREVIEWED_SOURCE_DISCOVERY_HINT'}};
  if(inherited){r.proof.author_source='WORK_DUMP';r.proof.author_keys=sourceWork.record.authors.map(a=>a.author.key);r.proof.work_dump={url:worksDump.source.url,sha1:worksDump.source.sha1,sha256:worksDump.source.sha256,revision:sourceWork.revision,modified:sourceWork.modified,record:sourceWork.record,record_sha256:sourceWork.record_sha256};}
  try{
   // Reuse the same full field/form validator on a complete local-only envelope.
   const probe={schema:EXPANSION_BATCH_SCHEMA,slug:'lumiscore-plus5134-validation',required_new_works:5134,synthetic:true,records:Array(5134).fill(r)};
   try{validateBatch(probe,{local:true});}catch(error){if(error.message!=='DUPLICATE_INPUT_IDENTITY')throw error;}
   accepted.push(r);
  }catch(error){rejected.push({work:c.work_id,reason:/^[A-Z_]+$/.test(error.message)?error.message:'SOURCE_RECORD_REJECTED'});}
 }
 for(const r of cached)accepted.unshift({...r,candidate_id:'LSPLUS5134-0001',research:{lane:'reviewed-reserve',rank:0,all_isbns:[r.edition.isbn_13],cover_metadata_available:null,original_language:'UNKNOWN',dutch_flemish_original:'UNKNOWN',classification:'UNKNOWN'}});
 const existingNames=new Map((baseline?.authors??[]).map(a=>[a.id,a.name]));
 const existingAuthors=new Map();
 for(const a of baseline?.authors??[]){for(const key of ['ol:'+a.open_library_id?.replace('/authors/',''),'name:'+normalizeIdentity(a.name)]){const hits=existingAuthors.get(key)??[];hits.push(a);existingAuthors.set(key,hits);}}
 const worksById=new Map((baseline?.works??[]).map(w=>[w.id,w]));
 const existingKeys=new Set([
 ...(baseline?.works??[]).flatMap(w=>['w:'+w.open_library_id?.replace('/works/',''),'t:'+normalizeIdentity(w.title)+'::'+normalizeIdentity(existingNames.get(w.author_id))]),
 ...(baseline?.editions??[]).flatMap(e=>['e:'+e.open_library_edition_id?.replace('/books/',''),'i:'+e.isbn_13,'i:'+e.isbn_10,'t:'+normalizeIdentity(e.title)+'::'+normalizeIdentity(existingNames.get(worksById.get(e.work_id)?.author_id))]),
 ...(baseline?.aliases??[]).map(a=>'t:'+normalizeIdentity(a.title)+'::'+normalizeIdentity(existingNames.get(worksById.get(a.work_id)?.author_id)))
 ]);
 const unique=[],keys=new Set(),authorNames=new Map(),authorIds=new Map();
 const priority=lane=>lane==='reviewed-reserve'?0:lane==='named-author-gaps'?1:2;
 accepted.sort((a,b)=>priority(a.research.lane)-priority(b.research.lane)||a.research.rank-b.research.rank||a.open_library_id.localeCompare(b.open_library_id));
 for(const r of accepted){
  const formReview=compositeReviewReason(r);
  if(formReview){rejected.push({work:r.open_library_id,reason:formReview});continue;}
  const name=normalizeIdentity(r.author.name),all=['w:'+r.open_library_id,'e:'+r.edition.open_library_edition_id,...r.research.all_isbns.map(i=>'i:'+i),'t:'+normalizeIdentity(r.title)+'::'+name,'t:'+normalizeIdentity(r.edition.title)+'::'+name];
  const authorHits=[...new Map(['ol:'+r.author.open_library_id,'name:'+name].flatMap(k=>existingAuthors.get(k)??[]).map(a=>[a.id,a])).values()];
  if(all.some(k=>existingKeys.has(k))){rejected.push({work:r.open_library_id,reason:'CURRENT_PRODUCTION_IDENTITY_OVERLAP'});continue;}
  if(authorHits.length>1||authorHits.length===1&&(normalizeIdentity(authorHits[0].name)!==name||authorHits[0].open_library_id&&authorHits[0].open_library_id.replace('/authors/','')!==r.author.open_library_id)){rejected.push({work:r.open_library_id,reason:'CURRENT_PRODUCTION_AUTHOR_CONFLICT'});continue;}
  if(all.some(k=>keys.has(k))||authorNames.has(r.author.open_library_id)&&authorNames.get(r.author.open_library_id)!==name||authorIds.has(name)&&authorIds.get(name)!==r.author.open_library_id){rejected.push({work:r.open_library_id,reason:'OVERLAP_OR_AUTHOR_AMBIGUITY'});continue;}
  all.forEach(k=>keys.add(k));authorNames.set(r.author.open_library_id,name);authorIds.set(name,r.author.open_library_id);unique.push(r);
 }
 const picked=[],used=new Set();let specialistCount=0;
 const take=(predicate,cap)=>{for(const r of unique){if(cap<=0||picked.length>=5134)break;if(used.has(r.open_library_id)||!predicate(r)||specialist.has(r.research.lane)&&specialistCount>=750)continue;picked.push(r);used.add(r.open_library_id);if(specialist.has(r.research.lane))specialistCount++;cap--;}};
 take(r=>r.research.lane==='reviewed-reserve',100);take(r=>['dut','nld','nl'].includes(r.edition.language),1500);take(r=>nonFiction.has(r.research.lane),1800);take(r=>r.research.lane==='general-fiction',2000);take(()=>true,5134-picked.length);
 const reserves=unique.filter(r=>!used.has(r.open_library_id)).slice(0,100);
 picked.forEach((r,i)=>r.candidate_id='LSPLUS5134-'+String(i+1).padStart(4,'0'));reserves.forEach((r,i)=>r.candidate_id='LSPLUS5134-'+String(i+5135).padStart(4,'0'));
 return {records:picked,reserves,rejected,available_verified:unique.length,source:dump.source,work_source:worksDump?.source??null,record_set_hash:digest(picked),specialist_count:specialistCount};
}
