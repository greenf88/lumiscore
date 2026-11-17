import test from 'node:test';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {fixture} from '../test-support/product-metrics/local-fixture.mjs';
import {productionInstaller} from '../test-support/product-metrics/production-package.mjs';
import {leesroutesPatch} from '../test-support/product-metrics/leesroutes-package.mjs';
import {discoveryPatch} from '../test-support/product-metrics/discovery-package.mjs';
import {readFile} from 'node:fs/promises';
for(const target of ['production','test'])test(`discovery ${target}: privacy, allowed dimensions, deduplication, canonical transition guards and rollback`,async()=>{
 const db=new PGlite();try{
  await db.exec(fixture);
  const schema=target==='production'?'product_metrics':'product_metrics_test',suffix=target==='production'?'':'_test',project=target==='production'?'qvplwejffhjvxaypmjut':'hlvujbrmfdlrfxdjwsmb';
  if(target==='production'){await db.exec('drop schema discovery_test_private cascade');await db.exec(`set lumiscore.metrics.release_target='${project}'`);await db.exec(await productionInstaller());}
  else await db.exec(await readFile(new URL('../test-support/product-metrics/install.sql',import.meta.url),'utf8'));
  await db.exec(`set lumiscore.metrics.release_target='${project}'`);await db.exec(await leesroutesPatch(false,target));
  const query=`select n.nspname,p.proname,p.prosrc,p.proconfig,p.prosecdef,p.proacl::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='${schema}' or (n.nspname='public' and p.proname like '%product%') order by 1,2`;
  const baseline=(await db.query(query)).rows;
  await db.exec(discoveryPatch(false,target));
  const after=(await db.query(query)).rows;
  assert.deepEqual(after.map(x=>({...x,prosrc:undefined})),baseline.map(x=>({...x,prosrc:undefined})));
  const context={locale:'nl',surface:'taste_result',source:'direct_unknown',medium:'unknown',campaign:'none',traffic:target==='production'?'production':'synthetic',device:'mobile'};
  const emit=(event,properties=context,id=crypto.randomUUID())=>db.query(`select public.record_product_event${suffix}_v1($1,$2,$3) result`,[id,event,properties]);
  assert.equal((await emit('search_results')).rows[0].result,'consent_denied');
  const token=(await db.query(`select public.product_analysis_consent${suffix}_v3('accept') g`)).rows[0].g.token;
  await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-lumiscore-analysis-grant':token})]);
  for(const event of ['search_started','search_results','search_empty','search_failed','guest_round_started','guest_round_completed','guest_suggestions_empty','guest_suggestions_failed'])assert.equal((await emit(event)).rows[0].result,'counted');
  for(const event of ['guest_book_saved','guest_save_failed','search_book_opened'])assert.equal((await emit(event,{...context,work_id:8})).rows[0].result,'counted');
  const id=crypto.randomUUID();assert.equal((await emit('search_results',context,id)).rows[0].result,'counted');assert.equal((await emit('search_results',context,id)).rows[0].result,'duplicate');
  for(const extra of [{query:'PRIVATE'},{answers:[9,8]},{device:'private-phone-name'},{device:null},{url:'https://private.invalid'}])assert.equal((await emit('search_results',{...context,...extra})).rows[0].result,'invalid_payload');
  await assert.rejects(()=>emit('want_to_read_saved',{...context,work_id:8}),/browser event required/);
  const rows=(await db.query(`select event,dimensions,n from ${schema}.daily_counters`)).rows;assert.doesNotMatch(JSON.stringify(rows),/PRIVATE|answers|query|url/);
  await db.query(`select public.product_analysis_consent${suffix}_v3('revoke',$1)`,[token]);assert.equal((await emit('guest_round_completed')).rows[0].result,'consent_denied');
  await db.exec(discoveryPatch(true,target));assert.deepEqual((await db.query(query)).rows,baseline);
 }finally{await db.close();}
});
