import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {PGlite} from '@electric-sql/pglite';
import {createClient} from '@supabase/supabase-js';
import {loadReaderRows} from '../lib/supabase/reader-rows.ts';

const a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
async function fixture() {
  const db=new PGlite();
  await db.exec(`create role reader_test nologin;
    create table ratings(user_id uuid,work_id bigint,rating integer,primary key(user_id,work_id));
    create table user_book_status(user_id uuid,work_id bigint,status text,primary key(user_id,work_id));
    insert into ratings select '${a}',n,8 from generate_series(1,1205)n;
    insert into ratings select '${b}',n,3 from generate_series(1,3)n;
    insert into user_book_status select user_id,work_id,'read' from ratings;
    alter table ratings enable row level security; alter table ratings force row level security;
    alter table user_book_status enable row level security; alter table user_book_status force row level security;
    create policy own_rows on ratings to reader_test using(user_id=current_setting('request.jwt.claim.sub')::uuid);
    create policy own_rows on user_book_status to reader_test using(user_id=current_setting('request.jwt.claim.sub')::uuid);
    grant select on ratings,user_book_status to reader_test;
    set role reader_test; set request.jwt.claim.sub='${a}';`);
  const queries=[]; let failPage=false;
  const client=createClient('http://synthetic.invalid','synthetic-client-key',{
    auth:{persistSession:false,autoRefreshToken:false},global:{fetch:async input=>{
      const url=new URL(String(input)),table=url.pathname.split('/').at(-1);
      assert.ok(['ratings','user_book_status'].includes(table));
      const owner=url.searchParams.get('user_id'); assert.match(owner,/^eq\.[0-9a-f-]{36}$/);
      const offset=Number(url.searchParams.get('offset')??0),limit=Math.min(1000,Number(url.searchParams.get('limit')??1000));
      queries.push({table,owner:owner.slice(3),offset,order:url.searchParams.get('order')});
      if(failPage && offset===1000) return new Response('{"message":"synthetic page failure"}',{status:503,headers:{'Content-Type':'application/json'}});
      const columns=table==='ratings'?'work_id,rating':'work_id,status';
      const result=await db.query(`select ${columns} from ${table} where user_id=$1 order by work_id limit $2 offset $3`,[owner.slice(3),limit,offset]);
      return new Response(JSON.stringify(result.rows),{headers:{'Content-Type':'application/json'}});
    }}});
  return {db,client,queries,fail:()=>{failPage=true;}};
}

test('real PostgreSQL owner RLS and 1000-row API cap: complete ratings/statuses, fresh updates and no cross-user cache',async()=>{
  const f=await fixture();
  try {
    // Reproduce the old unpaged request before checking the actual fix.
    assert.equal((await f.client.from('ratings').select('work_id,rating').eq('user_id',a)).data.length,1000);
    f.queries.length=0;
    for(const table of ['ratings','user_book_status']) {
      const rows=await loadReaderRows(f.client,table,table==='ratings'?'work_id,rating':'work_id,status',a);
      assert.equal(rows.length,1205);assert.equal(new Set(rows.map(x=>x.work_id)).size,1205);
      assert.equal(rows.at(-1).work_id,1205);
    }
    assert.ok(f.queries.every(x=>x.owner===a && x.order==='work_id.asc'));
    await f.db.exec(`reset role;update ratings set rating=1 where user_id='${a}' and work_id=1205;set role reader_test;`);
    assert.equal((await loadReaderRows(f.client,'ratings','work_id,rating',a)).at(-1).rating,1);
    await f.db.exec(`set request.jwt.claim.sub='${b}';`);
    const own=await loadReaderRows(f.client,'ratings','work_id,rating',b);
    assert.equal(own.length,3);assert.ok(own.every(x=>x.rating===3));
    assert.deepEqual(await loadReaderRows(f.client,'ratings','work_id,rating',a),[],'RLS denies a forged other-owner filter');
  } finally {await f.db.close();}
});
test('failure on a private continuation page rejects the entire result, not a partial successful profile',async()=>{
  const f=await fixture();
  try {f.fail();await assert.rejects(loadReaderRows(f.client,'ratings','work_id,rating',a));}
  finally {await f.db.close();}
});
test('homepage consumes the owner pager and displays an unavailable state instead of a fabricated empty profile',async()=>{
  const server=await readFile(new URL('../lib/supabase/taste-test.ts',import.meta.url),'utf8');
  assert.match(server,/loadReaderRows<RatingRow>\(client, 'ratings'/);
  assert.match(server,/loadReaderRows<StatusRow>\(client, 'user_book_status'/);
  assert.match(server,/if \(responsesResult.error\) throw responsesResult.error/);
  assert.match(server,/return \{ unavailable:true/);
  const ui=await readFile(new URL('../app/components/LumiScoreHome.tsx',import.meta.url),'utf8');
  assert.match(ui,/if \(personalization.unavailable\) return/);
  assert.match(ui,/This is not an empty profile/);
  for(const route of ['app/page.tsx','app/recommendations/page.tsx']) {
    const page=await readFile(new URL('../'+route,import.meta.url),'utf8');
    assert.match(page,/\.catch\(\(\): HomepagePersonalization => \(\{\s*unavailable:\s*true/);
  }
});
