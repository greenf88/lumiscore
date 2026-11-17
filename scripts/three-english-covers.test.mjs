import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {selectStrictEdition,withStrictEdition} from '../lib/books/strict-edition.ts';
import {applyStoredPresentation} from '../lib/books/stored-presentation.ts';
const dir=new URL('../catalog/three-english-covers-20261117/',import.meta.url);
const read=name=>readFileSync(new URL(name,dir),'utf8');
const before=JSON.parse(read('baseline.json'));
const proposal=JSON.parse(read('proposal.json'));
const sql=read('production.sql');
const commit=sql.replace(/rollback;\s*$/i,'commit;');
async function fixture(){
 const db=new PGlite();
 await db.exec(`create table authors(id bigint primary key,name text);
 create table works(id bigint primary key,title text,author_id bigint references authors,open_library_id text,first_publish_year int);
 create table editions(id bigint generated always as identity primary key,work_id bigint references works,open_library_edition_id text unique,isbn_10 text,isbn_13 text,language text,publisher text,created_at timestamptz default now(),title text);
 create table catalog_edition_metadata(edition_id bigint primary key references editions,work_id bigint references works,bound_author_id bigint references authors,bound_title text,bound_language text,bound_isbn13 text,format text,cover_url text,card_cover_url text,evidence_url text,evidence jsonb,review_status text,reviewed_at timestamptz,review_batch text);
 create table catalog_work_title_aliases(work_id bigint,title text);
 create table catalog_selection_members(work_id bigint,selection_slug text);
 create table work_catalog_categories(work_id bigint,category_id text);
 create function get_work_rating_summaries(bigint[]) returns table(work_id bigint,lumiscore numeric) language sql as 'select null::bigint,null::numeric where false';
 create table ratings(work_id bigint,rating int);insert into ratings values(68,9);
 create table user_book_status(work_id bigint,status text);insert into user_book_status values(376,'want_to_read');
 create table collection_books(work_id bigint,sequence_number int);insert into collection_books values(596,1);`);
 for(const w of before.works){
  await db.query('insert into authors values($1,$2)',[w.author_id,w.author]);
  await db.query('insert into works values($1,$2,$3,$4,$5)',[w.id,w.title,w.author_id,w.open_library_id,w.first_publish_year]);
  for(const e of w.editions)await db.query('insert into editions(id,work_id,open_library_edition_id,isbn_10,isbn_13,language,publisher,created_at,title) overriding system value values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[e.id,e.work_id,e.open_library_edition_id,e.isbn_10,e.isbn_13,e.language,e.publisher,e.created_at,e.title]);
 }
 for(const m of before.metadata??[])await db.query('insert into catalog_edition_metadata select * from jsonb_populate_record(null::catalog_edition_metadata,$1::jsonb)',[JSON.stringify(m)]);
 await db.exec('alter table editions alter column id restart with 11245;'+read('search-function-baseline.sql'));
 return db;
}
async function preserved(db){const state={};for(const name of ['works','authors','ratings','user_book_status','collection_books'])state[name]=(await db.query('select * from '+name+' order by 1')).rows;return state;}

test('three publisher editions: dry run, commit and repeat preserve old records and align SQL/JS NL/EN selection',async()=>{
 const db=await fixture();try{
  const originals=(await db.query('select to_jsonb(e) row from editions e order by id')).rows;
  const unchanged=await preserved(db);
  const dry=(await db.exec(sql)).flatMap(r=>r.rows??[]);assert.equal(dry.length,3);
  assert.deepEqual((await db.query('select to_jsonb(e) row from editions e order by id')).rows,originals);
  const receipt=(await db.exec(commit)).flatMap(r=>r.rows??[]);assert.equal(receipt.length,3);
  assert.deepEqual(await preserved(db),unchanged);
  for(const old of originals)assert.deepEqual((await db.query('select to_jsonb(e) row from editions e where id=$1',[old.row.id])).rows[0],old);
  for(const r of proposal.changes){
   const editions=(await db.query('select * from editions where work_id=$1',[r.workId])).rows;
   const en=selectStrictEdition(editions,'en',r.workTitle);
   assert.equal(en.isbn_13,r.isbn13);assert.equal(en.language,'eng');
   assert.equal(selectStrictEdition([...editions].reverse(),'en',r.workTitle).id,en.id);
   const projected=(await db.query('select catalog_search_selection_v2($1,$2) result',[r.title,'en'])).rows[0].result;
   assert.equal(projected.candidates.find(x=>x.workId===String(r.workId)).editionId,String(en.id));
   const nl=selectStrictEdition(editions,'nl',r.workTitle);
   assert.equal(nl?.isbn_13,r.workId===68?'9789029090483':undefined);
   const book=withStrictEdition({id:'work-'+r.workId,workId:String(r.workId),title:r.workTitle,author:r.author,authorId:String(r.authorId),openLibraryWorkId:r.workOlid,cover:'orbit'},en,'en');
   const metadata=(await db.query('select * from catalog_edition_metadata where edition_id=$1',[en.id])).rows;
   const rendered=applyStoredPresentation([book],'en',[],metadata)[0];
   assert.deepEqual(rendered.coverUrls,[r.cover]);assert.equal(rendered.isbn13,r.isbn13);
   assert.deepEqual(applyStoredPresentation([{...book,isbn13:r.oldEnglish.isbn_13}],'en',[],metadata)[0].coverUrls,[]);
  }
  assert.equal((await db.exec(commit)).flatMap(r=>r.rows??[]).length,0);
 }finally{await db.close();}
});

test('conflicting ISBN or changed baseline aborts all three additions atomically',async()=>{
 for(const mutation of ["update works set title='Another Work' where id=376","insert into editions(work_id,title,language,isbn_13) values(596,'Wrong edition','eng','9780307389732')"]){
  const db=await fixture();try{await db.exec(mutation);const state=(await db.query('select to_jsonb(e) row from editions e order by id')).rows;
   await assert.rejects(db.exec(commit),/identity drift|ISBN conflict/);await db.exec('rollback');
   assert.deepEqual((await db.query('select to_jsonb(e) row from editions e order by id')).rows,state);
  }finally{await db.close();}
 }
});

test('publisher evidence and independent language/Work/author proof bind the exact three jackets',()=>{
 assert.equal(proposal.changes.length,3);
 for(const r of proposal.changes){
  const source=JSON.parse(read('sources/'+r.workId+'-isbn.json'));
  assert.ok(source.isbn_13.includes(r.isbn13));assert.equal(source.languages[0].key,'/languages/eng');
  assert.ok(source.works.some(w=>w.key==='/works/'+r.workOlid));
  assert.equal([...r.isbn13].reduce((sum,n,i)=>sum+Number(n)*(i%2?3:1),0)%10,0);
  assert.ok(r.cover.includes(r.isbn13));assert.ok(r.evidence.every(e=>/^[a-f0-9]{64}$/.test(e.sha256)));
 }
 assert.match(sql,/rollback;\s*$/);assert.doesNotMatch(sql,/update public\.|delete from public\.|setval\(/i);
});
