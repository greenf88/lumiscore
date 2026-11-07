import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{PGlite}from'@electric-sql/pglite';
const dir=new URL('../catalog/even-simpel-20261107/',import.meta.url),read=n=>JSON.parse(fs.readFileSync(new URL(n,dir))),sql=n=>fs.readFileSync(new URL(n,dir),'utf8'),uid='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002';
export async function fixture(env){const db=new PGlite();await db.exec(`create role anon;create role service_role;create role authenticated;create schema auth;create schema taste_private;grant usage on schema taste_private to authenticated;
create function auth.uid()returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table authors(id bigint primary key,name text);create table works(id bigint primary key,title text,author_id bigint references authors,work_type text,open_library_id text,native_identity_key text);
create table editions(id bigint primary key,work_id bigint references works,title text,language text,isbn_13 text);
create table catalog_categories(id text primary key);create table work_catalog_categories(work_id bigint references works,category_id text references catalog_categories);
create table work_trait_evidence(work_id bigint references works,trait text,source text,source_key text,weight numeric,confidence numeric,raw_labels text[],mapping_version text,verified_at timestamptz,updated_at timestamptz);
create table catalog_edition_metadata(edition_id bigint primary key,work_id bigint,bound_author_id bigint,bound_title text,bound_isbn13 text,bound_language text,review_status text,format text);
create table catalog_work_title_aliases(work_id bigint references works,title text);
create table ratings(user_id uuid,work_id bigint references works,rating int,primary key(user_id,work_id));create table user_book_status(user_id uuid,work_id bigint references works,status text);
create table taste_rating_rounds(id uuid primary key default gen_random_uuid(),user_id uuid,round_number int,language text,goal int default 20,completed_at timestamptz${env==='test'?',revisit_prior_skips boolean default false':''});
create table taste_rating_offers(user_id uuid,round_id uuid references taste_rating_rounds,work_id bigint references works,decision text default 'offered',score int,decided_at timestamptz,primary key(user_id,${env==='test'?'round_id,':''}work_id));
create unique index one_pending on taste_rating_offers(round_id)where decision='offered';
insert into authors values(1,'Synthetic author'),(763,'Yotam Ottolenghi'),(2,'Jamie Oliver');insert into catalog_categories values('nonfiction_cooking_food'),('fiction_literary_general'),('nonfiction_biography_memoir');`);
for(const [id,title,author,category,lang]of[[1,'Synthetic fiction',1,'fiction_literary_general','nld'],[2,'Synthetic memoir',2,'nonfiction_biography_memoir','eng'],[3,'Cooking up a mystery',763,'fiction_literary_general','eng'],[4,'Synthetic unknown',1,null,'nld'],[5,'Synthetic recipes',1,'nonfiction_cooking_food','nld'],[6,'Synthetic second fiction',1,'fiction_literary_general','nld']]){
await db.query("insert into works values($1,$2,$3,null,null,$4)",[id,title,author,'fixture:'+id]);await db.query('insert into editions values($1,$1,$2,$3,null)',[id,title,lang]);if(category)await db.query('insert into work_catalog_categories values($1,$2)',[id,category]);}
const cases=read('taste-classification-cases.json').rows.filter(r=>[1442,1533,1462].includes(r.id));for(const r of cases){const author=r.id===1442?763:2;await db.query("insert into works values($1,$2,$3,null,$4,null)",[r.id,r.title,author,'source:'+r.id]);for(const t of r.traits??[])await db.query('insert into work_trait_evidence(work_id,trait,source,weight,confidence,raw_labels,mapping_version)values($1,$2,$3,$4,$5,$6,$7)',[r.id,t.trait,t.source,t.weight,t.confidence,t.raw_labels,t.mapping_version]);}
await db.exec("insert into editions values(10434,1442,'Simpel','nld','9789464042818'),(1506,1442,'Ottolenghi simple','eng','9781607749165'),(1641,1533,'5 ingrediënten','dut','9789021566665'),(1530,1462,'Jamie in 30 minuten',null,'9789021549248')");
const p=read('test-preview-receipt.json').rows;const w=p.find(x=>x.relation==='works').after_row,e=p.find(x=>x.relation==='editions').after_row;await db.query('insert into works values($1,$2,763,null,null,$3)',[w.id,w.title,w.native_identity_key]);await db.query('insert into editions values($1,$2,$3,$4,$5)',[e.id,w.id,e.title,e.language,e.isbn_13]);await db.query("insert into work_catalog_categories values($1,'nonfiction_cooking_food')",[w.id]);await db.query("insert into catalog_edition_metadata values($1,$2,763,$3,$4,'nld','approved','hardcover')",[e.id,w.id,e.title,e.isbn_13]);
await db.exec("update works set title='Separate original fiction title' where id=6;insert into catalog_work_title_aliases values(6,'Alias six')");
await db.exec('alter table works add column cover_id bigint');const baseline=read('taste-'+env+'-before.json');if(env==='test')await db.exec(`create table taste_private.eligible_inventory_v1(work_id bigint,language text);insert into taste_private.eligible_inventory_v1 values(1,'nl'),(6,'nl'),(2,'en'),(3,'en'),(990710001,'nl');create function taste_private.inventory_current_v1(w bigint,l text)returns boolean language sql stable as $$select exists(select 1 from taste_private.eligible_inventory_v1 where work_id=w and language=l)$$;`);
await db.exec('set check_function_bodies=off');for(const f of baseline.functions.filter(f=>!['inventory_snapshot_v1','inventory_current_v1','cover_lookahead','taste_rating_cover_lookahead'].includes(f.name)))await db.exec(f.definition);await db.exec('set check_function_bodies=on');
await db.query("select set_config('request.jwt.claim.sub',$1,false)",[uid]);return db;}
const state=async db=>(await db.query('select public.taste_rating_state() data')).rows[0].data;
const action=async(db,a,round=null,w=null,rating=null,lang='nl',goal=10)=>(await db.query('select public.taste_rating_advance_v2($1,$2,$3,$4,$5,$6) data',[a,round,w,rating,lang,goal])).rows[0].data;
for(const env of['production','test'])test(env+' real stored functions: selection/resume/extend/choose/rate and ordinary catalogue remain independent',async()=>{const db=await fixture(env);try{
 // Raw legacy routes would accept a cookbook by language; this is not a mocked selector.
 const before=(await db.query('select count(*)::int n from ratings')).rows[0].n;await db.exec(sql('taste-install.sql'));await db.exec(sql('taste-install.sql'));
 const allowed=async(w,l)=>(await db.query('select public.taste_rating_allowed($1,$2) a',[w,l])).rows[0].a;
 for(const id of[1442,1533,1462,990710001,4,5])for(const l of['nl','en'])assert.equal(await allowed(id,l),false,[env,id,l].join(':'));
 assert.equal(await allowed(1,'nl'),true);assert.equal(await allowed(2,'en'),true);assert.equal(await allowed(3,'en'),true);assert.equal(await allowed(2,'nl'),false);
 let s=await action(db,'start');assert.equal(s.currentWorkId,'1');const round=s.round.id;
 for(const q of ['Separate original fiction title','Alias six'])assert.equal(String((await db.query('select * from public.taste_rating_candidates($1,$2)',[q,'nl'])).rows[0]?.work_id),'6','original title and alias survive eligibility filtering');
 const candidates=await db.query("select * from public.taste_rating_candidates('simpel','nl')");assert.equal(candidates.rows.length,0);
 await assert.rejects(action(db,'choose',round,990710001),/eligible/);assert.equal((await state(db)).currentWorkId,'1');
 // A saved legacy cookbook offer must disappear on GET without a write.
 await db.exec("update taste_rating_offers set decision='skipped' where work_id=1");await db.query("insert into taste_rating_offers(user_id,round_id,work_id)values($1,$2,990710001)",[uid,round]);
 const saved=(await db.query('select * from taste_rating_offers order by work_id')).rows;const masked=await state(db);assert.equal(masked.currentWorkId,null);assert.equal(masked.round.ratedCount,0);assert.deepEqual((await db.query('select * from taste_rating_offers order by work_id')).rows,saved);
 await assert.rejects(action(db,'rate',round,990710001,8),/eligible/);assert.equal((await db.query('select count(*)::int n from ratings')).rows[0].n,before);
 s=await action(db,'resume',round);assert.equal(s.currentWorkId,'6');assert.equal((await db.query('select decision from taste_rating_offers where work_id=990710001')).rows[0].decision,'skipped');assert.equal(s.round.goal,10);assert.equal(s.round.ratedCount,0);
 await db.query('insert into ratings values($1,990710001,8)',[uid]);assert.equal((await db.query('select rating from ratings where work_id=990710001')).rows[0].rating,8,'ordinary cookbook rating works');
 await db.query("select set_config('request.jwt.claim.sub',$1,false)",[other]);s=await action(db,'start',null,null,null,'en');assert(['2','3'].includes(s.currentWorkId));const enround=s.round.id;
 s=await action(db,'rate',enround,Number(s.currentWorkId),9,'en');assert(['2','3'].includes(s.currentWorkId));s=await action(db,'extend',enround,null,null,'en',15);assert.equal(s.round.goal,15);
 assert.equal((await db.query('select count(*)::int n from public.taste_rating_candidates(\'Synthetic\',\'en\')')).rows[0].n,0,'current/rated excluded');
 assert.equal((await db.query("select count(*)::int n from works w join editions e on e.work_id=w.id where e.isbn_13='9789464044263'")).rows[0].n,1);
}finally{await db.close();}});
test('authenticated RPC reads private approval through a bounded reader without inventory grants',async()=>{const db=await fixture('test');try{
 await db.exec(sql('taste-install.sql'));await db.exec('grant usage on schema auth to authenticated;grant select on all tables in schema public to authenticated;set role authenticated');
 assert.equal((await db.query("select has_table_privilege('authenticated','taste_private.eligible_inventory_v1','select') a")).rows[0].a,false);
 assert.equal((await db.query("select public.taste_rating_allowed(1,'nl') a")).rows[0].a,true);
 assert.equal((await db.query("select public.taste_rating_allowed(990710001,'nl') a")).rows[0].a,false);
 const s=await action(db,'start');assert.equal(s.currentWorkId,'1');assert.equal((await state(db)).currentWorkId,'1');
 await db.query("select set_config('request.jwt.claim.sub','',false)");assert.equal((await db.query("select public.taste_rating_allowed(1,'nl') a")).rows[0].a,false);
}finally{await db.close();}});
test('guard filters precede unchanged selection ordering; personal ranking code remains outside this patch',()=>{
 for(const env of['production','test']){const before=read('taste-'+env+'-before.json').functions.find(f=>f.name===(env==='production'?'advance_round_v2':'advance_round_v3')).definition;
 const after=sql('taste-'+env+'-install.sql');const order=/    order by[\s\S]*?limit 1/.exec(before)?.[0];assert(order);assert(after.includes(order));}
});
test('specific non-cooking categories outrank loose provider cooking subjects; explicit reviewed cooking still excludes',async()=>{const db=await fixture('production');try{
 await db.exec(sql('taste-install.sql'));await db.exec("insert into work_trait_evidence(work_id,trait,source,weight,confidence,raw_labels,mapping_version)values(2,'nonfiction','open_library',1,.85,array['Quick and easy cooking'],'taste_traits_v1')");
 const allowed=async()=>(await db.query("select public.taste_rating_allowed(2,'en') a")).rows[0].a;assert.equal(await allowed(),true,'specific memoir category, not author/title, controls presentation');
 await db.exec("update work_trait_evidence set source='manual' where work_id=2");assert.equal(await allowed(),false,'reviewed cooking conflict is not auto-approved');
 await db.exec("update work_trait_evidence set source='open_library' where work_id=2;insert into work_catalog_categories values(2,'nonfiction_cooking_food')");assert.equal(await allowed(),false,'explicit cookbook category wins');
}finally{await db.close();}});
for(const env of['production','test'])test(env+' committed function rollback preserves all existing round rows and ratings',async()=>{const db=await fixture(env);try{
 await db.exec(sql('taste-install.sql'));const s=await action(db,'start');await action(db,'rate',s.round.id,1,8);
 const snapshot=async()=>{const data={};for(const t of['works','editions','ratings','user_book_status','taste_rating_rounds','taste_rating_offers'])data[t]=(await db.query(`select to_jsonb(t) r from ${t} t order by to_jsonb(t)::text`)).rows;return data;};const before=await snapshot();
 await db.exec(sql('taste-'+env+'-restore.sql'));assert.deepEqual(await snapshot(),before);assert.equal((await db.query("select to_regprocedure('taste_private.content_eligible_v1(bigint,text)') r")).rows[0].r,null);
 await db.exec(sql('taste-install.sql'));assert.deepEqual(await snapshot(),before);
 await db.exec("create or replace function public.taste_rating_allowed(p_work_id bigint,p_language text)returns boolean language sql stable as $$select false$$");
 await assert.rejects(db.exec(sql('taste-'+env+'-restore.sql')),/Later helper/);await db.exec('rollback');assert.deepEqual(await snapshot(),before);
}finally{await db.close();}});
