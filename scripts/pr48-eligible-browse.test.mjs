import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { selectStrictEdition } from '../lib/books/strict-edition.ts';
import { browseQuery } from '../lib/catalog/editorial-query.ts';
import { readEligibleBrowsePage, eligibleBrowseArgs, alignEligibleBrowseBooks } from '../lib/catalog/eligible-browse.ts';

test('eligible Browse: pre-page language/filter selection, full16, stable ties, bounded10k, RLS and fresh scores', {timeout:120000}, async () => {
  const db = new PGlite(); await db.waitReady;
  try {
    await db.exec(`create role anon; create role authenticated;
      create table authors(id bigint primary key,name text);
      create table works(id bigint primary key,title text,first_publish_year int,author_id bigint);
      create table editions(id bigint primary key,work_id bigint,title text,language text);
      create index editions_work_idx on editions(work_id);
      create table catalog_work_title_aliases(work_id bigint,title text);
      create table catalog_selection_members(work_id bigint,selection_slug text);
      create table work_catalog_categories(work_id bigint,category_id text);
      create table catalog_categories(id text);
      -- Clearly synthetic aggregate fixture, never installed on a hosted project.
      create table synthetic_public_scores(work_id bigint primary key,lumiscore numeric);
      create function get_work_rating_summaries(bigint[]) returns table(work_id bigint,lumiscore numeric,rating_count bigint)
      language sql stable security invoker as $$select x,s.lumiscore,null::bigint from unnest($1) x left join public.synthetic_public_scores s on s.work_id=x$$;
      insert into authors values(1,'Synthetic Author'),(2,'Another Synthetic Author');
      insert into catalog_categories values('fiction_fantasy'),('fiction_general');
      insert into works select i,'Synthetic Book '||lpad(i::text,5,'0'),2000+i%20,1 from generate_series(1,10020) i;
      insert into editions select i,i,'Synthetic Book '||lpad(i::text,5,'0'),case when i%4=0 then 'deu' when i%4=1 then 'nld' when i%4=2 then 'eng' else null end from generate_series(1,10020) i;
      insert into editions values(20001,1,'Synthetic First English','eng'),(20002,2,'Synthetic audiobook','nld');
      insert into synthetic_public_scores values(3,10),(1,9.8),(2,9.6),(6,9.6),(10,9.0);
      insert into catalog_selection_members select i,'lumiscore-selectie-1000' from generate_series(1,70) i where i%2=0;
      insert into work_catalog_categories select i,'fiction_fantasy' from generate_series(1,80) i where i%3=0;
      insert into catalog_work_title_aliases values(1,'Synthetic translated alias');
      alter table works enable row level security;
      create policy visible on works for select to anon,authenticated using(id<>10);
      grant select on all tables in schema public to anon,authenticated;`);
    const sql = await readFile(new URL('../supabase/operations/pr48-eligible-browse.sql',import.meta.url),'utf8');
    assert.doesNotMatch(sql,/security definer|\b(?:insert|update|delete|truncate)\s+(?:into|from|public\.)/i);
    await db.exec(sql);
    const read = async (locale='en', params={}) => {
      const state=browseQuery(params),a=eligibleBrowseArgs(state,locale);
      const data=(await db.query('select catalog_browse_page_v2($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) as data',
        [a.p_locale,a.p_query,a.p_categories,a.p_selection,a.p_languages,a.p_sort,a.p_page,a.p_page_size,a.p_alias_ids,a.p_author_id])).rows[0].data;
      return {...readEligibleBrowsePage(data,state,locale),data};
    };
    const editions=(await db.query('select * from editions order by id')).rows;
    for(const locale of ['nl','en']) {
      const eligible=[];
      for(let id=1;id<=10020;id++)if(selectStrictEdition(editions.filter(e=>Number(e.work_id)===id),locale,'Synthetic Book '+String(id).padStart(5,'0')))eligible.push(String(id));
      const seen=[],times=[];
      for(let page=1;page<=3;page++) {
        const start=performance.now(),out=await read(locale,{page:String(page)});times.push(Math.round(performance.now()-start));
        assert.equal(out.total,eligible.length);assert.equal(out.ids.length,16);
        assert.ok(out.ids.every(id=>eligible.includes(id)));seen.push(...out.ids);
        assert.ok(JSON.stringify(out.data).length<3000,'RPC transports only bounded page identity + counts, not all matching Works/editions');
      }
      assert.equal(new Set(seen).size,48,'three consecutive full pages, no duplicate Works');
      assert.equal(seen[0],'1','ineligible score10 does not consume first result slot');
      assert.deepEqual(seen.slice(1,3),['2','6'],'same score uses stable title/id tie break');
      assert.deepEqual((await read(locale)).ids,seen.slice(0,16),'repeat order stable');
      const last=await read(locale,{page:'999999999999'});assert.equal(last.page,last.pageCount);
      assert.equal(last.ids.length,last.total%16||16);
      console.info(JSON.stringify({test:'PR48 local10020 synthetic Works',locale,eligible:eligible.length,returned:16,requests:times,unit:'ms',hosted:false}));
    }
    assert.equal((await read('en',{q:'translated alias'})).total,1);
    assert.equal((await read('en',{q:'never-matches'})).total,0);
    assert.equal((await read('en',{language:'nl'})).total,0,'EN cannot admit Dutch-only filter editions');
    assert.equal((await read('nl',{language:'nl'})).total,2505,'audio-named NL edition does not satisfy language filter');
    for(const params of [{category:'fiction_fantasy'},{selection:'lumiscore-selectie-1000'},{category:'fiction_fantasy',selection:'lumiscore-selectie-1000'},
      {author:'2'},{sort:'az'},{sort:'newest'},{pageSize:'32'},{pageSize:'64'},{pageSize:'128'}]) {
      const a=await read('en',params),b=await read('en',{...params,page:'2'});
      assert.equal(a.total,b.total);assert.equal(a.ids.length,Math.min(a.total,Number(params.pageSize??16)));
      if(a.pageCount>1)assert.ok(b.ids.every(id=>!a.ids.includes(id)));
    }
    const en=(await read('en')).ids,nl=(await read('nl')).ids;
    assert.notDeepEqual(en,nl);assert.deepEqual((await read('en')).ids,en,'EN NL EN is not a cross-locale cache');
    await db.exec('update synthetic_public_scores set lumiscore=10 where work_id=10');
    assert.equal((await read('en')).ids[0],'10','no public rank score cache freezes a changed aggregate');
    for(const role of ['anon','authenticated']) {
      await db.exec('set role '+role);
      assert.ok(!(await read('en')).ids.includes('10'),'invoker respects existing RLS');
      await assert.rejects(()=>db.exec('delete from works where false'),/permission/);
      await db.exec('reset role');
    }
    const malformed={contract:'eligible-browse-v2',locale:'en',pageSize:16,total:100,page:1,pageCount:7,workIds:Array.from({length:15},(_,i)=>i+1)};
    assert.throws(()=>readEligibleBrowsePage(malformed,browseQuery({}),'en'),/Invalid/);
    assert.throws(()=>alignEligibleBrowseBooks(['1','2'],[{workId:'1'}]),/changed/);
    assert.equal((await db.query('select count(*)::int n from works')).rows[0].n,10020);
  } finally {await db.close();}
});
