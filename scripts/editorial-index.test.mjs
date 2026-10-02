import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import {sha256} from './catalog-selection-inputs.mjs';
import {inputs,createLocalDatabase} from './catalog-selection-local.mjs';
import {importSelection,livePlan} from './catalog-selection-db.mjs';

const migrations=new URL('../supabase/migrations/',import.meta.url);
export const indexName='editorial_records_selection_slug_work_id_idx';
export const indexMigration='20261002161527_editorial_records_selection_lookup_index.sql';
export const expectedSql=`create index if not exists ${indexName}\non catalog_private.editorial_records (selection_slug, work_id);\n`;
export const baseHash='efb525fc352ff2e5d1fd4224b95e9268dd19a952028fc4f36ba1680982836b71';

test('applied base migration retains approved bytes and follow-up is exactly one nonunique index',async()=>{
  assert.equal(sha256(await fs.readFile(new URL('20260930185834_catalog_selection_v1.sql',migrations))),baseHash);
  const files=(await fs.readdir(migrations)).filter(f=>f.endsWith('_editorial_records_selection_lookup_index.sql'));
  assert.deepEqual(files,[indexMigration]);
  const bytes=await fs.readFile(new URL(indexMigration,migrations));
  assert.equal(new TextDecoder('utf-8',{fatal:true}).decode(bytes),expectedSql);
  assert.equal(bytes.includes(13),false);assert.equal(bytes.subarray(0,3).equals(Buffer.from([239,187,191])),false);
  assert.doesNotMatch(expectedSql,/\b(unique|concurrently|where|include|grant|revoke|policy|alter|drop|insert|update|delete)\b/i);
});

test('Browse and Search retain their shared persistent editorial RPC source',async()=>{
  for(const route of ['browse','search']){
    const source=await fs.readFile(new URL(`../app/${route}/page.tsx`,import.meta.url),'utf8');
    assert.match(source,/import\('\@\/lib\/supabase\/editorial-catalog'\)/);
    assert.match(source,/await loadEditorialCatalog\(/);
    assert.doesNotMatch(source,/catalog_private|editorial_records/);
  }
  const loader=await fs.readFile(new URL('../lib/supabase/editorial-catalog.ts',import.meta.url),'utf8');
  assert.match(loader,/supabase\.rpc\('catalog_editorial_page', editorialRpcArgs\(state\)\)/);
  assert.doesNotMatch(loader,/catalog_private|editorial_records/);
});

test('index repetition changes only the intended index; importer, rollback and identity semantics remain', {timeout:120000},async()=>{
  const input=await inputs(),db=await createLocalDatabase(undefined,input.works);
  const sql=await fs.readFile(new URL(indexMigration,migrations),'utf8');
  const metadata=async()=>({
    tables:(await db.query("select c.relname,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','catalog_private') and c.relkind='r' order by 1")).rows,
    constraints:(await db.query("select conname,pg_get_constraintdef(oid) definition from pg_constraint where connamespace in ('public'::regnamespace,'catalog_private'::regnamespace) order by conname")).rows,
    policies:(await db.query("select schemaname,tablename,policyname,roles::text,cmd,qual,with_check from pg_policies where schemaname in ('public','catalog_private') order by 1,2,3")).rows,
    functions:(await db.query("select n.nspname,p.proname,p.prosrc,p.prosecdef,p.proconfig::text,p.proacl::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','catalog_private') order by 1,2")).rows,
    indexes:(await db.query('select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname in ($1,$2) order by 1,2,3',['public','catalog_private'])).rows,
  });
  try{
    const before=await metadata();await db.exec(sql);const after=await metadata();
    assert.deepEqual({...after,indexes:after.indexes.filter(i=>i.indexname!==indexName)},before);
    await db.exec(sql);assert.deepEqual(await metadata(),after,'second SQL run is a no-op');
    const state=(await db.query(`select i.indisvalid,i.indisready,i.indislive,i.indisunique,i.indisprimary,
      i.indnkeyatts,i.indnatts,pg_get_expr(i.indpred,i.indrelid) predicate,
      pg_get_indexdef(i.indexrelid,1,true) first_key,pg_get_indexdef(i.indexrelid,2,true) second_key
      from pg_index i where i.indexrelid='catalog_private.${indexName}'::regclass`)).rows;
    assert.deepEqual(state,[{indisvalid:true,indisready:true,indislive:true,indisunique:false,indisprimary:false,indnkeyatts:2,indnatts:2,predicate:null,first_key:'selection_slug',second_key:'work_id'}]);
    const otherWork=(await db.query('select * from public.works where id=1739')).rows;
    const adapter={query:(...args)=>db.query(...args),exec:sql=>db.exec(sql),transaction:async callback=>{
      await db.exec('savepoint index_import');try{const result=await callback({query:(...args)=>db.query(...args),exec:sql=>db.exec(sql)});await db.exec('release savepoint index_import');return result;}
      catch(error){await db.exec('rollback to savepoint index_import;release savepoint index_import');throw error;}
    }};
    await db.exec('begin');
    try{
      const plan=await livePlan(adapter,input.records,input.pins),dry=await importSelection(adapter,input.records,input.pins,plan);
      assert.deepEqual(dry.counts,{link:875,insert:99,skip:26});assert.equal(dry.pending,974);assert.equal(dry.applied,false);
      assert.equal((await db.query('select count(*)::int n from catalog_private.editorial_records')).rows[0].n,0);
      await assert.rejects(()=>importSelection(adapter,input.records,input.pins,{...plan,source_hash:'drift'},{apply:true}),/drift/);
      const first=await importSelection(adapter,input.records,input.pins,plan,{apply:true});
      assert.equal(first.created,99);assert.equal(first.linked,875);
      assert.equal((await db.query('select work_id from public.catalog_selection_members where candidate_id=$1',['LS1000-0728'])).rows[0].work_id,1078);
      assert.deepEqual((await db.query('select * from public.works where id=1739')).rows,otherWork);
      const second=await importSelection(adapter,input.records,input.pins,null,{apply:true});
      assert.equal(second.pending,0);assert.equal(second.created,0);assert.equal(second.unchanged,974);
      // The new access path must not introduce uniqueness for the FK pair.
      await db.query(`insert into catalog_private.editorial_records(selection_slug,candidate_id,work_id,record_hash,editorial_status,classifier,evidence)
        select selection_slug,'synthetic-duplicate-pair',work_id,record_hash,editorial_status,classifier,evidence from catalog_private.editorial_records where candidate_id='LS1000-0728'`);
      assert.equal((await db.query('select count(*)::int n from catalog_private.editorial_records where work_id=1078')).rows[0].n,2);
    }finally{await db.exec('rollback');}
    for(const table of ['public.catalog_selection_members','catalog_private.editorial_records'])assert.equal((await db.query(`select count(*)::int n from ${table}`)).rows[0].n,0);
    assert.deepEqual(await metadata(),after);
  }finally{await db.close();}
});
