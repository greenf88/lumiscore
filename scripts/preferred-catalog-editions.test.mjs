import assert from 'node:assert/strict';import test from 'node:test';import {readFileSync} from 'node:fs';import {PGlite} from '@electric-sql/pglite';
import {selectStrictEdition} from '../lib/books/strict-edition.ts';
const before=readFileSync(new URL('../catalog/remaining-covers-20261117/search-function-before.sql',import.meta.url),'utf8');
const migration=readFileSync(new URL('../supabase/migrations/20261117214303_preferred_catalog_editions.sql',import.meta.url),'utf8');
async function fixture(){const db=new PGlite();await db.exec(`
create table authors(id bigint primary key,name text);insert into authors values(1,'An Author');
create table works(id bigint primary key,title text,author_id bigint references authors,first_publish_year integer);insert into works values(1,'A story',1,2000),(2,'Another story',1,2001);
create table editions(id bigint primary key,work_id bigint references works,title text,language text,isbn_13 text,open_library_edition_id text);
insert into editions values(1,1,'A story','eng','9780307389732','OL100M'),(2,1,'Een verhaal','nld','9789029090483','OL200M'),(3,1,'A story','eng','9780143132042','OL900M'),(4,1,'Een verhaal','nld','9789025441265','OL901M');
create table catalog_work_title_aliases(work_id bigint,title text);create table catalog_selection_members(work_id bigint,selection_slug text);create table work_catalog_categories(work_id bigint,category_id text);
create function get_work_rating_summaries(bigint[]) returns table(work_id bigint,lumiscore numeric) language sql as 'select null::bigint,null::numeric where false';
`+before);return db;}
const sqlChoice=async(db,locale)=>(await db.query("select catalog_search_selection_v2('story',$1) result",[locale])).rows[0].result.candidates[0]?.editionId;
test('reviewed alternatives select the same exact edition in SQL and JS without crossing locales',async()=>{const db=await fixture();try{
 const oldEn=await sqlChoice(db,'en'),oldNl=await sqlChoice(db,'nl');await db.exec(migration);assert.equal(await sqlChoice(db,'en'),oldEn);assert.equal(await sqlChoice(db,'nl'),oldNl);
 await db.exec('update editions set preferred_for_catalog=true where id=3');assert.equal(await sqlChoice(db,'en'),'3');assert.equal(await sqlChoice(db,'nl'),oldNl);
 await db.exec('update editions set preferred_for_catalog=true where id=4');for(const locale of ['nl','en']){const rows=(await db.query('select * from editions')).rows;assert.equal(String(selectStrictEdition(rows,locale,'A story').id),await sqlChoice(db,locale));assert.equal(String(selectStrictEdition(rows.toReversed(),locale,'A story').id),await sqlChoice(db,locale));}
 await assert.rejects(db.exec('update editions set preferred_for_catalog=true where id=1'),/unique constraint/);
 await db.exec('update editions set preferred_for_catalog=false');assert.equal(await sqlChoice(db,'en'),oldEn);assert.equal(await sqlChoice(db,'nl'),oldNl);
}finally{await db.close();}});
test('preferred flag cannot authorize unknown or cross-language editions or suspicious titles',async()=>{const db=await fixture();try{await db.exec(migration);
 for(const [id,title,language,isbn,olid]of [[20,'A story',null,null,null],[21,'A story','eng','invalid',null],[22,'A story','eng,fre','9780307389732',null],[23,'','eng','9780307389732',null]])await assert.rejects(db.query('insert into editions values($1,2,$2,$3,$4,$5,true)',[id,title,language,isbn,olid]),/check constraint/);
 const rows=(await db.query('select * from editions')).rows;const extra={id:88,work_id:1,title:'Study guide A story',language:'eng',isbn_13:'9780307389732',open_library_edition_id:'OL888M',preferred_for_catalog:true};
 await db.query('insert into editions values(88,1,$1,$2,$3,$4,true)',[extra.title,extra.language,extra.isbn_13,extra.open_library_edition_id]);assert.equal(await sqlChoice(db,'en'),'1');assert.equal(selectStrictEdition([...rows,extra],'en','A story').id,1);
 assert.equal(selectStrictEdition([{...extra,title:'A story',language:'fra'}],'en','A story'),null);
 assert.equal(selectStrictEdition([{...extra,title:'A story',language:'eng'}],'nl','A story'),null);
}finally{await db.close();}});

