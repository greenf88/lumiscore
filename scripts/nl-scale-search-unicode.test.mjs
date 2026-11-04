import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PGlite} from '@electric-sql/pglite';
import {normalizeCatalogSearchQuery} from '../lib/books/catalog-search.ts';
const root=new URL('../catalog/nl-scale-20261102/search-normalization/',import.meta.url);
const read=n=>fs.readFileSync(new URL(n,root),'utf8');
const signature='public.catalog_search_selection_v2(text,text,text[],text,text[],text,bigint[],bigint)';
async function fixture(){const db=new PGlite();await db.exec(`
 create role anon;create role authenticated;
 create table authors(id bigint primary key,name text);
 create table works(id bigint primary key,title text,first_publish_year int,author_id bigint);
 create table editions(id bigint primary key,work_id bigint,title text,language text,isbn_13 text,open_library_edition_id text);
 create table catalog_work_title_aliases(id bigint,work_id bigint,title text);
 create table catalog_selection_members(work_id bigint,selection_slug text);
 create table work_catalog_categories(work_id bigint,category_id text);
 create function get_work_rating_summaries(bigint[])returns table(work_id bigint,lumiscore numeric,rating_count bigint)
 language sql stable security invoker as $$select x,8.2::numeric,4::bigint from unnest($1)x$$;
 insert into authors values(1,'Synthetic Writer');
 create table synthetic_ratings(work_id bigint,score int);insert into synthetic_ratings values(1,9);
 create table synthetic_progress(work_id bigint,status text);insert into synthetic_progress values(1,'read');
 grant select on all tables in schema public to anon,authenticated;
 alter table works enable row level security;create policy visible on works for select to anon,authenticated using(id<>999);
 `);await db.exec(read('before-function.sql'));await db.exec(`revoke all on function ${signature} from public;grant execute on function ${signature} to anon,authenticated;`);
 const data=[
  [1,'Moi, Tituba, Sorcière…Noire de Salem','Tituba, de zwarte heks van Salem'],
  [2,'Die 13 ½ Leben des Ka\u0308pt’n Blauba\u0308r','De 13 ½ levens van kap’tein Blauwbeer'],
  [3,'El a\u0301rbol de la ciencia','De boom der kennis'],
  [4,'Heartstopper','Nick en Charlie worden verliefd…']
 ];
 for(const[id,title,dutch]of data){await db.query('insert into works values($1,$2,2000,1)',[id,title]);await db.query("insert into editions values($1,$2,$3,'dut','9781234567897',$4)",[id*10,id,dutch,'OL'+id+'M']);await db.query("insert into editions values($1,$2,$3,'eng','9781234567897',$4)",[id*10+1,id,title,'OL'+(id+100)+'M']);}
 for(let i=10;i<70;i++){await db.query('insert into works values($1,$2,2000,1)',[i,'Synthetic Book '+i]);await db.query("insert into editions values($1,$2,$3,'dut','9781234567897',$4)",[i*10,i,'Synthetic Boek '+i,'OL'+(i+1000)+'M']);}
 await db.exec("insert into works values(998,'Synthetic Unknown',2000,1),(999,'Synthetic Hidden',2000,1);insert into editions values(9980,998,'Synthetic Unknown',null,null,'OL9980M'),(9990,999,'Synthetic Hidden','dut',null,'OL9990M');");return{db,data};}
const search=async(db,q,locale='nl')=>(await db.query('select catalog_search_selection_v2($1,$2) data',[normalizeCatalogSearchQuery(q),locale])).rows[0].data.candidates;
const snapshot=async db=>(await db.query("select (select jsonb_agg(t order by id) from works t) works,(select jsonb_agg(t order by id) from editions t) editions,(select jsonb_agg(t) from synthetic_ratings t) ratings,(select jsonb_agg(t) from synthetic_progress t) progress")).rows[0];
test('actual RPC: NFKC query and stored titles match symmetrically, retaining terminal-ellipsis behaviour and exact editions',async()=>{const{db,data}=await fixture();try{
 const before=await snapshot(db);assert.equal((await search(db,data[0][1])).length,0);assert.equal((await search(db,data[1][2])).length,0);assert.equal((await search(db,data[2][1])).length,0);
 await db.exec(read('install.sql'));
 for(const[id,original,dutch]of data)for(const title of[original,dutch,original.normalize('NFKC'),dutch.normalize('NFKC')]){const rows=await search(db,title);assert.equal(rows.length,1,title);assert.equal(rows[0].workId,String(id));assert.equal(rows[0].editionId,String(id*10));assert.equal(rows[0].title,dutch);}
 assert.equal((await search(db,data[1][1],'en'))[0].editionId,'21');
 assert.deepEqual(await snapshot(db),before);
 await db.exec(read('install.sql'));await db.exec(read('rollback.sql'));assert.equal((await search(db,data[0][1])).length,0);assert.deepEqual(await snapshot(db),before);
 }finally{await db.close();}});
test('same RPC bounds, strict unknown-language exclusion, RLS and three unique stable pages; later function edits block rollback',async()=>{const{db}=await fixture();try{
 await db.exec(read('install.sql'));const rows=await search(db,'Synthetic');assert.equal(rows.length,65);assert(!rows.some(r=>r.workId==='998'));const pages=[0,16,32].map(n=>rows.slice(n,n+16).map(r=>r.workId));assert(pages.every(p=>p.length===16));assert.equal(new Set(pages.flat()).size,48);assert.deepEqual((await search(db,'Synthetic')).slice(0,48).map(r=>r.workId),pages.flat());
 await db.exec('set role anon');assert(!(await search(db,'Synthetic')).some(r=>r.workId==='999'));await db.exec('reset role');
 await assert.rejects(search(db,'Synthetic','de'),/Invalid public search/);await assert.rejects(db.query("select catalog_search_selection_v2($1,'nl')",['x'.repeat(101)]),/Invalid public search/);
 const changed=read('after-function.sql').replace('return result;','return result; -- Later reviewed edit');await db.exec(changed);await assert.rejects(db.exec(read('rollback.sql')),/Search function drift/);await db.exec('rollback');
 }finally{await db.close();}});
