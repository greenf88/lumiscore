import {digest,planBatch,LARGE_BATCH_SCHEMA} from './catalog-batch-core.mjs';
export async function readBatchState(tx,slug){
 const query=async sql=>(await tx.query(sql)).rows;
 return {authors:await query('select * from public.authors order by id'),works:await query('select * from public.works order by id'),editions:await query('select * from public.editions order by id'),aliases:await query('select * from public.catalog_work_title_aliases order by work_id,title'),ledger:(await tx.query('select * from catalog_private.editorial_records where selection_slug=$1 order by candidate_id',[slug])).rows,members:(await tx.query('select * from public.catalog_selection_members where selection_slug=$1 order by candidate_id',[slug])).rows};
}
const locked='public.authors,public.works,public.editions,public.catalog_selections,public.catalog_selection_members,public.catalog_work_title_aliases,catalog_private.editorial_records';
export async function executeBatch(db,input,{apply=false,confirmation,expected,local=false,afterInsert}={}){
 if(typeof apply!=='boolean'||apply&&confirmation!=='APPLY '+input.slug)throw Error('EXPLICIT_WRITE_CONFIRMATION_REQUIRED');
 if(apply&&!expected)throw Error('REVIEWED_PLAN_REQUIRED');
 return db.transaction(async tx=>{
  if(apply)await tx.exec('lock table '+locked+' in share row exclusive mode');
  const state=await readBatchState(tx,input.slug);
  if(input.schema===LARGE_BATCH_SCHEMA)state.selection=(await tx.query('select * from public.catalog_selections where slug=$1',[input.slug])).rows;
  const plan=planBatch(input,state,{local}),size=input.required_new_works;
  if(plan.counts.conflicts)throw Error('IDENTITY_CONFLICT_REQUIRES_REVIEW');
  if(apply&&digest(plan)!==digest(expected))throw Error('CATALOG_DRIFT_REQUIRES_NEW_PLAN');
  if(plan.counts.new_works!==size&&plan.counts.unchanged!==size)throw Error('EXACT_NET_NEW_'+size+'_REQUIRED');
  if(!apply||plan.counts.unchanged===size)return {...plan,applied:false,writes:0};
  const selection=(await tx.query('select * from public.catalog_selections where slug=$1',[input.slug])).rows;
  if(selection.length)throw Error('UNOWNED_SELECTION_COLLISION');
  await tx.query('insert into public.catalog_selections(slug,label_nl,label_en) values($1,$2,$3)',[input.slug,'Catalogusuitbreiding +'+size,'Catalog expansion +'+size]);
  const authors=new Map(state.authors.map(a=>[a.id,a]));
  const byCandidate=new Map(input.records.map(r=>[r.candidate_id,r]));
  const pendingAuthors=[...new Map(plan.actions.filter(a=>a.author_id===null).map(a=>{
   const author=byCandidate.get(a.candidate_id).author;return [author.open_library_id,author];
  })).values()];
  // Set-based, parameter-bound inserts keep the locked transaction to six write
  // round trips rather than 2,000+ requests. There is deliberately no UPSERT/update.
  const newAuthors=(await tx.query(`insert into public.authors(name,open_library_id)
   select name,open_library_id from jsonb_to_recordset($1::jsonb) as x(name text,open_library_id text) returning *`,[JSON.stringify(pendingAuthors)])).rows;
  const createdBySource=new Map(newAuthors.map(a=>[a.open_library_id,a]));
  const workRows=plan.actions.map(a=>{const r=byCandidate.get(a.candidate_id),author=authors.get(a.author_id)??createdBySource.get(r.author.open_library_id);return {title:r.title,author_id:author.id,open_library_id:r.open_library_id,first_publish_year:r.year};});
  const works=(await tx.query(`insert into public.works(title,author_id,open_library_id,first_publish_year)
   select title,author_id,open_library_id,first_publish_year from jsonb_to_recordset($1::jsonb) as x(title text,author_id bigint,open_library_id text,first_publish_year integer) returning *`,[JSON.stringify(workRows)])).rows;
  const bySource=new Map(works.map(w=>[w.open_library_id,w]));
  const editionRows=input.records.map(r=>({...r.edition,work_id:bySource.get(r.open_library_id).id}));
  const editions=(await tx.query(`insert into public.editions(work_id,title,open_library_edition_id,isbn_13,isbn_10,language,publisher)
   select work_id,title,open_library_edition_id,isbn_13,isbn_10,language,publisher from jsonb_to_recordset($1::jsonb)
   as x(work_id bigint,title text,open_library_edition_id text,isbn_13 text,isbn_10 text,language text,publisher text) returning *`,[JSON.stringify(editionRows)])).rows;
  const editionBySource=new Map(editions.map(e=>[e.open_library_edition_id,e]));
  const members=input.records.map(r=>({candidate_id:r.candidate_id,work_id:bySource.get(r.open_library_id).id}));
  await tx.query(`insert into public.catalog_selection_members(selection_slug,work_id,candidate_id)
   select $1,work_id,candidate_id from jsonb_to_recordset($2::jsonb) as x(work_id bigint,candidate_id text)`,[input.slug,JSON.stringify(members)]);
  const ownedAuthors=new Set(),ledger=[],batchHash=digest(input);let completed=0;
  for(const r of input.records){
   const work=bySource.get(r.open_library_id),edition=editionBySource.get(r.edition.open_library_edition_id);
   const author=authors.get(work.author_id)??createdBySource.get(r.author.open_library_id);
   const createdAuthor=createdBySource.has(r.author.open_library_id)&&!ownedAuthors.has(author.id);ownedAuthors.add(author.id);
   const ownership={work:{id:work.id,hash:digest(work)},edition:{id:edition.id,hash:digest(edition)},author:{id:author.id,hash:digest(author),created:createdAuthor}};
   ledger.push({candidate_id:r.candidate_id,work_id:work.id,record_hash:digest(r),evidence:{batch_schema:input.schema,batch_hash:batchHash,identity:r.proof,categories:[],ownership}});
   if(afterInsert)await afterInsert(++completed);
  }
  // Existing private AI_EDITORIAL envelope; identity provenance, NOT a genre claim.
  await tx.query(`insert into catalog_private.editorial_records(selection_slug,candidate_id,work_id,record_hash,editorial_status,classifier,audience,work_form,evidence)
   select $1,candidate_id,work_id,record_hash,'ZEKER','AI_EDITORIAL',null,null,evidence from jsonb_to_recordset($2::jsonb)
   as x(candidate_id text,work_id bigint,record_hash text,evidence jsonb)`,[input.slug,JSON.stringify(ledger)]);
  return {...plan,applied:true,writes:1+newAuthors.length+size*4};
 });
}
const quote=v=>'"'+v.replaceAll('"','""')+'"';
export async function recoveryPlan(tx,input,{local=false}={}){
 const state=await readBatchState(tx,input.slug);
 if(input.schema===LARGE_BATCH_SCHEMA)state.selection=(await tx.query('select * from public.catalog_selections where slug=$1',[input.slug])).rows;
 planBatch(input,state,{local});
 if(state.ledger.length!==input.required_new_works)throw Error('RECOVERY_REQUIRES_COMPLETE_OWNED_BATCH');
 const references=(await tx.query(`select ns.nspname as schema,c.relname as name,a.attname as column
  from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace ns on ns.oid=c.relnamespace
  join pg_attribute a on a.attrelid=k.conrelid and a.attnum=k.conkey[1]
  where k.contype='f' and k.confrelid='public.works'::regclass and array_length(k.conkey,1)=1 order by 1,2,3`)).rows;
 const unsafe=(await tx.query("select count(*)::int as n from pg_constraint where contype='f' and confrelid='public.works'::regclass and array_length(conkey,1)<>1")).rows[0].n;
 if(unsafe)throw Error('UNSUPPORTED_RECOVERY_REFERENCE');
 const owned=new Set(['public.editions','public.catalog_selection_members','catalog_private.editorial_records']);
 const actions=[];
 for(const row of state.ledger){
  let retained=false;
  for(const ref of references){
   const relation=ref.schema+'.'+ref.name;
   if(owned.has(relation))continue;
   if((await tx.query('select exists(select 1 from '+quote(ref.schema)+'.'+quote(ref.name)+' where '+quote(ref.column)+'=$1) as found',[row.work_id])).rows[0].found)retained=true;
  }
  const otherEditions=state.editions.filter(e=>e.work_id===row.work_id&&e.id!==row.evidence.ownership.edition.id);
  const otherMembers=(await tx.query('select count(*)::int as n from public.catalog_selection_members where work_id=$1 and selection_slug<>$2',[row.work_id,input.slug])).rows[0].n;
  actions.push({candidate_id:row.candidate_id,work_id:row.work_id,edition_id:row.evidence.ownership.edition.id,retain_bibliography:retained||otherEditions.length>0||otherMembers>0,author:row.evidence.ownership.author});
 }
 return {schema:'lumiscore-targeted-recovery-1',batch_hash:digest(input),actions};
}
/** Local verification only. Production recovery requires separate reviewed authorization. */
export async function recoverLocalBatch(db,input,expected){
 if(!input.synthetic)throw Error('PRODUCTION_RECOVERY_NOT_AUTHORIZED');
 return db.transaction(async tx=>{
  // Also lock referencing relations so a concurrent new user reference cannot be cascaded away.
  const refs=(await tx.query("select distinct conrelid::regclass::text as relation from pg_constraint where contype='f' and confrelid in ('public.works'::regclass,'public.authors'::regclass)")).rows;
  await tx.exec('lock table '+[...new Set([...locked.split(','),...refs.map(r=>r.relation)])].sort().join(',')+' in share row exclusive mode');
  const plan=await recoveryPlan(tx,input,{local:true});if(digest(plan)!==digest(expected))throw Error('RECOVERY_DRIFT');
  for(const a of plan.actions){
   await tx.query('delete from catalog_private.editorial_records where selection_slug=$1 and candidate_id=$2',[input.slug,a.candidate_id]);
   await tx.query('delete from public.catalog_selection_members where selection_slug=$1 and candidate_id=$2',[input.slug,a.candidate_id]);
   if(!a.retain_bibliography){await tx.query('delete from public.editions where id=$1',[a.edition_id]);await tx.query('delete from public.works where id=$1',[a.work_id]);}
  }
  for(const a of plan.actions.filter(a=>a.author.created))await tx.query('delete from public.authors a where a.id=$1 and not exists(select 1 from public.works w where w.author_id=a.id)',[a.author.id]);
  await tx.query('delete from public.catalog_selections where slug=$1',[input.slug]);return plan;
 });
}
