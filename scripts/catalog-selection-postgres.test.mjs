import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { connectionConfig, safeInteger, postgresAdapter } from './catalog-selection-postgres.mjs';
import { sha256, refuseLegacyRewrite } from './catalog-selection-inputs.mjs';
import { buildPlan } from './catalog-selection-core.mjs';
import { inputs } from './catalog-selection-local.mjs';
const target={schema:'lumiscore-catalog-target-2',environment:'local-test',dry_run:true,tls:false,
  connection:{form:'direct',host:'127.0.0.1',port:54322,database:'postgres',login_username:'postgres',project_ref:null},
  session:{database:'postgres',current_user:'postgres',session_user:'postgres',database_oid:'5',system_identifier:'123'}};
test('target guard rejects wrong endpoints, libpq overrides and unsafe integers',()=>{
  const config=connectionConfig('postgresql://postgres:synthetic@127.0.0.1:54322/postgres',target);
  assert.equal(config.ssl,false);assert.equal(config.types.getTypeParser(20)('1936'),1936);
  assert.throws(()=>safeInteger('9007199254740993'),/safe range/);
  for(const url of ['postgresql://postgres:x@other:54322/postgres','postgresql://postgres:x@127.0.0.1:54322/other','postgresql://postgres:x@127.0.0.1:54322/postgres?host=remote'])
    assert.throws(()=>connectionConfig(url,target));
  assert.throws(()=>connectionConfig('postgresql://postgres:x@db.example:5432/postgres',{...target,environment:'production'}),/TLS/);
  assert.throws(()=>connectionConfig('postgresql://postgres:x@127.0.0.1:54322/postgres',{...target,password:'never log'}),/unknown/);
});
function mock(actual=target.session){const calls=[];return {calls,query:async(sql,params)=>{calls.push({sql,params});return {rows:[actual]};}};}
test('dry-run uses read-only transaction and checks server identity before callback',async()=>{
  const client=mock();let called=false;
  await postgresAdapter(client,target).transaction(async()=>{called=true;});
  assert.ok(called);assert.match(client.calls[0].sql,/read only/);assert.equal(client.calls.at(-1).sql,'rollback');
  const wrong=mock({...target.session,system_identifier:'999'});
  await assert.rejects(()=>postgresAdapter(wrong,target,{apply:true}).transaction(async()=>assert.fail('writes forbidden')),/fingerprint/);
  assert.equal(wrong.calls.at(-1).sql,'rollback');
});
test('same-client commit on success, rollback on partial failure, bound query values',async()=>{
  const client=mock();
  await postgresAdapter(client,target,{apply:true}).transaction(tx=>tx.query('select $1',['test-value']));
  assert.equal(client.calls.at(-1).sql,'commit');assert.deepEqual(client.calls.at(-2).params,['test-value']);
  await assert.rejects(()=>postgresAdapter(client,target,{apply:true}).transaction(async()=>{throw new Error('synthetic');}),/synthetic/);
  assert.equal(client.calls.at(-1).sql,'rollback');
});
test('versioned identity revision preserves frozen v1 and excludes only 14 affected candidates',async()=>{
  await assert.rejects(()=>refuseLegacyRewrite(),/frozen/);
  const input=await inputs();
  const manifest=JSON.parse(await fs.readFile(new URL('../catalog/selection-v1/identity-20261001.manifest.json',import.meta.url)));
  assert.equal(manifest.files[manifest.records_file],'ee121760b727a7e020876ff2c69227a20472c4112376b2ba6443398209353b7b');
  const base=new URL('../catalog/selection-v1/',import.meta.url);
  const originalBytes=await fs.readFile(new URL('reviewed-records.json',base));
  assert.equal(sha256(originalBytes),manifest.previous_records_sha256);
  const old=JSON.parse(originalBytes),review=JSON.parse(await fs.readFile(new URL('identity-20261001.review.json',base)));
  assert.equal(review.records.length,24);
  const ids=review.records.flatMap(r=>r.candidates.map(c=>c.candidate_id));assert.equal(ids.length,14);
  input.records.forEach((r,i)=>assert.deepEqual({...r,hold:old[i].hold},old[i],'only hold may change'));
  const plan=buildPlan(input.records,input.works,input.pins);
  assert.deepEqual(plan.counts,{link:875,insert:99,skip:26});
  assert.ok(plan.actions.filter(a=>ids.includes(a.candidate_id)).every(a=>a.kind==='skip'));
  assert.equal(review.records.filter(r=>r.production_repair).length,3);
});
