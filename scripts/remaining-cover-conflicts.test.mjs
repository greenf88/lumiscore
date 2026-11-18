import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {selectStrictEdition,withStrictEdition} from '../lib/books/strict-edition.ts';
import {applyStoredPresentation,safePublicCoverUrl} from '../lib/books/stored-presentation.ts';
const dir=new URL('../catalog/remaining-covers-20261118/',import.meta.url),read=n=>readFileSync(new URL(n,dir),'utf8');
const b=JSON.parse(read('baseline.json')),covers=JSON.parse(read('proposal.json')),changes=JSON.parse(read('corrections.json'));
const sql=read('production.sql'),commit=sql.replace(/rollback;\s*$/i,'commit;'),rollback=read('rollback.sql').replace(/rollback;\s*$/i,'commit;');
const text=path=>readFileSync(new URL(path,import.meta.url),'utf8');
async function fixture(){
 const db=new PGlite();
 await db.exec(`create table authors(id bigint generated always as identity primary key,name text,open_library_id text);
 create table works(id bigint primary key,title text,author_id bigint references authors,open_library_id text,first_publish_year int);
 create table editions(id bigint generated always as identity primary key,work_id bigint references works,open_library_edition_id text unique,isbn_10 text,isbn_13 text,language text,publisher text,created_at timestamptz default now(),title text);
 create table catalog_work_title_aliases(work_id bigint,title text);create table catalog_selection_members(work_id bigint,selection_slug text);create table work_catalog_categories(work_id bigint,category_id text);
 create function get_work_rating_summaries(bigint[]) returns table(work_id bigint,lumiscore numeric) language sql as 'select null::bigint,null::numeric where false';
 create table ratings(work_id bigint,rating int);insert into ratings values(5237,9),(5274,8);
 create table user_book_status(work_id bigint,status text);insert into user_book_status values(6751,'want_to_read');
 create table collection_books(work_id bigint,sequence_number int);insert into collection_books values(5730,1);`);
 const schema=text('../supabase/migrations/20261030063949_nl_pilot_reviewed_presentation.sql');
 await db.exec(schema.slice(schema.indexOf('create table if not exists public.catalog_edition_metadata'),schema.indexOf('create index if not exists catalog_edition_metadata_work_idx')));
 for(const w of b.works){await db.query('insert into authors(id,name,open_library_id) overriding system value values($1,$2,$3) on conflict do nothing',[w.author_id,w.authorName,w.authorOlid]);await db.query('insert into works values($1,$2,$3,$4,null)',[w.id,w.title,w.author_id,w.open_library_id]);}
 for(const e of b.editions)await db.query('insert into editions(id,work_id,open_library_edition_id,isbn_10,isbn_13,language,publisher,created_at,title) overriding system value values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[e.id,e.work_id,e.open_library_edition_id,e.isbn_10,e.isbn_13,e.language,e.publisher,e.created_at,e.title]);
 await db.exec('alter table editions alter column id restart with 13000;alter table authors alter column id restart with 11000;'+text('../catalog/remaining-covers-20261117/search-function-before.sql')+';'+text('../supabase/migrations/20261117214303_preferred_catalog_editions.sql')+text('../supabase/migrations/20261118065437_preferred_dutch_language_alias.sql'));
 for(const e of b.editions)if(e.preferred_for_catalog)await db.query('update editions set preferred_for_catalog=true where id=$1',[e.id]);
 await db.query('insert into catalog_edition_metadata select * from jsonb_populate_recordset(null::catalog_edition_metadata,$1::jsonb)',[JSON.stringify(b.metadata)]);
 return db;
}
async function state(db,names=['works','authors','editions','catalog_edition_metadata','ratings','user_book_status','collection_books']){const s={};for(const n of names)s[n]=(await db.query('select to_jsonb(t) row from '+n+' t order by 1::text')).rows.map(x=>x.row).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));return s;}
test('review dry run, exact NL/EN selection and stored covers, safe rollback preserve user data',async()=>{
 const db=await fixture();try{
  const initial=await state(db);await db.exec(sql);assert.deepEqual(await state(db),initial);
  const receipt=(await db.exec(commit)).flatMap(x=>x.rows??[]);assert.equal(receipt.length,covers.length);
  assert.deepEqual(await state(db,['ratings','user_book_status','collection_books']),Object.fromEntries(['ratings','user_book_status','collection_books'].map(k=>[k,initial[k]])));
  for(const r of covers){
   const w=(await db.query('select w.*,a.name from works w join authors a on a.id=w.author_id where w.id=$1',[r.workId])).rows[0];
   const editions=(await db.query('select * from editions where work_id=$1',[r.workId])).rows;
   const e=selectStrictEdition(editions,r.locale,w.title);assert.ok(e,r.key);assert.equal(e.isbn_13,r.isbn13,r.key);assert.equal(e.title,r.title,r.key);
   assert.equal(selectStrictEdition(editions.toReversed(),r.locale,w.title).id,e.id);
   const search=(await db.query('select catalog_search_selection_v2($1,$2,p_alias_ids=>$3::bigint[]) result',[r.title.slice(0,80),r.locale,[r.workId]])).rows[0].result;
   assert.equal(search.candidates.find(c=>c.workId===String(r.workId)).editionId,String(e.id),r.key);
   const book=withStrictEdition({id:'work-'+r.workId,workId:String(r.workId),title:w.title,author:w.name,authorId:String(w.author_id),cover:'orbit'},e,r.locale);
   const reviews=(await db.query('select * from catalog_edition_metadata where edition_id=$1',[e.id])).rows;
   assert.deepEqual(applyStoredPresentation([book],r.locale,[],reviews)[0].coverUrls,[r.coverUrl],r.key);
   for(const change of [{authorId:'9999999'},{isbn13:'9780142410349'},{editionLanguage:'fra'},{editionTitle:'Another volume'}])assert.notDeepEqual(applyStoredPresentation([{...book,...change}],r.locale,[],reviews)[0].coverUrls,[r.coverUrl],r.key);
  }
  for(const r of changes.filter(c=>c.language)){
   const editions=(await db.query('select * from editions where work_id=$1',[r.workId])).rows;
   const old=b.editions.find(e=>e.id===r.editionId),locale=['dut','nld','nl'].includes(old.language)?'nl':'en';
   assert.notEqual(selectStrictEdition(editions,locale)?.id,r.editionId,'wrong-language edition must leave its old locale');
  }
  await db.exec(rollback);
  const restored=await state(db);delete restored.authors;delete initial.authors;assert.deepEqual(restored,initial);
 }finally{await db.close();}
});
test('concurrent edits, shared-author renames and cross-Work ISBN conflicts abort atomically',async()=>{
 const newEdition=covers.find(r=>r.newEdition),other=b.works.find(w=>w.id!==newEdition.workId);
 for(const mutation of [
  db=>db.query('update editions set title=$1 where id=$2',['Concurrent correction',b.editions[0].id]),
  db=>db.query('insert into works values(999999,$1,2704,null,null)',['Another Bert book']),
  db=>db.query('insert into editions(work_id,title,language,isbn_13) values($1,$2,$3,$4)',[other.id,'Conflicting ISBN','eng',newEdition.isbn13])
 ]){const db=await fixture();try{await mutation(db);const before=await state(db);await assert.rejects(db.exec(commit),/drift|conflict|Shared author/);await db.exec('rollback');assert.deepEqual(await state(db),before);}finally{await db.close();}}
});
test('rollback refuses a newer review and repeat apply cannot overwrite an existing correction',async()=>{
 const db=await fixture();try{await db.exec(commit);const before=await state(db);await assert.rejects(db.exec(commit),/drift|conflict/);await db.exec('rollback');assert.deepEqual(await state(db),before);
  await db.query("update catalog_edition_metadata set cover_url='https://example.com/newer-cover.jpg' where edition_id=$1",[covers.find(r=>r.editionId).editionId]);const newer=await state(db);await assert.rejects(db.exec(rollback),/drift/);await db.exec('rollback');assert.deepEqual(await state(db),newer);
 }finally{await db.close();}
});
test('every jacket has a checked public image, edition ISBN and visual evidence',()=>{
 assert.equal(covers.length,130);assert.equal(new Set(covers.map(r=>r.key)).size,covers.length);
 for(const r of covers){assert.equal([...r.isbn13].reduce((s,d,i)=>s+Number(d)*(i%2?3:1),0)%10,0,r.key);assert.ok(safePublicCoverUrl(r.coverUrl),r.key);assert.ok(r.visualReviewed&&r.image.valid);assert.equal(r.image.url,r.coverUrl);assert.ok(r.image.width>=90&&r.image.height>=90);assert.match(r.image.sha256,/^[a-f0-9]{64}$/);assert.match(r.evidenceUrl,/^https:\/\//);assert.ok((r.locale==='nl'?['nl','nld','dut']:['en','eng']).includes(r.language));}
 assert.match(sql,/rollback;\s*$/);assert.doesNotMatch(sql,/update public\.(ratings|user_book_status|collection_books)|delete from/i);
});
