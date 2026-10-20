import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {selectStrictEdition} from '../lib/books/strict-edition.ts';
import {normalizeIsbn13,normalizeOpenLibraryId} from '../lib/books/covers.ts';
import {readSearchProjection} from '../lib/catalog/search-projection.ts';
import {searchWindow} from '../lib/catalog/search-window.ts';
import {searchQuery} from '../lib/catalog/editorial-query.ts';

test('read-only SQL projection: JS edition parity, full counting, relevance, RLS and bounded page hydration', {timeout:120000}, async()=>{
 const db=new PGlite();await db.waitReady;
 try{
  await db.exec(`create role anon;create role authenticated;
   create table public.authors(id bigint primary key,name text);
   create table public.works(id bigint primary key,title text,first_publish_year int,author_id bigint);
   create table public.editions(id bigint primary key,work_id bigint,title text,language text,isbn_13 text,open_library_edition_id text);
   create table public.catalog_selection_members(work_id bigint,selection_slug text);
   create table public.work_catalog_categories(work_id bigint,category_id text);
   create table public.catalog_categories(id text);
   create table public.catalog_work_title_aliases(work_id bigint,title text);
   create function public.get_work_rating_summaries(bigint[]) returns table(work_id bigint,lumiscore numeric,rating_count bigint)
   language sql stable security invoker as $$select x, null::numeric,null::bigint from unnest($1) x$$;
   grant select on all tables in schema public to anon,authenticated;
   alter table public.works enable row level security;
   create policy public_visible on public.works for select to anon,authenticated using(id<>999);
   insert into public.authors values(1,'Synthetic Author'),(2,'Frank Herbert');
   insert into public.catalog_categories values('fiction_fantasy');`);
  const old=await readFile(new URL('../supabase/migrations/20261006173806_public_rating_privacy_b.sql',import.meta.url),'utf8');
  await db.exec(old.slice(old.indexOf('create or replace function public.catalog_discovery_page('),old.indexOf('create or replace function public.get_collaborative')));
  const sql=await readFile(new URL('../supabase/operations/pr45-public-search-selection.sql',import.meta.url),'utf8');
  assert.doesNotMatch(sql,/security definer|\b(?:insert|update|delete|truncate)\s+(?:into|from|public\.)/i);
  await db.exec(sql);
  const forms=['Book','Book hardcover','Book paperback','Book ebook','Book library binding','Book audiobook','Book summary','Book large-print',
    'Café','Cafe\u0301 paperback','ＡＢＣ','éaudiobook','Book movie tie-in','Book box set','Book adaptation','Book Tandem Library',
    '日本語 Paperback','İstanbul','Straße','\u00a0 Book\t','Book school and library binding'];
  const langs=['nld','eng','deu','English',' /languages/eng ','nl',' DUT ','he','',null];
  const works=[],editions=[];let eid=1;
  for(let i=1;i<=300;i++){
   const title=i===299?'Dune':i===300?'Dune Messiah':'Synthetic Book '+String(i).padStart(3,'0');
   works.push({id:i,title,author:i>=299?'Frank Herbert':'Synthetic Author'});
   await db.query('insert into public.works values($1,$2,$3,$4)',[i,title,1900+i%120,i>=299?2:1]);
   const count=i<=30?8:2;
   for(let j=0;j<count;j++){
    const e={id:eid++,work_id:i,title:i<=30?forms[(i+j)%forms.length]:title,language:i<=30?langs[(i+j)%langs.length]:j?'eng':'nld',
      isbn_13:j%2?(i%7===0?'invalid':'9781234567897'):null,
      open_library_edition_id:j%3?(i%5===0?'/books/ol'+(10000+eid)+'m':'OL'+(10000+eid)+'M'):null};
    editions.push(e);await db.query('insert into public.editions values($1,$2,$3,$4,$5,$6)',Object.values(e));
   }
   if(i%2)await db.query('insert into public.work_catalog_categories values($1,$2)',[i,'fiction_fantasy']);
   if(i%3===0)await db.query('insert into public.catalog_selection_members values($1,$2)',[i,'lumiscore-selectie-1000']);
  }
  await db.exec(`insert into public.works values(999,'Synthetic hidden',2020,1);insert into public.editions values(99999,999,'Synthetic hidden','eng',null,null);`);
  works.push({id:999,title:'Synthetic hidden',author:'Synthetic Author'});
  editions.push({id:99999,work_id:999,title:'Synthetic hidden',language:'eng',isbn_13:null,open_library_edition_id:null});
  const snapshot=async()=>JSON.stringify((await db.query('select (select jsonb_agg(w order by id) from public.works w) as works,(select jsonb_agg(e order by id) from public.editions e) as editions')).rows);
  const before=await snapshot();
  for(const locale of ['nl','en'])for(const params of [{q:'Synthetic'},{q:'Dune'},{q:'Synthetic',category:'fiction_fantasy'},
    {q:'Synthetic',selection:'lumiscore-selectie-1000'},{q:'Synthetic',sort:'newest'},{q:'Synthetic',sort:'highest'},{q:'xx-nothing'}]){
   const state=searchQuery(params),languages=state.languages.length?state.languages:locale==='en'?['en']:['nl','en'];
   const args=[state.query,locale,state.categories,state.selection,languages,state.sort,[],null];
   const body=(await db.query('select public.catalog_search_selection_v1($1,$2,$3,$4,$5,$6,$7,$8) as data',args)).rows[0].data;
   // Old RPC order is the authoritative pre-relevance order, not local fixture insertion.
   const first=(await db.query('select public.catalog_discovery_page($1,$2,$3,$4,$5,1,128,$6,$7) as data',
     [state.query,state.categories,state.selection,languages,state.sort,[],null])).rows[0].data;
   let ids=[...first.workIds];for(let p=2;p<=Math.ceil(first.total/128);p++)ids.push(...(await db.query('select public.catalog_discovery_page($1,$2,$3,$4,$5,$6,128,$7,$8) as data',
     [state.query,state.categories,state.selection,languages,state.sort,p,[],null])).rows[0].data.workIds);
   // Same normalization as books.ts strictEditions, not raw database rows.
   const normalized=editions.map(e=>({...e,id:String(e.id),title:e.title?.trim()||null,language:e.language?.trim()||null,
     isbn_13:normalizeIsbn13(e.isbn_13),open_library_edition_id:normalizeOpenLibraryId(e.open_library_edition_id?.trim(),'edition')}));
   const expected=ids.flatMap(id=>{const w=works.find(w=>w.id===id),e=w&&selectStrictEdition(normalized.filter(e=>e.work_id===id),locale,w.title);return e?[{workId:String(id),editionId:String(e.id),title:e.title.trim(),author:w.author}]:[]});
   assert.deepEqual(body.candidates.map(({workId,editionId,title,author})=>({workId,editionId,title,author})),expected,'SQL/JS chosen identity '+JSON.stringify({locale,params}));
   const selection=readSearchProjection(body,state.query),page1=searchWindow(selection.books,state,selection.aliases),page2=searchWindow(selection.books,{...state,page:2},selection.aliases);
   assert.equal(page1.total,expected.length);assert.ok(page1.books.length<=16);
   if(page1.total>16)assert.ok(page2.books.every(b=>!page1.books.some(a=>a.workId===b.workId)));
   if(params.q==='Dune')assert.equal(page1.books[0].title,'Dune');
  }
  for(const role of ['anon','authenticated']){
   await db.exec('set role '+role);
   const out=(await db.query("select public.catalog_search_selection_v1('Synthetic','en','{}','','{en}') as data")).rows[0].data;
   assert.ok(!out.candidates.some(r=>r.workId==='999'),'SECURITY INVOKER respects existing RLS');
   await assert.rejects(()=>db.query("delete from public.works where false"),/permission/);
   await db.exec('reset role');
  }
  await assert.rejects(()=>db.query("select public.catalog_search_selection_v1('Synthetic','de')"),/Invalid public search/);
  assert.equal(await snapshot(),before,'read-only calls retain every local fixture row');
 }finally{await db.close();}
});
