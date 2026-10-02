import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { validIsbn, buildPlan, digest, readCsv } from './catalog-selection-core.mjs';
import { inputs, createLocalDatabase, localDirectory, root } from './catalog-selection-local.mjs';
import { importSelection, readWorks, SELECTION } from './catalog-selection-db.mjs';
const input=await inputs();
test('all 1000 records and explicit category/year/ISBN corrections agree with CSV', async () => {
  const records=input.records;
  const get=n=>records[n-1];
  assert.equal(records.length,1000);
  for(const [id,category] of [[323,'fiction_fantasy'],[343,'fiction_fantasy'],[363,'fiction_literary_general'],[934,'fiction_literary_general'],[1000,'nonfiction_economics_business'],[998,'nonfiction_psychology_self_development']])
    assert.equal(get(id).categories[0],category);
  assert.equal(get(523).year,1623);assert.equal(get(395).year,1623);assert.equal(get(616).year,1623);
  assert.equal(get(28).year,null);
  assert.equal(validIsbn('9781405876760'),false);assert.equal(validIsbn('9780466619035'),false);
  assert.equal(get(133).isbns.includes('9781405876760'),false);assert.match(get(133).notes,/9781405876760/);
  assert.ok(records.flatMap(r=>r.isbns).every(validIsbn));
  const csv=readCsv(await fs.readFile(path.join(root,'catalog/selection-v1/lumiscore-catalogusselectie-v1.corrected.csv'),'utf8'));
  const original=await fs.readFile(path.join(root,'catalog/selection-v1/lumiscore-catalogusselectie-v1.original.csv'));
  assert.equal(createHash('sha256').update(original).digest('hex'),'ff53583cb71447b14d8de2e4132d64f85702f2f93894ea9b569d3250a7caea82');
  const correctedBytes=await fs.readFile(path.join(root,'catalog/selection-v1/lumiscore-catalogusselectie-v1.corrected.csv'));
  assert.equal(createHash('sha256').update(correctedBytes).digest('hex'),'d59d8cdbfde34cbf2754b74650dfc8852472daaccd654c6853a23486a7ec0823');
  assert.equal(csv.length,1000);
  assert.ok(records.every(r=>r.classifier==='AI_EDITORIAL'&&!r.basis.includes('HIGH')));
  assert.equal(csv[513]['bestaande LumiScore Work-ID'],'1936');
});
test('translation links to old ID; ambiguous identities are isolated; no native null-ID collision', () => {
  const plan=buildPlan(input.records,input.works,input.pins);
  assert.equal(plan.actions[513].work_id,1936);
  assert.equal(plan.actions[252].kind,'skip');
  assert.equal(plan.actions[524].kind,'skip');
  assert.equal(plan.actions[794].kind,'skip');
  assert.equal(plan.actions[40].kind,'skip');
  const native=structuredClone(input.records);native[0].open_library_id=null;native[0].existing_work_id=null;
  assert.equal(buildPlan(native,[{id:80000,title:'Unrelated native book',author:'Other',open_library_id:null}]).actions[0].kind,'insert');
});
test('local-only path guard rejects remote databases and other workspaces', () => {
  assert.throws(()=>localDirectory('postgres://production'),/local/);
  assert.throws(()=>localDirectory('../other'),/local/);
});
test('persistent import, dry-run, repeat, RLS, existing user data and database pagination', {timeout:120000}, async () => {
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'lumiscore-selection-test-'));
  let db=await createLocalDatabase(directory,input.works);
  try {
    await db.exec(`create table public.test_user_links(work_id bigint references public.works(id),rating int,status text,collection text);
      insert into public.test_user_links values(1936,5,'read','favourites');
      insert into public.works(id,title,open_library_id) values(99999,'Unclassified sentinel',null);`);
    const before=(await readWorks(db)).filter(w=>w.id<10000);
    const plan=buildPlan(input.records,await readWorks(db),input.pins);
    const dry=await importSelection(db,input.records,input.pins,plan);
    assert.equal(dry.applied,false);
    assert.equal((await db.query('select count(*)::int as n from public.catalog_selection_members')).rows[0].n,0);
    // Fail after one candidate was written: the entire import must roll back.
    await db.exec(`create function catalog_private.test_import_failure() returns trigger language plpgsql as $$
      begin if new.candidate_id='LS1000-0002' then raise exception 'synthetic partial failure'; end if; return new; end $$;
      create trigger test_import_failure before insert on catalog_private.editorial_records
      for each row execute function catalog_private.test_import_failure();`);
    const worksBeforeFailure=await readWorks(db);
    await assert.rejects(()=>importSelection(db,input.records,input.pins,plan,{apply:true}),/synthetic partial failure/);
    assert.deepEqual(await readWorks(db),worksBeforeFailure);
    for(const table of ['catalog_categories','catalog_selections','catalog_selection_members','work_catalog_categories','catalog_work_title_aliases'])
      assert.equal((await db.query('select count(*)::int as n from public.'+table)).rows[0].n,0);
    await db.exec('drop trigger test_import_failure on catalog_private.editorial_records; drop function catalog_private.test_import_failure()');
    const first=await importSelection(db,input.records,input.pins,plan,{apply:true});
    assert.deepEqual(plan.counts,{link:875,insert:99,skip:26});
    assert.equal(first.created,plan.counts.insert);assert.equal(first.linked,plan.counts.link);
    assert.deepEqual((await readWorks(db)).filter(w=>w.id<10000),before);
    assert.deepEqual((await db.query('select * from public.test_user_links')).rows,[{work_id:1936,rating:5,status:'read',collection:'favourites'}]);
    const tables=['authors','works','editions','catalog_categories','catalog_selections','catalog_selection_members','work_catalog_categories','catalog_work_title_aliases'];
    const snapshot=async()=>Promise.all([...tables.map(t=>'public.'+t),'catalog_private.editorial_records'].map(async t=>({table:t,
      rows:(await db.query(`select t.xmin::text as row_version,to_jsonb(t) as data from ${t} t order by to_jsonb(t)::text`)).rows})));
    const firstSnapshot=await snapshot();
    const second=await importSelection(db,input.records,input.pins,null,{apply:true});
    assert.equal(second.created,0);assert.equal(second.linked,0);assert.equal(second.pending,0);
    assert.deepEqual(await snapshot(),firstSnapshot,'repeat must not update any row version');
    const count=(await db.query('select count(*)::int as n from public.catalog_selection_members')).rows[0].n;
    assert.equal((await db.query("select work_id from public.catalog_work_title_aliases where title='La sombra del viento'")).rows[0].work_id,1936);
    assert.equal(count,1000-plan.counts.skip);
    assert.equal((await db.query('select count(*)::int as n from public.work_catalog_categories')).rows[0].n,1022);
    assert.equal((await db.query('select label_nl from public.catalog_selections')).rows[0].label_nl,'LumiScore Selectie');
    assert.equal((await db.query('select count(*)::int as n from public.editions where work_id>10000')).rows[0].n,0);
    // Synthetic language metadata exercises the real SQL, not production guesses.
    await db.query("insert into public.editions(work_id,title,language) values(1936,'La sombra del viento','nld')");
    const query=async (q='',cats=[],languages=[],page=1,size=32,selection='')=>(await db.query(
      'select public.catalog_editorial_page($1,$2,$3,$4,$5,$6,$7,$8) as data',[q,cats,selection,languages,'az',page,size,[]])).rows[0].data;
    const all=await query();assert.ok(all.total>count);
    assert.equal((await query('Unclassified sentinel')).total,1);
    assert.equal((await query('',[],[],1,32,SELECTION)).total,count);
    assert.equal((await query('La sombra',[],['nl'])).workIds[0],1936);
    assert.equal((await query('La sombra',[],['en'])).total,0);
    const fantasy=await query('', ['fiction_fantasy']); assert.ok(fantasy.total>32);
    assert.equal(fantasy.selectionCount,974,'selection total is independent of active filters');
    assert.equal((await query('not-a-real-title')).selectionCount,974);
    // Prove this is a live database count, not the expected fixture constant.
    await db.transaction(async tx=>{
      await tx.query('insert into public.catalog_selection_members values($1,99999,$2)',[SELECTION,'synthetic-count-sentinel']);
      const changed=(await tx.query('select public.catalog_editorial_page() as data')).rows[0].data;
      assert.equal(changed.selectionCount,975);
      await tx.query('delete from public.catalog_selection_members where candidate_id=$1',['synthetic-count-sentinel']);
    });
    const both=await query('', ['fiction_fantasy','fiction_literary_general']);
    assert.equal(new Set(both.workIds).size,both.workIds.length);
    const page2=await query('',[],[],2); assert.ok(page2.workIds.every(id=>!all.workIds.includes(id)));
    for(const size of [32,64,128]) {const r=await query('',[],[],999999,size);assert.equal(r.page,Math.ceil(r.total/size));assert.ok(r.workIds.length<=size);}
    await assert.rejects(()=>importSelection(db,input.records,input.pins,{...plan,source_hash:'changed'},{apply:true}),/drift/);
    const changed=structuredClone(input.records);changed[0].audience='changed';
    await assert.rejects(()=>importSelection(db,changed,input.pins,null,{apply:true}),/revision/);
    for(const role of ['anon','authenticated']) {
      await db.exec('set role '+role);
      assert.ok((await query()).total>0);
      for(const table of tables.slice(3)) {
        await db.query('select * from public.'+table+' limit 1');
        await assert.rejects(()=>db.query('delete from public.'+table+' where false'),/permission/);
      }
      await assert.rejects(()=>db.query("insert into public.catalog_categories values('bad','bad','bad')"),/permission/);
      await assert.rejects(()=>db.query("update public.catalog_categories set label_nl='bad'"),/permission/);
      await assert.rejects(()=>db.query('select * from catalog_private.editorial_records'),/permission/);
      await db.exec('reset role');
    }
    const saved=digest((await db.query('select * from public.work_catalog_categories order by work_id,category_id')).rows);
    await db.close();db=new PGlite(directory);await db.waitReady;
    assert.equal(digest((await db.query('select * from public.work_catalog_categories order by work_id,category_id')).rows),saved);
    assert.equal((await db.query('select count(*)::int as n from public.catalog_selection_members')).rows[0].n,count);
    console.log(JSON.stringify({counts:plan.counts,members:count,secondRunWrites:second.pending,persistence:'verified'}));
  } finally {await db.close();}
});
