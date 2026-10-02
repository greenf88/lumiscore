// Opt-in real, NEW local Supabase validation. No remote/linked fallback or secrets in logs.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {spawn,spawnSync} from 'node:child_process';
import http from 'node:http';
import {Readable} from 'node:stream';
import pg from 'pg';
import {inputs,root} from './catalog-selection-local.mjs';
import {importSelection,livePlan} from './catalog-selection-db.mjs';
import {sha256} from './catalog-selection-inputs.mjs';

const project='supabase-editorial-index-review',workdir='outputs/'+project;
const output=path.join(root,workdir,'evidence'),migrationDir=path.join(root,'supabase/migrations');
const indexMigration='20261002161527_editorial_records_selection_lookup_index.sql';
const indexName='editorial_records_selection_slug_work_id_idx';
const cli=process.env.LOCAL_SUPABASE_CLI_ENTRY;
assert.ok(cli,'Explicit installed local Supabase CLI entry required');
const mode=process.argv[2];assert.ok(['prepare','verify','web-fixture','builds','html'].includes(mode));
const cleanEnv={...process.env,SUPABASE_TELEMETRY_DISABLED:'1'};
for(const key of Object.keys(cleanEnv))if(/^PG|^CATALOG_DATABASE_URL$|^SUPABASE_ACCESS_TOKEN$|^NODE_(OPTIONS|DEBUG|DEBUG_NATIVE)$/.test(key))delete cleanEnv[key];
const run=(bin,args,env=cleanEnv)=>spawnSync(bin,args,{cwd:root,env,windowsHide:true,timeout:120000,maxBuffer:64*1024*1024});
const cliResult=args=>{const result=run(process.execPath,[cli,...args,'--workdir',workdir,'--output-format','json','--log-level','none','--agent','no']);assert.equal(result.status,0,'Local CLI operation failed; raw diagnostic suppressed');const value=JSON.parse(result.stdout);return value.result??value;};
for(const service of ['db','kong','inbucket','auth','rest']){
  const name='supabase_'+service+'_'+project,inspection=run('docker',['inspect',name]);assert.equal(inspection.status,0);
  const container=JSON.parse(inspection.stdout)[0];assert.equal(container.Name,'/'+name);assert.equal(container.Config.Labels?.['com.supabase.cli.project'],project);assert.ok(container.State.Running);
  const ports=Object.values(container.NetworkSettings.Ports).filter(Boolean).flat();assert.ok(ports.every(p=>p.HostIp==='127.0.0.1'));
  if(['db','kong','inbucket'].includes(service))assert.ok(ports.length>0,'Published test service must be loopback-only');
}
const credentials=cliResult(['status']),url=new URL(credentials.DB_URL);
assert.equal(url.hostname,'127.0.0.1');assert.equal(url.port,'54432');assert.equal(url.pathname,'/postgres');assert.equal(new URL(credentials.API_URL).origin,'http://127.0.0.1:54431');
await fs.mkdir(output,{recursive:true});
const save=(name,value)=>fs.writeFile(path.join(output,name+'.json'),JSON.stringify(value,null,2)+'\n');
const input=await inputs(),sql=await fs.readFile(path.join(migrationDir,indexMigration),'utf8');
const db=new pg.Client({connectionString:credentials.DB_URL,types:{getTypeParser:(oid,format)=>oid===20?Number:pg.types.getTypeParser(oid,format)}});
const cliPush=(dry=false)=>cliResult(['db','push','--local','--skip-vault',...(dry?['--dry-run']:['--yes'])]);
const advisor=type=>cliResult(['db','advisors','--local','--type',type,'--level','info','--fail-on','none']);
const coveredFinding=value=>JSON.stringify(value).includes('editorial_records_selection_slug_work_id_fkey')&&JSON.stringify(value).includes('unindexed_foreign_keys');
async function schema(){
  const queries={relations:"select n.nspname,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,c.relacl::text from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','catalog_private') and c.relkind in ('r','v','S') order by 1,2",
    columns:"select table_schema,table_name,column_name,ordinal_position,data_type,is_nullable,column_default from information_schema.columns where table_schema in ('public','catalog_private') order by 1,2,4",
    constraints:"select conname,conrelid::regclass::text relation,pg_get_constraintdef(oid) definition from pg_constraint where connamespace in ('public'::regnamespace,'catalog_private'::regnamespace) order by 1,2",
    policies:"select schemaname,tablename,policyname,roles::text,cmd,qual,with_check from pg_policies where schemaname in ('public','catalog_private') order by 1,2,3",
    functions:"select n.nspname,p.oid::regprocedure::text name,p.prosrc,p.prosecdef,p.proconfig::text,p.proacl::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','catalog_private') order by 1,2",
    grants:"select table_schema,table_name,grantee,privilege_type,is_grantable from information_schema.role_table_grants where table_schema in ('public','catalog_private') order by 1,2,3,4",
    schema_grants:"select n.nspname,n.nspacl::text from pg_namespace n where n.nspname in ('public','catalog_private') order by 1",
    triggers:"select event_object_schema,event_object_table,trigger_name,event_manipulation,action_statement from information_schema.triggers where event_object_schema in ('public','catalog_private') order by 1,2,3,4",
    indexes:"select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname in ('public','catalog_private') order by 1,2,3"};
  const result={};for(const [key,query] of Object.entries(queries))result[key]=(await db.query(query)).rows;return result;
}
async function dataHashes(){
  const rows=(await db.query("select schemaname,tablename from pg_tables where schemaname in ('public','catalog_private','auth') order by 1,2")).rows;
  const hashes=[];for(const t of rows){const row=(await db.query(`select count(*)::text n,encode(sha256(convert_to(coalesce(string_agg(encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex'),'' order by encode(sha256(convert_to(to_jsonb(t)::text,'UTF8')),'hex')),''),'UTF8')),'hex') hash from "${t.schemaname}"."${t.tablename}" t`)).rows[0];hashes.push({...t,...row});}return hashes;
}
const adapter={query:(...args)=>db.query(...args),exec:sql=>db.query(sql),transaction:async callback=>{
  await db.query('savepoint index_import');try{const value=await callback({query:(...args)=>db.query(...args),exec:sql=>db.query(sql)});await db.query('release savepoint index_import');return value;}
  catch(error){await db.query('rollback to savepoint index_import;release savepoint index_import');throw error;}
}};
try{
  await db.connect();
  if(mode==='prepare'){
    assert.equal((await db.query("select to_regclass('public.works') name")).rows[0].name,null,'Clean owned stack only; never reset a populated DB');
    await db.query(`create table public.authors(id bigint generated by default as identity primary key,name text not null);
      create table public.works(id bigint generated by default as identity primary key,title text not null,author_id bigint references public.authors(id),open_library_id text unique,first_publish_year integer,cover_id bigint);
      create table public.editions(id bigint generated by default as identity primary key,work_id bigint references public.works(id),title text,isbn_10 text,isbn_13 text,language text,open_library_edition_id text,publisher text);
      revoke all on public.authors,public.works,public.editions from public,anon,authenticated;
      grant select on public.authors,public.works,public.editions to anon,authenticated;
      alter table public.authors enable row level security;alter table public.authors force row level security;
      alter table public.works enable row level security;alter table public.works force row level security;
      alter table public.editions enable row level security;alter table public.editions force row level security;
      create policy local_public_read on public.authors for select to anon,authenticated using(true);
      create policy local_public_read on public.works for select to anon,authenticated using(true);
      create policy local_public_read on public.editions for select to anon,authenticated using(true);`);
    const authors=new Map();for(const w of input.works){
      if(!authors.has(w.author))authors.set(w.author,(await db.query('insert into public.authors(name) values($1) returning id',[w.author??'Synthetic fixture author'])).rows[0].id);
      await db.query('insert into public.works(id,title,author_id,open_library_id,first_publish_year) values($1,$2,$3,$4,$5)',[w.id,w.title,authors.get(w.author),w.open_library_id,w.first_publish_year??null]);
      for(const e of w.editions??[])await db.query('insert into public.editions(work_id,title,isbn_10,isbn_13,language,open_library_edition_id) values($1,$2,$3,$4,$5,$6)',[w.id,e.title,e.isbn_10??null,e.isbn_13??null,e.language??null,e.open_library_edition_id??null]);
    }
    const collection=await fs.readFile(path.join(migrationDir,'20260916071439_collections_v1.sql'),'utf8');
    for(const id of new Set([...collection.matchAll(/\('[a-z-]+', (\d+),/g)].map(m=>Number(m[1]))))await db.query('insert into public.works(id,title) values($1,$2) on conflict(id) do nothing',[id,'Synthetic historical membership '+id]);
    await db.query("insert into public.works(id,title) values(99999,'Unclassified sentinel');select setval(pg_get_serial_sequence('public.works','id'),100000)");
    const staged=path.join(root,workdir,'supabase/migrations');await fs.mkdir(staged,{recursive:true});
    const files=(await fs.readdir(migrationDir)).filter(f=>f.endsWith('.sql')).sort();assert.equal(files.length,13);
    const first=files.filter(f=>f<'20260917180127');for(const f of first)await fs.copyFile(path.join(migrationDir,f),path.join(staged,f));
    const a=cliPush();assert.deepEqual(a.migrations,first);
    // The historical series migration expects pre-existing 43 series outside Git.
    // Supply clearly synthetic missing fixtures, never alter the historical SQL.
    const totals=await fs.readFile(path.join(migrationDir,'20260917180127_add_collection_expected_main_series_total.sql'),'utf8');
    for(const m of totals.matchAll(/\('([a-z-]+)', '((?:[^']|'')+)', \d+\)/g))await db.query("insert into public.collections(slug,name,collection_type) values($1,$2,'series') on conflict(slug) do nothing",[m[1],m[2].replaceAll("''","'")]);
    const rest=files.filter(f=>f>='20260917180127'&&f!==indexMigration);for(const f of rest)await fs.copyFile(path.join(migrationDir,f),path.join(staged,f));
    const b=cliPush();assert.deepEqual(b.migrations,rest);
    const advisors={security:advisor('security'),performance:advisor('performance')};assert.ok(coveredFinding(advisors.performance));
    await save('baseline',{migrations:[...first,...rest],advisors,schema:await schema(),data:await dataHashes(),bootstrap:'Synthetic missing pre-Git base tables, public frozen fixtures and missing historical series; no production personal data'});
    console.log(JSON.stringify({status:'PASS',mode,migrations:12,advisorTargetPresent:true}));
  }
  if(mode==='verify'){
    const baseline=JSON.parse(await fs.readFile(path.join(output,'baseline.json'),'utf8'));assert.deepEqual(await schema(),baseline.schema);assert.deepEqual(await dataHashes(),baseline.data);
    // Stress the same Work appearing in many selections: formal FK pair lookup.
    // This is a 100k-row synthetic access-path proof, not a production-volume forecast.
    let beforePlan,afterPlan;
    await db.query('begin');try{
      await db.query(`insert into public.works(id,title) select 20000000+g,'Synthetic index Work '||g from generate_series(1,1000) g;
        insert into public.catalog_selections select 'index-synthetic-'||s,'Synthetic','Synthetic' from generate_series(1,100) s;
        insert into public.catalog_selection_members select 'index-synthetic-'||s,20000000+w,'IDX-'||w from generate_series(1,100) s cross join generate_series(1,1000) w;
        insert into catalog_private.editorial_records(selection_slug,candidate_id,work_id,record_hash,editorial_status,classifier,evidence)
          select selection_slug,candidate_id,work_id,repeat('a',64),'ZEKER','AI_EDITORIAL','{}'::jsonb from public.catalog_selection_members;
        analyze catalog_private.editorial_records;`);
      const explain=()=>db.query("explain (analyze,buffers,format json) select candidate_id from catalog_private.editorial_records where selection_slug='index-synthetic-50' and work_id=20000500");
      beforePlan=(await explain()).rows[0]['QUERY PLAN'][0];await db.query(sql);afterPlan=(await explain()).rows[0]['QUERY PLAN'][0];
      assert.ok(JSON.stringify(afterPlan.Plan).includes(indexName));assert.ok(JSON.stringify(afterPlan.Plan).includes('selection_slug')&&JSON.stringify(afterPlan.Plan).includes('work_id'));
      assert.equal(afterPlan.Plan['Actual Rows'],1);
    }finally{await db.query('rollback');}
    assert.deepEqual(await schema(),baseline.schema);assert.deepEqual(await dataHashes(),baseline.data,'benchmark rollback leaves every table unchanged');
    await fs.copyFile(path.join(migrationDir,indexMigration),path.join(root,workdir,'supabase/migrations',indexMigration));
    const pending=cliPush(true);assert.deepEqual(pending.migrations,[indexMigration]);const applied=cliPush();assert.deepEqual(applied.migrations,[indexMigration]);
    const final=await schema();assert.deepEqual({...final,indexes:final.indexes.filter(i=>i.indexname!==indexName)},baseline.schema);
    const state=(await db.query(`select indisvalid,indisready,indislive,indisunique,indisprimary,indnkeyatts,indnatts,pg_get_expr(indpred,indrelid) predicate,pg_get_indexdef(indexrelid,1,true) first_key,pg_get_indexdef(indexrelid,2,true) second_key from pg_index where indexrelid='catalog_private.${indexName}'::regclass`)).rows;
    assert.deepEqual(state,[{indisvalid:true,indisready:true,indislive:true,indisunique:false,indisprimary:false,indnkeyatts:2,indnatts:2,predicate:null,first_key:'selection_slug',second_key:'work_id'}]);
    assert.deepEqual(cliPush().migrations,[]);await db.query(sql);assert.deepEqual(await schema(),final);assert.deepEqual(await dataHashes(),baseline.data);
    const advisors={security:advisor('security'),performance:advisor('performance')};assert.ok(!coveredFinding(advisors.performance));
    const stripTime=v=>Array.isArray(v)?v.map(stripTime):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>!['observed_at'].includes(k)).map(([k,v])=>[k,stripTime(v)])):v;
    assert.deepEqual(stripTime(advisors.security),stripTime(baseline.advisors.security),'Security advisor findings unchanged');
    const importBefore=await dataHashes();await db.query('begin read only');let dry;try{
      const plan=await livePlan(adapter,input.records,input.pins);dry=await importSelection(adapter,input.records,input.pins,plan);
      assert.deepEqual(dry.counts,{link:875,insert:99,skip:26});assert.equal(dry.pending,974);assert.equal(dry.applied,false);
    }finally{await db.query('rollback');}assert.deepEqual(await dataHashes(),importBefore);
    let first,second;const otherWork=(await db.query('select * from public.works where id=1739')).rows;
    await db.query('begin isolation level serializable');try{
      const plan=await livePlan(adapter,input.records,input.pins);
      await db.query(`create function catalog_private.index_synthetic_failure() returns trigger language plpgsql as $$ begin if new.candidate_id='LS1000-0729' then raise exception 'synthetic index failure'; end if;return new;end $$;
        create trigger index_synthetic_failure before insert on catalog_private.editorial_records for each row execute function catalog_private.index_synthetic_failure();`);
      await assert.rejects(()=>importSelection(adapter,input.records,input.pins,plan,{apply:true}),/synthetic index failure/);
      assert.deepEqual(await dataHashes(),importBefore,'savepoint restores partial writes after Rendez-vous');
      await db.query('drop trigger index_synthetic_failure on catalog_private.editorial_records;drop function catalog_private.index_synthetic_failure()');
      first=await importSelection(adapter,input.records,input.pins,plan,{apply:true});assert.equal(first.created,99);assert.equal(first.linked,875);
      assert.equal((await db.query('select work_id from public.catalog_selection_members where candidate_id=$1',['LS1000-0728'])).rows[0].work_id,1078);assert.deepEqual((await db.query('select * from public.works where id=1739')).rows,otherWork);
      const saved=await dataHashes();second=await importSelection(adapter,input.records,input.pins,null,{apply:true});assert.equal(second.pending,0);assert.equal(second.unchanged,974);assert.deepEqual(await dataHashes(),saved);
      const query=await db.query("select public.catalog_editorial_page('',array['fiction_fantasy'],'lumiscore-selectie-1000') data");assert.equal(query.rows[0].data.total,124);assert.equal(query.rows[0].data.selectionCount,974);
    }finally{await db.query('rollback');}
    assert.deepEqual(await dataHashes(),importBefore);assert.deepEqual(await schema(),final);
    await save('verified',{status:'PASS',indexMigration,migration_sha256:sha256(Buffer.from(sql)),state,queryPlans:{before:beforePlan,after:afterPlan,syntheticRows:100000},advisorsBefore:baseline.advisors,advisorsAfter:advisors,
      schemaBefore:baseline.schema,schemaAfter:final,dataBefore:importBefore,dataAfter:await dataHashes(),dryRun:{counts:dry.counts,pending:dry.pending,applied:false},import:{created:first.created,linked:first.linked,members:974,skips:26,repeatWrites:second.pending,rendezvous:1078,work1739Unchanged:true,partialFailureRollback:true,outerRollback:true},fullMigrationCount:13,secondMigrationRun:0,productionPrivateDataCopied:false});
    console.log(JSON.stringify({status:'PASS',mode,fullMigrationCount:13,indexValidReadyLive:true,localAdvisorTargetGone:true,allOtherSchemaRlsGrantsUnchanged:true,dryRunCounts:dry.counts,pending:974,secondImportWrites:second.pending,allSyntheticStressAndImportDataRolledBack:true}));
  }
  if(mode==='web-fixture'){
    assert.equal((await db.query('select count(*)::int n from catalog_private.editorial_records')).rows[0].n,0);
    await db.query('begin');try{const plan=await livePlan(adapter,input.records,input.pins);assert.deepEqual(plan.counts,{link:875,insert:99,skip:26});const result=await importSelection(adapter,input.records,input.pins,plan,{apply:true});assert.equal(result.pending,974);await db.query('commit');}catch(error){await db.query('rollback');throw error;}
    await db.query("notify pgrst,'reload schema'");console.log('OWNED_LOCAL_SYNTHETIC_WEB_FIXTURE_READY');
  }
  if(mode==='builds'){
    const env={...cleanEnv,NEXT_PUBLIC_SUPABASE_URL:credentials.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:credentials.ANON_KEY,SUPABASE_SECRET_KEY:credentials.SERVICE_ROLE_KEY,SUPABASE_SERVICE_ROLE_KEY:'',GOOGLE_BOOKS_API_KEY:'',NEXT_PUBLIC_SITE_ORIGIN:'http://localhost:3983'};
    const results=[];for(const [label,args,patch] of [['vinext',['node_modules/vinext/dist/cli.js','build'],{}],['vercel-equivalent',['node_modules/vite/bin/vite.js','build'],{VERCEL:'1',VERCEL_ENV:'production',NITRO_PRESET:'vercel'}],['client-secrets',['--experimental-strip-types','scripts/scan-client-secrets.ts'],{}]]){
      const result=run(process.execPath,args,{...env,...patch});results.push({label,exit_code:result.status});await fs.writeFile(path.join(output,label+'.log'),result.stdout.toString()+result.stderr.toString());assert.equal(result.status,0,'Build/scan failed; inspect local log');
    }await save('builds',results);console.log(JSON.stringify({status:'PASS',mode,results}));
  }
  if(mode==='html'){
    Object.assign(process.env,{NEXT_PUBLIC_SUPABASE_URL:credentials.API_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:credentials.ANON_KEY,SUPABASE_SECRET_KEY:credentials.SERVICE_ROLE_KEY,SUPABASE_SERVICE_ROLE_KEY:'',GOOGLE_BOOKS_API_KEY:''});
    const {default:app}=await import('../.vercel/output/functions/__server.func/index.mjs');
    const assets=path.join(root,'.vercel/output/static'),types={'.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.avif':'image/avif','.webp':'image/webp'};
    const server=http.createServer(async(req,res)=>{
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
      try{
        const url=new URL(req.url,'http://localhost:'+server.address().port),asset=path.resolve(assets,'.'+decodeURIComponent(url.pathname));
        if(asset.startsWith(assets+path.sep)&&path.extname(asset)){
          try{const body=await fs.readFile(asset);res.writeHead(200,{'content-type':types[path.extname(asset)]??'application/octet-stream'}).end(req.method==='HEAD'?undefined:body);return;}
          catch(error){if(!['ENOENT','EISDIR'].includes(error.code))throw error;}
        }
        const response=await app.fetch(new Request(url,{method:req.method,headers:req.headers}));
        res.writeHead(response.status,Object.fromEntries(response.headers));
        if(response.body&&req.method!=='HEAD')Readable.fromWeb(response.body).pipe(res);else res.end();
      }catch{res.writeHead(500).end('Owned local fixture preview failed');}
    });
    await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
    let log='';try{
      const child=spawn(process.execPath,['--experimental-strip-types','--test','scripts/test-catalog-server-html.mjs'],{cwd:root,env:{...cleanEnv,CATALOG_TEST_ORIGIN:'http://localhost:'+server.address().port},windowsHide:true});
      child.stdout.on('data',chunk=>{log+=chunk;});child.stderr.on('data',chunk=>{log+=chunk;});
      const timeout=setTimeout(()=>child.kill(),180000);
      const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve);}).finally(()=>clearTimeout(timeout));
      await fs.writeFile(path.join(output,'server-html.log'),log);assert.equal(code,0,'Server HTML regression failed; inspect owned local log');
      console.log(JSON.stringify({status:'PASS',mode,serverHtmlTests:5,ownedLoopbackPreview:true}));
    }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  }
}finally{await db.query('rollback').catch(()=>{});await db.end();}
