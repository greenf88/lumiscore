import {digest,normalizeIdentity,validIsbn} from './catalog-selection-core.mjs';
export {digest};
export const BATCH_SCHEMA='lumiscore-additive-batch-1';
export const LARGE_BATCH_SCHEMA='lumiscore-additive-batch-2';
export const EXPANSION_BATCH_SCHEMA='lumiscore-additive-batch-3';
const fail=code=>{throw new Error(code);};
const ol=(value,suffix)=>String(value??'').replace(suffix==='W'?'/works/':suffix==='A'?'/authors/':'/books/','');
const identity=(title,author)=>normalizeIdentity(title)+'::'+normalizeIdentity(author);
export function validateBatch(input,{local=false}={}){
 const size=input?.schema===BATCH_SCHEMA?500:input?.schema===LARGE_BATCH_SCHEMA?1860:input?.schema===EXPANSION_BATCH_SCHEMA?5134:0;
 if(!size||!new RegExp('^lumiscore-plus'+size+'-[a-z0-9-]+$').test(input.slug)||input.required_new_works!==size||!Array.isArray(input.records)||input.records.length!==size)fail('BATCH_CONTRACT_INVALID');
 if(input.synthetic&&!local)fail('SYNTHETIC_PRODUCTION_INPUT_FORBIDDEN');
 const seen=new Set(),authors=new Map(),authorIdsByName=new Map();
 for(const r of input.records){
  if(!new RegExp('^LSPLUS'+size+'-\\d{4}$').test(r.candidate_id)||!r.title?.trim()||!r.author?.name?.trim()||!/^OL\d+A$/.test(r.author.open_library_id??'')||!/^OL\d+W$/.test(r.open_library_id??''))fail('INVALID_BOOK_IDENTITY');
  const e=r.edition,p=r.proof;
  if(!e?.title?.trim()||!/^OL\d+M$/.test(e.open_library_edition_id??'')||!/^97[89]\d{10}$/.test(e.isbn_13??'')||!validIsbn(e.isbn_13)||e.isbn_10&&!validIsbn(e.isbn_10))fail('INVALID_EDITION_IDENTITY');
  if(!['eng','en','dut','nld','nl'].includes(e.language)||!Number.isInteger(r.year)||r.year<1||r.year>2026)fail('INVALID_PUBLICATION_METADATA');
  if(p?.route!=='ISBN_EDITION_WORK'||p.isbn_13!==e.isbn_13||p.edition_key!=='/books/'+e.open_library_edition_id||digest(p.work_keys)!==digest(['/works/'+r.open_library_id])||digest(p.author_keys)!==digest(['/authors/'+r.author.open_library_id])||!p.verified_at)fail('UNPROVEN_IDENTITY_CHAIN');
  const apiProof=/^https:\/\/openlibrary\.org\/api\/books\?/.test(p.source_url??'');
  const dumpProof=(size===1860||size===5134)&&/^https:\/\/archive\.org\/download\/ol_dump_\d{4}-\d{2}-\d{2}\/ol_dump_editions_\d{4}-\d{2}-\d{2}\.txt\.gz$/.test(p.source_url??'')&&/^[a-f0-9]{40}$/.test(p.dump?.sha1??'')&&/^[a-f0-9]{64}$/.test(p.dump?.sha256??'')&&/^[a-f0-9]{64}$/.test(p.dump?.record_sha256??'')&&Number.isInteger(p.dump?.revision)&&p.dump.revision>0;
  if(!(apiProof||dumpProof)||!p.search_url?.startsWith('https://openlibrary.org/search.json?'))fail('INVALID_PROVENANCE');
  if(dumpProof){
   const source=p.dump.record;
   const work=p.work_dump;
   const inherited=p.author_source==='WORK_DUMP'&&(source?.authors?.length??0)===0&&/^https:\/\/archive\.org\/download\/ol_dump_\d{4}-\d{2}-\d{2}\/ol_dump_works_\d{4}-\d{2}-\d{2}\.txt\.gz$/.test(work?.url??'')&&/^[a-f0-9]{40}$/.test(work?.sha1??'')&&/^[a-f0-9]{64}$/.test(work?.sha256??'')&&Number.isInteger(work?.revision)&&work.revision>0&&work.record?.key===p.work_keys[0]&&normalizeIdentity(work.record?.title)===normalizeIdentity(r.title)&&digest(work.record)===work.record_sha256&&digest(work.record?.authors?.map(a=>a.author?.key)??[])===digest(p.author_keys);
   if(!source||digest(source)!==p.dump.record_sha256||source.key!==p.edition_key||source.title!==e.title||!source.isbn_13?.includes(e.isbn_13)||digest(source.works?.map(w=>w.key)??[])!==digest(p.work_keys)||(!inherited&&digest(source.authors?.map(a=>a.key)??[])!==digest(p.author_keys))||source.languages?.[0]?.key!=='/languages/'+e.language||(source.physical_format??null)!==p.physical_format||(source.number_of_pages??null)!==p.pages||(source.publishers?.[0]??null)!==e.publisher)fail('DUMP_RECORD_PROOF_DRIFT');
   if(p.author_source==='WORK_DUMP'&&!inherited)fail('WORK_AUTHOR_PROOF_DRIFT');
  }
  const normal=/^(paperback|hardcover|hardback|softcover|mass market paperback|trade paperback|library binding|gebonden|paperback boek)$/i.test(p.physical_format??'')||(!p.physical_format&&Number.isInteger(p.pages)&&p.pages>=50);
  if(!normal||/\b(omnibus|box[ -]?set|collected|complete (works|collection)|study guide|brief guide|companion|summary|adaptation|anthology|graphic novel|manga|signed english|and other stories|project x origins|verzameld|audiobook|audio cd)\b/i.test(r.title+' '+e.title)
    ||/\([^)]*\/[^)]*\)/.test(r.title+' '+e.title)||/^Works \(/i.test(r.title)||/Trilogy\s*(?:$|\([^)]*\/)/i.test(r.title))fail('NONSTANDARD_OR_DERIVATIVE_WORK');
  // This first batch deliberately does not infer editorial classification/series scope.
  if(r.categories?.length!==0||r.collections?.length!==0)fail('UNREVIEWED_CLASSIFICATION_OR_COLLECTION');
  const name=normalizeIdentity(r.author.name);
  if(authors.has(r.author.open_library_id)&&authors.get(r.author.open_library_id)!==name)fail('INCONSISTENT_SOURCE_AUTHOR');
  authors.set(r.author.open_library_id,name);
  if(authorIdsByName.has(name)&&authorIdsByName.get(name)!==r.author.open_library_id)fail('AMBIGUOUS_SOURCE_AUTHOR_IDS');
  authorIdsByName.set(name,r.author.open_library_id);
  for(const key of ['candidate:'+r.candidate_id,'work:'+r.open_library_id,'edition:'+e.open_library_edition_id,'isbn:'+e.isbn_13,'identity:'+identity(r.title,r.author.name)]){
   if(seen.has(key))fail('DUPLICATE_INPUT_IDENTITY');seen.add(key);
  }
 }
 return input;
}
export function planBatch(input,state,{local=false}={}){
 validateBatch(input,{local});
 if(input.schema===LARGE_BATCH_SCHEMA||input.schema===EXPANSION_BATCH_SCHEMA){
  const selection=state.selection??[];
  if(selection.length>1||selection.length===1&&!state.ledger.length)fail('UNOWNED_SELECTION_COLLISION');
  if(selection.length===1&&(selection[0].label_nl!=='Catalogusuitbreiding +'+input.required_new_works||selection[0].label_en!=='Catalog expansion +'+input.required_new_works)||state.ledger.length&&!selection.length)fail('PERSISTED_SELECTION_DRIFT');
 }
 if(state.ledger.some(e=>!input.records.some(r=>r.candidate_id===e.candidate_id)))fail('UNKNOWN_PERSISTED_CANDIDATE');
 const names=new Map(state.authors.map(a=>[a.id,a.name])),workById=new Map(state.works.map(w=>[w.id,w])),batchHash=digest(input);
 const index=(rows,keys)=>{const map=new Map();for(const row of rows)for(const key of keys(row)){if(key){const group=map.get(key)??[];group.push(row);map.set(key,group);}}return map;};
 const find=(map,keys)=>[...new Map(keys.flatMap(k=>map.get(k)??[]).map(r=>[r.id??r.work_id,r])).values()];
 const authorIndex=index(state.authors,a=>['ol:'+ol(a.open_library_id,'A'),'name:'+normalizeIdentity(a.name)]);
 const workIndex=index(state.works,w=>['ol:'+ol(w.open_library_id,'W'),'title:'+identity(w.title,names.get(w.author_id))]);
 const editionIndex=index(state.editions,e=>['ol:'+ol(e.open_library_edition_id,'M'),e.isbn_13&&'isbn:'+e.isbn_13,e.isbn_10&&'isbn:'+e.isbn_10,'title:'+identity(e.title,names.get(workById.get(e.work_id)?.author_id))]);
 const aliasIndex=index(state.aliases??[],e=>['title:'+identity(e.title,names.get(workById.get(e.work_id)?.author_id))]);
 const actions=[],newAuthors=new Set();
 for(const r of input.records){
  const authorHits=find(authorIndex,['ol:'+r.author.open_library_id,'name:'+normalizeIdentity(r.author.name)]);
  const author=authorHits.length===1?authorHits[0]:null;
  let reason=authorHits.length>1?'AMBIGUOUS_AUTHOR':author&&((author.open_library_id&&ol(author.open_library_id,'A')!==r.author.open_library_id)||normalizeIdentity(author.name)!==normalizeIdentity(r.author.name))?'AUTHOR_IDENTITY_CONFLICT':null;
  const hits=find(workIndex,['ol:'+r.open_library_id,'title:'+identity(r.title,r.author.name),'title:'+identity(r.edition.title,r.author.name)]);
  const editions=find(editionIndex,['ol:'+r.edition.open_library_edition_id,'isbn:'+r.edition.isbn_13,r.edition.isbn_10&&'isbn:'+r.edition.isbn_10,'title:'+identity(r.edition.title,r.author.name)]);
  const aliases=find(aliasIndex,['title:'+identity(r.title,r.author.name),'title:'+identity(r.edition.title,r.author.name)]);
  const prior=state.ledger.find(e=>e.candidate_id===r.candidate_id);
  let kind='insert',work_id=null;
  if(prior){
   if(!state.members?.some(m=>m.candidate_id===r.candidate_id&&m.work_id===prior.work_id))fail('PERSISTED_MEMBERSHIP_DRIFT');
   const w=state.works.find(w=>w.id===prior.work_id),e=state.editions.find(e=>e.id===prior.evidence?.ownership?.edition?.id);
   const recordedAuthor=state.authors.find(a=>a.id===w?.author_id);
   if(prior.record_hash!==digest(r)||prior.evidence?.batch_hash!==batchHash||!w||!e||digest(w)!==prior.evidence.ownership.work.hash||digest(e)!==prior.evidence.ownership.edition.hash||digest(recordedAuthor)!==prior.evidence.ownership.author.hash)fail('PERSISTED_BATCH_DRIFT');
   kind='unchanged';work_id=w.id;
  }else if(hits.length||editions.length||aliases.length){kind='conflict';reason='EXISTING_WORK_EDITION_ISBN_OR_ALIAS';}
  if(reason){kind='conflict';}
  if(kind==='insert'&&!author)newAuthors.add(r.author.open_library_id);
  actions.push({candidate_id:r.candidate_id,record_hash:digest(r),kind,work_id,author_id:author?.id??null,reason});
 }
 const counts={new_works:actions.filter(a=>a.kind==='insert').length,new_authors:newAuthors.size,reused_authors:new Set(actions.filter(a=>a.kind==='insert'&&a.author_id!==null).map(a=>a.author_id)).size,author_reuse_references:actions.filter(a=>a.kind==='insert'&&a.author_id!==null).length,new_editions:actions.filter(a=>a.kind==='insert').length,unchanged:actions.filter(a=>a.kind==='unchanged').length,conflicts:actions.filter(a=>a.kind==='conflict').length,skips:0,collection_memberships:0,category_links:0,selection_members:actions.filter(a=>a.kind==='insert').length};
 if(input.schema===LARGE_BATCH_SCHEMA||input.schema===EXPANSION_BATCH_SCHEMA){counts.new_selections=counts.new_works?1:0;counts.ownership_records=counts.new_works;}
 return {schema:'lumiscore-additive-plan-1',batch_hash:batchHash,actions,counts};
}
