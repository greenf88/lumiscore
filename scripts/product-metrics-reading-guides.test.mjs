import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {fixture} from '../test-support/product-metrics/local-fixture.mjs';
import {productionInstaller} from '../test-support/product-metrics/production-package.mjs';
import {leesroutesPatch} from '../test-support/product-metrics/leesroutes-package.mjs';
import {discoveryPatch} from '../test-support/product-metrics/discovery-package.mjs';
import {readingGuidesPatch} from '../test-support/product-metrics/reading-guides-package.mjs';
import {readFile} from 'node:fs/promises';

for(const target of ['production','test'])test(`reading guides ${target}: opt-in, bounded dimensions, idempotence, ACL preservation and committed rollback`,async()=>{
 for(const rollback of [false,true])assert.equal(await readFile(new URL('../supabase/operations/reading-guides-20261125/'+target+'-'+(rollback?'restore':'apply')+'.sql',import.meta.url),'utf8'),readingGuidesPatch(rollback,target));
 const db=new PGlite();try{
  await db.exec(fixture);
  const schema=target==='production'?'product_metrics':'product_metrics_test',suffix=target==='production'?'':'_test',project=target==='production'?'qvplwejffhjvxaypmjut':'hlvujbrmfdlrfxdjwsmb';
  if(target==='production'){await db.exec('drop schema discovery_test_private cascade');await db.exec(`set lumiscore.metrics.release_target='${project}'`);await db.exec(await productionInstaller());}
  else await db.exec(await readFile(new URL('../test-support/product-metrics/install.sql',import.meta.url),'utf8'));
  await db.exec(`set lumiscore.metrics.release_target='${project}'`);await db.exec(await leesroutesPatch(false,target));await db.exec(discoveryPatch(false,target));
  const query=`select n.nspname,p.proname,p.prosrc,p.proconfig,p.prosecdef,p.proacl::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='${schema}' or (n.nspname='public' and p.proname like '%product%') order by 1,2`;
  const baseline=(await db.query(query)).rows;
  await db.exec(readingGuidesPatch(false,target));await db.exec(readingGuidesPatch(false,target));
  const after=(await db.query(query)).rows;
  assert.deepEqual(after.map(x=>({...x,prosrc:undefined})),baseline.map(x=>({...x,prosrc:undefined})));
  const context={locale:'nl',surface:'home',source:'instagram',medium:'organic_social',campaign:'leesroutes_202611',traffic:target==='production'?'production':'synthetic'};
  const emit=(event,extra={},id=crypto.randomUUID())=>db.query(`select public.record_product_event${suffix}_v1($1,$2,$3) result`,[id,event,{...context,...extra}]);
  assert.equal((await emit('reading_guide_opened',{list_id:'suzanne-vermeer'})).rows[0].result,'consent_denied');
  const token=(await db.query(`select public.product_analysis_consent${suffix}_v3('accept') g`)).rows[0].g.token;
  await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-lumiscore-analysis-grant':token})]);
  for(const list_id of ['suzanne-vermeer','fantasy-om-mee-te-beginnen','na-project-hail-mary']){
   for(const event of ['reading_guide_opened','editorial_list_opened','book_card_opened'])assert.equal((await emit(event,{list_id,...(event==='book_card_opened'?{work_id:1}:{})})).rows[0].result,'counted');
  }
  const id=crypto.randomUUID();assert.equal((await emit('reading_guide_opened',{list_id:'suzanne-vermeer'},id)).rows[0].result,'counted');assert.equal((await emit('reading_guide_opened',{list_id:'suzanne-vermeer'},id)).rows[0].result,'duplicate');
  for(const extra of [{list_id:'PRIVATE'},{list_id:'suzanne-vermeer',url:'PRIVATE'},{list_id:'suzanne-vermeer',locale:'en'},{list_id:'suzanne-vermeer',campaign:'PRIVATE'},{list_id:'other'},{}])assert.equal((await emit('reading_guide_opened',extra)).rows[0].result,'invalid_payload');
  await assert.rejects(()=>emit('want_to_read_saved',{work_id:1}),/browser event required/);
  await db.query(`select public.product_analysis_consent${suffix}_v3('revoke',$1)`,[token]);assert.equal((await emit('reading_guide_opened',{list_id:'suzanne-vermeer'})).rows[0].result,'consent_denied');
  await db.exec(readingGuidesPatch(true,target));await db.exec(readingGuidesPatch(true,target));assert.deepEqual((await db.query(query)).rows,baseline);
 }finally{await db.close();}
});
