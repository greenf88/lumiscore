import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {selectStrictEdition,withStrictEdition} from '../lib/books/strict-edition.ts';
import {withCatalogCoverEvidence} from '../lib/books/catalog-cover-evidence.ts';
import {safePublicCoverUrl} from '../lib/books/stored-presentation.ts';
import {normalizeEditionLanguage} from '../lib/books/edition-ranking.ts';

const dir=new URL('../catalog/remaining-covers-20261117/',import.meta.url);
const read=name=>readFileSync(new URL(name,dir),'utf8');
const baseline=JSON.parse(read('baseline.json')),proposal=JSON.parse(read('proposal.json'));
const sql=read('production.sql'),commit=sql.replace(/rollback;\s*$/i,'commit;');
const migration=readFileSync(new URL('../supabase/migrations/20261117214303_preferred_catalog_editions.sql',import.meta.url),'utf8');
const dutchAliasMigration=readFileSync(new URL('../supabase/migrations/20261118065437_preferred_dutch_language_alias.sql',import.meta.url),'utf8');
async function fixture(){
 const db=new PGlite();
 await db.exec(`create table authors(id bigint primary key,name text);
 create table works(id bigint primary key,title text,author_id bigint references authors,open_library_id text,first_publish_year int);
 create table editions(id bigint generated always as identity primary key,work_id bigint references works,open_library_edition_id text unique,isbn_10 text,isbn_13 text,language text,publisher text,created_at timestamptz default now(),title text);
 create table catalog_work_title_aliases(work_id bigint,title text);
 create table catalog_selection_members(work_id bigint,selection_slug text);
 create table work_catalog_categories(work_id bigint,category_id text);
 create function get_work_rating_summaries(bigint[]) returns table(work_id bigint,lumiscore numeric) language sql as 'select null::bigint,null::numeric where false';
 create table ratings(work_id bigint,rating int);insert into ratings values(68,9);
 create table user_book_status(work_id bigint,status text);insert into user_book_status values(376,'want_to_read');
 create table collection_books(work_id bigint,sequence_number int);insert into collection_books values(596,1);`);
 for(const w of baseline.works){
  await db.query('insert into authors values($1,$2) on conflict do nothing',[w.author_id,w.authors.name]);
  await db.query('insert into works values($1,$2,$3,$4,null)',[w.id,w.title,w.author_id,w.open_library_id]);
 }
 for(const e of baseline.editions)await db.query('insert into editions(id,work_id,open_library_edition_id,isbn_10,isbn_13,language,publisher,created_at,title) overriding system value values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[e.id,e.work_id,e.open_library_edition_id,e.isbn_10,e.isbn_13,e.language,e.publisher,e.created_at,e.title]);
 await db.exec('alter table editions alter column id restart with 12000;'+read('search-function-before.sql')+';\n'+migration+dutchAliasMigration);
 return db;
}
async function preserved(db){const state={};for(const name of ['works','authors','ratings','user_book_status','collection_books'])state[name]=(await db.query('select * from '+name+' order by 1')).rows;return state;}
const editionState=async db=>(await db.query('select to_jsonb(e) row from editions e order by id')).rows;

test('recovery is atomic and idempotent and selects the same edition in SQL, JS and cover hydration',async()=>{
 const db=await fixture();try{
  const originals=await editionState(db),unchanged=await preserved(db);
  assert.equal((await db.exec(sql)).flatMap(r=>r.rows??[]).length,proposal.length);
  assert.deepEqual(await editionState(db),originals);
  const receipt=(await db.exec(commit)).flatMap(r=>r.rows??[]);assert.equal(receipt.length,proposal.length);
  assert.deepEqual(await preserved(db),unchanged);
  for(const old of originals){const now=(await db.query('select to_jsonb(e) row from editions e where id=$1',[old.row.id])).rows[0];assert.deepEqual({...now.row,preferred_for_catalog:false},old.row);}
  for(const r of proposal){
   const editions=(await db.query('select * from editions where work_id=$1',[r.workId])).rows;
   const chosen=selectStrictEdition(editions,r.locale,r.workTitle);
   assert.equal(chosen.isbn_13,r.isbn13);assert.equal(normalizeEditionLanguage(chosen.language),r.language);assert.equal(chosen.title,r.title);
   assert.equal(selectStrictEdition(editions.toReversed(),r.locale,r.workTitle).id,chosen.id);
   const result=(await db.query('select catalog_search_selection_v2($1,$2,p_alias_ids=>$3::bigint[]) result',[r.title.slice(0,80),r.locale,[r.workId]])).rows[0].result;
   assert.equal(result.candidates.find(c=>c.workId===String(r.workId)).editionId,String(chosen.id));
   const book=withStrictEdition({id:'work-'+r.workId,workId:String(r.workId),title:r.workTitle,author:r.author,authorId:String(r.authorId),openLibraryWorkId:r.workOlid,cover:'orbit'},chosen,r.locale);
   assert.deepEqual(withCatalogCoverEvidence([book])[0].coverUrls,[r.coverUrl]);
   // Do not weaken identity to use a different language or attach to an old ISBN.
   assert.deepEqual(withCatalogCoverEvidence([{...book,strictEditionLanguage:r.locale==='nl'?'en':'nl'}])[0].coverUrls,book.coverUrls);
   assert.deepEqual(withCatalogCoverEvidence([{...book,storedPresentationUnavailable:true}])[0].coverUrls,book.coverUrls);
  }
  const first=await editionState(db);const repeat=(await db.exec(commit)).flatMap(r=>r.rows??[]);
  assert.equal(repeat.length,proposal.length);assert.ok(repeat.every(r=>!r.inserted));assert.deepEqual(await editionState(db),first);
  await db.exec(read('rollback.sql').replace(/rollback;\s*$/i,'commit;'));
  for(const r of proposal){const rows=(await db.query('select * from editions where work_id=$1',[r.workId])).rows;assert.equal(selectStrictEdition(rows,r.locale,r.workTitle).id,r.oldEdition.id);}
 }finally{await db.close();}
});

test('changed source rows and conflicting identifiers abort the complete catalogue transaction',async()=>{
 const target=proposal.find(r=>r.isbn13),other=baseline.works.find(w=>w.id!==target.workId);
 for(const mutation of [async db=>db.query('update editions set title=$1 where id=$2',['Concurrent correction',target.oldEdition.id]),async db=>db.query('insert into editions(work_id,title,language,isbn_13) values($1,$2,$3,$4)',[other.id,'Conflicting ISBN',target.language,target.isbn13])]){
  const db=await fixture();try{await mutation(db);const state=await editionState(db);await assert.rejects(db.exec(commit),/drift|identifier conflict/);await db.exec('rollback');assert.deepEqual(await editionState(db),state);}finally{await db.close();}
 }
});

test('every proposed jacket has checked image bytes, bibliographic evidence and a same-language identity',()=>{
 assert.ok(proposal.length>200);assert.equal(new Set(proposal.map(r=>r.locale+':'+r.workId)).size,proposal.length);
 for(const r of proposal){
  assert.equal(r.language,r.locale==='nl'?'nld':'eng');assert.ok(r.isbn13||/^OL\d+M$/.test(r.openLibraryEditionId));
  if(r.isbn13){assert.match(r.isbn13,/^97[89]\d{10}$/);assert.equal([...r.isbn13].reduce((sum,d,i)=>sum+Number(d)*(i%2?3:1),0)%10,0);}
  assert.ok(safePublicCoverUrl(r.coverUrl));assert.ok(r.visualReviewed);assert.ok(r.image.valid);assert.ok(r.image.width>=90&&r.image.height>=120);assert.match(r.evidenceUrl,/^https:\/\//);
 }
 assert.match(sql,/rollback;\s*$/);assert.doesNotMatch(sql,/delete from|update public\.(works|authors|ratings|user_book_status)/i);
});

test('Dutch dut/nld preferences share one uniqueness boundary and cannot cross into English',async()=>{
 const db=await fixture();try{
  const r=proposal.find(r=>r.existingEdition?.language==='dut');assert.ok(r);
  await db.query('update editions set preferred_for_catalog=true where id=$1',[r.existingEdition.id]);
  await assert.rejects(db.query('insert into editions(work_id,title,language,isbn_13,preferred_for_catalog) values($1,$2,$3,$4,true)',[r.workId,r.title,'nld',r.isbn13]),/unique constraint/);
  const rows=(await db.query('select * from editions where work_id=$1',[r.workId])).rows;
  assert.equal(selectStrictEdition(rows,'nl',r.workTitle).id,r.existingEdition.id);
  assert.notEqual(selectStrictEdition(rows,'en',r.workTitle)?.id,r.existingEdition.id);
 }finally{await db.close();}
});

test('publisher jacket rejects identity drift instead of attaching an image by title alone',()=>{
 const r=proposal.find(r=>r.workId===7434),book={id:'work-'+r.workId,workId:String(r.workId),authorId:String(r.authorId),author:r.author,title:r.title,editionTitle:r.title,isbn13:r.isbn13,editionPublisher:r.publisher,editionLanguage:r.language,strictEditionLanguage:r.locale,editionAvailable:true,openLibraryWorkId:r.workOlid,openLibraryEditionId:r.openLibraryEditionId,coverUrls:[],cover:'orbit'};
 assert.deepEqual(withCatalogCoverEvidence([book])[0].coverUrls,[r.coverUrl]);
 for(const change of [{workId:'9999999'},{authorId:'9999999'},{author:'Another author'},{editionTitle:'Another book'},{isbn13:'9780142410349'},{editionPublisher:'Another publisher'},{openLibraryWorkId:'OL9999999W'},{openLibraryEditionId:'OL9999999M'}])assert.deepEqual(withCatalogCoverEvidence([{...book,...change}])[0].coverUrls,[]);
});
