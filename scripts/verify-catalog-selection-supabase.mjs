// Opt-in integration harness: REAL local Supabase only, never a linked project.
// Setup refuses an existing application schema; no reset, truncate or remote fallback.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { spawnSync, spawn, execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import pg from 'pg';
import { inputs, root } from './catalog-selection-local.mjs';
import { main, fingerprint, connectionConfig } from './catalog-selection-postgres.mjs';
import { sha256 } from './catalog-selection-inputs.mjs';

const project='outputs/supabase-identity-validation';
const output=path.join(root,project,'evidence');
const mode=process.argv[2];
assert.ok(['setup','access','verify','repeat','build','serve','secrets'].includes(mode),'Use setup, access, verify, repeat, build, serve or secrets');
const cli=process.env.LOCAL_SUPABASE_CLI_ENTRY;
assert.ok(cli,'Set LOCAL_SUPABASE_CLI_ENTRY to the installed Supabase CLI JavaScript entry');
const status=spawnSync(process.execPath,[cli,'status','--workdir',project,'-o','json'],{
  cwd:root,encoding:'utf8',env:{...process.env,SUPABASE_TELEMETRY_DISABLED:'1'},maxBuffer:2**20,
});
assert.equal(status.status,0,'Local Supabase status must succeed');
const credentials=JSON.parse(status.stdout);
const api=new URL(credentials.API_URL), dbUrl=new URL(credentials.DB_URL);
assert.equal(api.origin,'http://127.0.0.1:54321','Refuse non-local or unexpected API');
assert.equal(dbUrl.hostname,'127.0.0.1');assert.equal(dbUrl.port,'54322');
assert.equal(dbUrl.pathname,'/postgres');assert.equal(dbUrl.username,'postgres');
for(const service of ['db','kong','inbucket']){
  const name='supabase_'+service+'_supabase-identity-validation';
  const container=JSON.parse(execFileSync('docker',['inspect',name],{encoding:'utf8'}))[0];
  assert.equal(container.Name,'/'+name);assert.ok(container.State.Running);
  const ports=Object.values(container.NetworkSettings.Ports).filter(Boolean).flat();
  assert.ok(ports.length>0&&ports.every(port=>port.HostIp==='127.0.0.1'),
    'Refuse a test stack published outside loopback: '+service);
}
const key=credentials.ANON_KEY, admin=credentials.SERVICE_ROLE_KEY;
assert.ok(key&&admin,'Local Auth keys required; never print status credentials');
await fs.mkdir(output,{recursive:true});
const report={engine:'real Supabase PostgreSQL/Auth/PostgREST',api:api.origin};
const save=async(name,data)=>fs.writeFile(path.join(output,name+'.json'),JSON.stringify(data,null,2)+'\n');
const environment={...process.env,NEXT_PUBLIC_SUPABASE_URL:api.origin,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:key,
  SUPABASE_SECRET_KEY:admin,SUPABASE_SERVICE_ROLE_KEY:'',GOOGLE_BOOKS_API_KEY:'',
  NEXT_PUBLIC_SITE_ORIGIN:'http://localhost:3983',VERCEL:'1',VERCEL_ENV:'production',NITRO_PRESET:'vercel'};
if(['build','serve','secrets'].includes(mode)){
  const args=mode==='build'?['node_modules/vite/bin/vite.js','build']:mode==='secrets'?['--experimental-strip-types','scripts/scan-client-secrets.ts']:['scripts/catalog-selection-production-preview.mjs'];
  const child=spawn(process.execPath,args,{cwd:root,env:environment,stdio:'inherit'});
  child.on('exit',code=>{process.exitCode=code??1;});
}else{
  const db=new pg.Client({connectionString:credentials.DB_URL});await db.connect();
  try{
    const tables=['authors','works','editions','ratings','user_book_status','user_reading_preferences','taste_test_responses',
      'catalog_categories','catalog_selections','catalog_selection_members','work_catalog_categories','catalog_work_title_aliases'];
    const snapshot=async(list=tables)=>{
      const result=[];
      for(const t of [...list,'catalog_private.editorial_records'])result.push({table:t,
        rows:(await db.query(`select t.xmin::text as row_version,to_jsonb(t) as data from ${t.includes('.')?t:'public.'+t} t order by to_jsonb(t)::text`)).rows});
      return result;
    };
    const request=async(endpoint,{token=key,method='GET',body,profile}={})=>{
      const response=await fetch(api.origin+endpoint,{method,signal:AbortSignal.timeout(10000),headers:{apikey:key,Authorization:'Bearer '+token,
        'Content-Type':'application/json',Prefer:'return=representation',...(profile?{'Accept-Profile':profile}: {})},
        body:body===undefined?undefined:JSON.stringify(body)});
      const text=await response.text();let data;try{data=JSON.parse(text);}catch{data=text;}
      return {status:response.status,data};
    };
    const rpc=async(args={})=>{
      const response=await request('/rest/v1/rpc/catalog_editorial_page',{method:'POST',body:args});
      assert.equal(response.status,200,'Real editorial RPC accessible anonymously');return response.data;
    };
    if(mode==='setup'){
      assert.equal((await db.query("select to_regclass('public.works') as name")).rows[0].name,null,'Setup requires clean local DB; never reset automatically');
      await db.query(`create table public.authors(id bigint generated by default as identity primary key,name text not null);
        create table public.works(id bigint generated by default as identity primary key,title text not null,
          author_id bigint references public.authors(id),open_library_id text unique,first_publish_year integer,cover_id bigint);
        create table public.editions(id bigint generated by default as identity primary key,work_id bigint references public.works(id),
          title text,isbn_10 text,isbn_13 text,language text,open_library_edition_id text,publisher text);
        revoke all on public.authors,public.works,public.editions from public,anon,authenticated;
        grant select on public.authors,public.works,public.editions to anon,authenticated;
        alter table public.authors enable row level security;alter table public.authors force row level security;
        alter table public.works enable row level security;alter table public.works force row level security;
        alter table public.editions enable row level security;alter table public.editions force row level security;
        create policy local_public_read on public.authors for select to anon,authenticated using(true);
        create policy local_public_read on public.works for select to anon,authenticated using(true);
        create policy local_public_read on public.editions for select to anon,authenticated using(true);`);
      const input=await inputs(), authors=new Map();
      for(const w of input.works){
        if(!authors.has(w.author))authors.set(w.author,(await db.query('insert into public.authors(name) values($1) returning id',[w.author??'Unknown (local fixture)'])).rows[0].id);
        await db.query('insert into public.works(id,title,author_id,open_library_id,first_publish_year) values($1,$2,$3,$4,$5)',[w.id,w.title,authors.get(w.author),w.open_library_id,w.first_publish_year??null]);
        for(const e of w.editions??[])await db.query('insert into public.editions(work_id,title,isbn_10,isbn_13,language,open_library_edition_id) values($1,$2,$3,$4,$5,$6)',[w.id,e.title,e.isbn_10??null,e.isbn_13??null,e.language??null,e.open_library_edition_id??null]);
      }
      const migrationDir=path.join(root,'supabase/migrations');
      const migrations=(await fs.readdir(migrationDir)).filter(n=>n.endsWith('.sql')).sort();
      assert.equal(migrations.length,12);
      const collectionSql=await fs.readFile(path.join(migrationDir,'20260916071439_collections_v1.sql'),'utf8');
      const memberIds=[...new Set([...collectionSql.matchAll(/\('[a-z-]+', (\d+),/g)].map(m=>Number(m[1])))];
      for(const id of memberIds)await db.query('insert into public.works(id,title) values($1,$2) on conflict(id) do nothing',[id,'Synthetic migration sentinel '+id]);
      await db.query("insert into public.works(id,title) values(99999,'Unclassified sentinel')");
      await db.query("select setval(pg_get_serial_sequence('public.works','id'),100000)");
      report.migrations=[];
      for(const name of migrations){
        const sql=await fs.readFile(path.join(migrationDir,name),'utf8');
        if(name==='20260917180127_add_collection_expected_main_series_total.sql'){
          // This historical migration expects 43 existing series, not just its 9 predecessors' seeds.
          for(const m of sql.matchAll(/\('([a-z-]+)', '((?:[^']|'')+)', \d+\)/g))await db.query(
            "insert into public.collections(slug,name,collection_type) values($1,$2,'series') on conflict(slug) do nothing",[m[1],m[2].replaceAll("''","'")]);
        }
        await db.query(sql);report.migrations.push({name,sha256:sha256(Buffer.from(sql))});
      }
      await db.query("notify pgrst,'reload schema'");
      report.bootstrap={source:'public frozen catalog snapshot; synthetic missing base schema and missing historical series',productionPrivateDataCopied:false};
      await save('migrations',report);
    }
    // Wait only for local schema cache reload; no fallback to a mock or remote database.
    let ready=false;
    for(let attempt=0;attempt<20;attempt++){
      const r=await request('/rest/v1/catalog_categories?limit=1');
      if(r.status===200){ready=true;break;}await new Promise(resolve=>setTimeout(resolve,250));
    }
    assert.ok(ready,'Real PostgREST catalog schema visible');

    if(mode==='repeat'){
      const args=['--target='+path.join(output,'local-target.json')],env={CATALOG_DATABASE_URL:credentials.DB_URL};
      const before=await snapshot(),dry=await main(args,env),file=path.join(output,'restart-dry-run.json');
      await fs.writeFile(file,JSON.stringify(dry,null,2)+'\n');
      const applied=await main([...args,'--apply','--plan='+file,'--plan-sha256='+sha256(await fs.readFile(file))],env);
      assert.deepEqual(applied.result,{applied:true,pending:0,created:0,linked:0,unchanged:974});
      assert.deepEqual(await snapshot(),before,'Repeat after restart leaves all rows and xmin unchanged');
      await save('restart-repeat',applied.result);
    }
    if(mode==='setup'||mode==='access'){
      // Real GoTrue admin creates synthetic accounts, then actual password sign-in returns JWTs.
      const users=[];
      for(const label of ['a','b']){
        const email='local-'+label+'-'+randomBytes(8).toString('hex')+'@example.test',password=randomBytes(24).toString('base64url');
        const created=await request('/auth/v1/admin/users',{token:admin,method:'POST',body:{email,password,email_confirm:true}});
        assert.equal(created.status,200,'Real Auth synthetic creation');
        const signed=await request('/auth/v1/token?grant_type=password',{method:'POST',body:{email,password}});
        assert.equal(signed.status,200);assert.equal(signed.data.user.id,created.data.id);
        users.push({id:created.data.id,token:signed.data.access_token});
      }
      // Synthetic private records exist BEFORE import, and must retain data and xmin.
      await db.query('insert into public.ratings(user_id,work_id,rating) values($1,1936,8)',[users[0].id]);
      await db.query("insert into public.user_reading_preferences(user_id,reading_periods) values($1,array['before_1950'])",[users[0].id]);
      await db.query("insert into public.taste_test_responses(user_id,quiz_version,question_key,choice) values($1,'local','sentinel','left')",[users[0].id]);
      if(mode==='setup'){
      const target={host:'127.0.0.1',port:54322,...await fingerprint(db),tls:false};
      const targetPath=path.join(output,'local-target.json');await save('local-target',target);
      const args=['--target='+targetPath], importEnv={CATALOG_DATABASE_URL:credentials.DB_URL};
      await assert.rejects(()=>main([],importEnv),/Explicit target/);
      assert.throws(()=>connectionConfig('postgresql://postgres:secret@production.supabase.co:5432/postgres',target),/target mismatch/);
      await save('unknown-target',{...target,system_identifier:'unknown'});
      await assert.rejects(()=>main(['--target='+path.join(output,'unknown-target.json')],importEnv),/fingerprint mismatch/);
      const before=await snapshot();
      const dry=await main(args,importEnv);
      assert.equal(dry.result.applied,false);assert.deepEqual(dry.plan.counts,{link:875,insert:99,skip:26});
      assert.deepEqual(await snapshot(),before,'Default dry-run changes no data/xmin');
      const approve=async(name,plan)=>{await save(name,plan);const file=path.join(output,name+'.json');return ['--apply','--plan='+file,'--plan-sha256='+sha256(await fs.readFile(file))];};
      const applyArgs=await approve('first-dry-run',dry);
      await assert.rejects(()=>main([...args,'--apply'],importEnv),/reviewed dry-run/);
      await assert.rejects(()=>main([...args,'--apply','--plan='+path.join(output,'first-dry-run.json'),'--plan-sha256='+'0'.repeat(64)],importEnv),/checksum mismatch/);
      await db.query(`create function catalog_private.local_import_failure() returns trigger language plpgsql as $$
        begin if new.candidate_id='LS1000-0002' then raise exception 'synthetic partial failure'; end if; return new; end $$;
        create trigger local_import_failure before insert on catalog_private.editorial_records for each row execute function catalog_private.local_import_failure();`);
      await assert.rejects(()=>main([...args,...applyArgs],importEnv),/synthetic partial failure/);
      assert.deepEqual(await snapshot(),before,'Actual pg transaction rolls back all partial writes');
      await db.query('drop trigger local_import_failure on catalog_private.editorial_records;drop function catalog_private.local_import_failure()');
      const first=await main([...args,...applyArgs],importEnv);
      assert.deepEqual(first.result,{applied:true,pending:974,created:99,linked:875,unchanged:0});
      const afterFirst=await snapshot();
      for(const t of before.filter(s=>['authors','works','editions','ratings','user_book_status','user_reading_preferences','taste_test_responses'].includes(s.table))){
        const after=afterFirst.find(s=>s.table===t.table).rows;
        assert.deepEqual(after.filter(r=>t.rows.some(old=>old.data.id!==undefined?old.data.id===r.data.id:JSON.stringify(old.data)===JSON.stringify(r.data))),t.rows,'Existing '+t.table+' values/xmin unchanged');
      }
      const secondDry=await main(args,importEnv);
      const second=await main([...args,...await approve('second-dry-run',secondDry)],importEnv);
      assert.deepEqual(second.result,{applied:true,pending:0,created:0,linked:0,unchanged:974});
      assert.deepEqual(await snapshot(),afterFirst,'Second import changes no row versions');
      report.import={first:first.result,second:second.result,firstPlan:dry.plan.counts,version:first.version,
        manifest_sha256:first.manifest_sha256,rollback:true,dryRunReadOnly:true,targetRejection:true,existingValuesAndVersionsPreserved:true};
      await save('import',report.import);
      }

      const privateTables={
        ratings:{row:{work_id:1936,rating:7},update:{rating:9}},
        user_book_status:{row:{work_id:1936,status:'reading'},update:{status:'want_to_read'}},
        user_reading_preferences:{row:{reading_periods:['2000_2014']},update:{reading_periods:['before_1950']}},
        taste_test_responses:{row:{quiz_version:'local-matrix',question_key:'q1',choice:'left'},update:{choice:'right'}},
      };
      report.access=[];
      for(const [table,{row,update}] of Object.entries(privateTables)){
        // Remove only synthetic sentinel rows to give CRUD matrix a clean per-user row.
        await db.query(`delete from public.${table} where user_id=any($1::uuid[])`,[users.map(u=>u.id)]);
        for(const method of ['GET','POST','PATCH','DELETE']){
          const r=await request('/rest/v1/'+table+(method==='POST'?'':'?user_id=eq.'+users[0].id),{method,body:method==='POST'?{...row,user_id:users[0].id}:method==='PATCH'?update:undefined});
          assert.ok([401,403].includes(r.status),'Anon denied '+table+' '+method+'; status='+r.status+' code='+r.data?.code);
        }
        for(const user of users){
          const r=await request('/rest/v1/'+table,{token:user.token,method:'POST',body:{...row,user_id:user.id}});
          assert.equal(r.status,201,'Owner insert '+table);assert.equal(r.data.length,1);
        }
        for(let i=0;i<2;i++){
          const user=users[i],other=users[1-i],own='/rest/v1/'+table+'?user_id=eq.'+user.id,foreign='/rest/v1/'+table+'?user_id=eq.'+other.id;
          const visible=await request('/rest/v1/'+table,{token:user.token});assert.equal(visible.status,200);
          assert.ok(visible.data.length>0&&visible.data.every(r=>r.user_id===user.id),'Only own rows visible');
          for(const method of ['GET','PATCH','DELETE']){
            const r=await request(foreign,{token:user.token,method,body:method==='PATCH'?update:undefined});
            assert.ok(r.status>=200&&r.status<300);assert.deepEqual(r.data,[],'Cross-user '+method+' affects zero rows');
          }
          const ownerBefore=(await db.query(`select to_jsonb(t) as data,t.xmin::text as xmin from public.${table} t where user_id=$1`,[other.id])).rows;
          const forged=await request('/rest/v1/'+table,{token:user.token,method:'POST',body:{...row,user_id:other.id}});
          assert.ok([401,403].includes(forged.status),'Forged INSERT denied');
          const reassign=await request(own,{token:user.token,method:'PATCH',body:{user_id:other.id}});
          assert.ok(reassign.status>=400,'UPDATE identity / WITH CHECK denied');
          assert.deepEqual((await db.query(`select to_jsonb(t) as data,t.xmin::text as xmin from public.${table} t where user_id=$1`,[other.id])).rows,ownerBefore);
          const patched=await request(own,{token:user.token,method:'PATCH',body:update});assert.equal(patched.status,200);assert.equal(patched.data.length,1);
          // SQL privileges/policies are tested independently of gateway HTTP status.
          await db.query('begin');
          try{
            await db.query('set local role authenticated');
            await db.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[user.id,JSON.stringify({sub:user.id,role:'authenticated'})]);
            assert.equal((await db.query(`select count(*)::int as n from public.${table} where user_id=$1`,[other.id])).rows[0].n,0);
            assert.equal((await db.query(`update public.${table} set user_id=user_id where user_id=$1 returning user_id`,[other.id])).rowCount,0);
            assert.equal((await db.query(`delete from public.${table} where user_id=$1 returning user_id`,[other.id])).rowCount,0);
            await assert.rejects(()=>db.query(`update public.${table} set user_id=$1 where user_id=$2`,[other.id,user.id]),error=>['42501','22023'].includes(error.code));
          }finally{await db.query('rollback');}
        }
        for(const user of users){const r=await request('/rest/v1/'+table+'?user_id=eq.'+user.id,{token:user.token,method:'DELETE'});assert.equal(r.status,200);assert.equal(r.data.length,1);}
        report.access.push({table,anonCRUD:'denied',ownerCRUD:'passed',crossUserCRUD:'denied/zero rows',forgedInsert:'denied',updateWithCheck:'denied',sqlIsolation:'passed'});
      }
      const editorial=['catalog_categories','catalog_selections','catalog_selection_members','work_catalog_categories','catalog_work_title_aliases'];
      for(const token of [key,...users.map(u=>u.token)]){
        for(const table of editorial){
          const read=await request('/rest/v1/'+table+'?limit=1',{token});
          assert.equal(read.status,200);assert.equal(read.data.length,1);
          const identityColumn={catalog_categories:'id',catalog_selections:'slug',catalog_selection_members:'work_id',work_catalog_categories:'work_id',catalog_work_title_aliases:'work_id'}[table];
          for(const method of ['POST','PATCH','DELETE']){
            const r=await request('/rest/v1/'+table+'?'+identityColumn+'=eq.'+encodeURIComponent(read.data[0][identityColumn]),{token,method,body:method==='DELETE'?undefined:read.data[0]});
            assert.ok([401,403].includes(r.status),'Editorial write denied '+table+' '+method+' status='+r.status+' code='+r.data?.code);
          }
        }
        assert.ok((await request('/rest/v1/editorial_records',{token,profile:'catalog_private'})).status>=400,'Private schema not exposed');
      }
      for(const role of ['anon','authenticated']){
        const denied=async sql=>{
          await db.query('begin');try{
            await db.query('set local role '+role);
            await assert.rejects(()=>db.query(sql),error=>error.code==='42501');
          }finally{await db.query('rollback');}
        };
        await denied('select * from catalog_private.editorial_records');
        for(const table of editorial){
          await denied(`insert into public.${table} default values`);
          const column=(await db.query('select column_name from information_schema.columns where table_schema=$1 and table_name=$2 order by ordinal_position limit 1',['public',table])).rows[0].column_name;
          await denied(`update public.${table} set ${column}=${column} where false`);
          await denied(`delete from public.${table} where false`);
        }
        if(role==='anon')for(const table of Object.keys(privateTables))for(const sql of [
          `select * from public.${table}`,`insert into public.${table} default values`,
          `update public.${table} set user_id=user_id where false`,`delete from public.${table} where false`])await denied(sql);
      }
      await save('auth-access',{...report,editorialPublicRead:true,editorialWritesDenied:true,privateLedgerDenied:true,auth:'two synthetic GoTrue accounts and real password JWT sign-ins'});
    }
    const counts=(await db.query(`select (select count(*)::int from public.catalog_selection_members) as members,
      (select count(*)::int from public.work_catalog_categories) as category_links,
      (select count(*)::int from public.catalog_categories) as categories,
      (select count(*)::int from catalog_private.editorial_records) as ledger,
      (select count(*)::int from public.editions where work_id>100000) as new_editions`)).rows[0];
    assert.deepEqual(counts,{members:974,category_links:1022,categories:20,ledger:974,new_editions:0});
    const all=await rpc(),selection=await rpc({p_selection:'lumiscore-selectie-1000'});
    assert.equal(selection.total,974);assert.equal(all.selectionCount,974);assert.ok(all.total>974);
    assert.equal((await rpc({p_query:'Unclassified sentinel'})).total,1);
    assert.equal((await rpc({p_query:'Unclassified sentinel',p_categories:['fiction_fantasy']})).total,0);
    for(const size of [32,64,128]){
      const first=await rpc({p_categories:['fiction_fantasy'],p_page_size:size}),second=await rpc({p_categories:['fiction_fantasy'],p_page_size:size,p_page:2});
      assert.equal(first.total,124);assert.equal(first.workIds.length,Math.min(124,size));
      if(size<124)assert.ok(second.workIds.every(id=>!first.workIds.includes(id)));
    }
    assert.deepEqual((await rpc({p_query:'La sombra del viento'})).workIds,[1936]);
    // Exercise language normalization using a visibly synthetic edition, then undo it.
    await db.query('begin');try{
      await db.query("insert into public.editions(work_id,title,language) values(1936,'Synthetic language fixture','nld')");
      const r=(await db.query("select public.catalog_editorial_page('La sombra',array[]::text[],'',array['nl'],'az',1,32,array[]::bigint[]) as data")).rows[0].data;
      assert.deepEqual(r.workIds,[1936]);
    }finally{await db.query('rollback');}
    const relations=(await db.query(`select n.nspname as schema,c.relname as name,c.relrowsecurity as rls,c.relforcerowsecurity as force_rls
      from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('public','catalog_private') and c.relkind in ('r','v') order by 1,2`)).rows;
    for(const name of ['ratings','user_book_status','taste_test_responses','user_reading_preferences']){
      const r=relations.find(r=>r.name===name);assert.ok(r.rls&&r.force_rls);
    }
    const unexpectedExecute=(await db.query(`select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace
      cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) acl
      where n.nspname in ('public','catalog_private') and acl.grantee=0 and acl.privilege_type='EXECUTE'
      and (p.proname like 'catalog_%' or p.proname in ('get_work_rating_summary','get_work_rating_summaries','get_collaborative_recommendation_signals','protect_rating_identity','protect_user_book_status_identity','sync_rating_to_read_status','touch_collection_updated_at'))`)).rows;
    assert.deepEqual(unexpectedExecute,[]);
    const constraints=(await db.query("select conname,contype,convalidated from pg_constraint where connamespace in ('public'::regnamespace,'catalog_private'::regnamespace) order by conname")).rows;
    await save('constraints-observed',constraints);
    assert.ok(constraints.filter(c=>c.contype==='f').every(c=>c.convalidated),'Every foreign key validated');
    const indexes=(await db.query("select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname in ('public','catalog_private') order by indexname")).rows;
    const policies=(await db.query("select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname in ('public','catalog_private') order by tablename,policyname")).rows;
    const grants=(await db.query("select table_schema,table_name,grantee,privilege_type from information_schema.role_table_grants where table_schema in ('public','catalog_private') and grantee in ('PUBLIC','anon','authenticated') order by 1,2,3,4")).rows;
    const functions=(await db.query(`select p.proname,p.prosecdef as security_definer,p.proconfig,
      has_function_privilege('anon',p.oid,'EXECUTE') as anon_execute,has_function_privilege('authenticated',p.oid,'EXECUTE') as authenticated_execute
      from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in
      ('catalog_editorial_page','get_work_rating_summary','get_work_rating_summaries','get_collaborative_recommendation_signals',
      'protect_rating_identity','protect_user_book_status_identity','sync_rating_to_read_status','touch_collection_updated_at') order by p.proname`)).rows;
    assert.equal(functions.length,8);
    assert.equal(functions.find(f=>f.proname==='catalog_editorial_page').security_definer,false);
    assert.equal(functions.find(f=>f.proname==='get_collaborative_recommendation_signals').anon_execute,false);
    await save(mode==='setup'?'database-access':'post-restart',{counts,relations,constraints,indexes,policies,grants,functions,unexpectedPublicExecute:unexpectedExecute,
      api:{selectionTotal:selection.total,unfilteredTotal:all.total,fantasyTotal:124,pages:[32,64,128],unclassifiedVisible:true,titleAlias1936:true}});
    console.log(JSON.stringify({status:'PASS',mode,counts,import:report.import,access:report.access,api:api.origin},null,2));
  }finally{await db.end();}
}
