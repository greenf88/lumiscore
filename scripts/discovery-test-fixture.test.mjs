import test from 'node:test';
import assert from 'node:assert/strict';
import { PGlite } from '@electric-sql/pglite';
import { assertLocalTarget, reviewedFixtureInputs, setupDiscoveryFixture } from './discovery-test-fixture.mjs';
import { loopbackContainerConfig } from './discovery-test-loopback.mjs';
import { assertReviewedArtifacts } from './discovery-test-fixture.mjs';
import { createHash } from 'node:crypto';
import { recommendBooks } from '../lib/recommendations/engine.ts';
import { buildTasteProfile } from '../lib/taste-test/profile.ts';
import { tasteVector } from '../lib/taste-test/traits.ts';
test('loopback confinement rejects other projects, worktrees, networks, images and ports; preserves volume config', () => {
  const name='supabase_db_lumiscore-pr8-discovery', workdir='C:\\isolated-test';
  const info={Name:'/'+name,Config:{Image:'public.ecr.aws/supabase/postgres:17',Labels:{'com.supabase.cli.project':'lumiscore-pr8-discovery','com.supabase.cli.workdir':workdir}},HostConfig:{Binds:['owned-volume:/data'],PortBindings:{'5432/tcp':[{HostIp:'0.0.0.0',HostPort:'55432'}]}},NetworkSettings:{Networks:{'lumiscore-pr8-discovery':{Aliases:[name]}}}};
  const result=loopbackContainerConfig(info,name,workdir);
  assert.deepEqual(result.HostConfig.PortBindings,{'5432/tcp':[{HostIp:'127.0.0.1',HostPort:'55432'}]});
  assert.deepEqual(result.HostConfig.Binds,info.HostConfig.Binds);
  assert.throws(()=>loopbackContainerConfig(info,name,'C:\\other-test'));
  assert.throws(()=>loopbackContainerConfig(info,'supabase_db_supabase-identity-validation',workdir));
  for(const mutate of [i=>i.Config.Labels['com.supabase.cli.project']='production',i=>i.Config.Image='unknown/postgres:17',i=>i.HostConfig.PortBindings['5432/tcp'][0].HostPort='54322',i=>i.NetworkSettings.Networks={other:{}}]) {
    const changed=structuredClone(info);mutate(changed);assert.throws(()=>loopbackContainerConfig(changed,name,workdir));
  }
});
test('local target guard rejects production, other stacks, paths, query options and mismatched key claims', () => {
  const sql='synthetic sql\n',hash=createHash('sha256').update(sql).digest('hex');
  assert.doesNotThrow(()=>assertReviewedArtifacts({fixture:sql},{fixture:hash}));
  assert.throws(()=>assertReviewedArtifacts({fixture:sql+'changed'},{fixture:hash}));
  assert.throws(()=>assertReviewedArtifacts({fixture:sql},{fixture:hash,extra:hash}));
  const key = role => 'local.'+Buffer.from(JSON.stringify({iss:'supabase-demo',role})).toString('base64url')+'.test';
  const good={API_URL:'http://127.0.0.1:55431',DB_URL:'postgresql://postgres:test@127.0.0.1:55432/postgres',ANON_KEY:key('anon'),SERVICE_ROLE_KEY:key('service_role')};
  assert.equal(assertLocalTarget(good),true);
  for (const override of [
    {API_URL:'https://qvplwejffhjvxaypmjut.supabase.co'},
    {DB_URL:'postgresql://postgres:test@db.qvplwejffhjvxaypmjut.supabase.co:5432/postgres'},
    {API_URL:'http://127.0.0.1:54321'}, {DB_URL:'postgresql://postgres:test@127.0.0.1:54322/postgres'},
    {API_URL:'http://127.0.0.1:55431/?target=other'}, {DB_URL:good.DB_URL+'?host=other'},
    {ANON_KEY:key('service_role')}, {SERVICE_ROLE_KEY:key('anon')},
  ]) assert.throws(()=>assertLocalTarget({...good,...override}));
});
test('complete hashed migration chain builds from empty synthetic schema, including collection preconditions', async () => {
  const inputs=await reviewedFixtureInputs(); assert.equal(inputs.files.length,14); assert.equal(inputs.categories.length,20);
  const db=new PGlite(); await db.waitReady;
  try {
    await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
      create schema auth; create table auth.users(id uuid primary key);
      create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
      grant usage on schema auth to anon,authenticated;
      grant execute on function auth.uid() to anon,authenticated;`);
    await setupDiscoveryFixture(db);
    const count=async table=>Number((await db.query(`select count(*) as n from public.${table}`)).rows[0].n);
    assert.equal(await count('works'),389); assert.equal(await count('editions'),608);
    assert.equal(await count('authors'),12); assert.equal(await count('catalog_categories'),20);
    assert.equal(await count('collections'),46); assert.equal(await count('ratings'),0);
    await assert.rejects(()=>setupDiscoveryFixture(db),/Fresh empty test schema required/);
    await db.exec('set role anon');
    const query=async page=>(await db.query("select public.catalog_discovery_page(p_query=>'Synthetic',p_author_id=>8800001,p_categories=>array['fiction_fantasy'],p_languages=>array['nl'],p_page=>$1) as data",[page])).rows[0].data;
    const pages=await Promise.all([query(1),query(2),query(3),query(4)]);
    assert.ok(pages.every(p=>p.total===100&&p.pageCount===4));
    assert.equal(new Set(pages.flatMap(p=>p.workIds)).size,100);
    assert.equal(pages[0].facets.nonfiction_cooking_food,0);
    const empty=(await db.query("select public.catalog_discovery_page(p_author_id=>8800001,p_categories=>array['nonfiction_cooking_food']) as data")).rows[0].data;
    assert.equal(empty.total,0);
    const rows=(await db.query('select w.id,w.title,a.name from public.works w join public.authors a on a.id=w.author_id order by w.id')).rows;
    const candidates=rows.map(w=>({book:{id:`work-${w.id}`,workId:String(w.id),title:w.title,author:w.name,source:'supabase',score:null,ratingsCount:0,match:null,cover:'orbit'},traits:tasteVector({fantasy:.9,worldbuilding:.9,accessible:.9,character_driven:.9}),metadataConfidence:.95,coverageLevel:'rich'}));
    const input={candidates,profile:buildTasteProfile({'fantasy-or-science-fiction':'left'},[]),ratedWorkIds:new Set()};
    const result=recommendBooks(input);assert.equal(result.length,20);assert.equal(new Set(result.map(x=>x.book.workId)).size,20);
    assert.equal(recommendBooks({...input,candidates:candidates.slice(0,5)}).length,5);
    assert.equal(recommendBooks({...input,candidates:[]}).length,0);
    // Service-only evidence/cover cache and round tables are not exposed to anonymous clients.
    await assert.rejects(()=>db.query('select * from public.taste_rating_rounds'),/permission denied/);
    await assert.rejects(()=>db.query('select * from public.work_cover_resolutions'),/permission denied/);
  } finally { await db.close(); }
});
