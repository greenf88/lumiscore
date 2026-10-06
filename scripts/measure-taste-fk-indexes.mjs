// Hypothetical growth test in disposable PostgreSQL, never production DDL.
import { PGlite } from '@electric-sql/pglite';
import { mkdir,writeFile } from 'node:fs/promises';
const db=new PGlite();
try {
  await db.exec(`create table offers(round_id uuid,user_id uuid,work_id bigint,decision text,
    primary key(user_id,work_id));
    create index offers_round_idx on offers(round_id,decision);
    create unique index offers_one_current on offers(round_id) where decision='offered';
    insert into offers select md5(((n-1)/20)::text)::uuid,md5(((n-1)/100)::text)::uuid,
      n%10134,'rated' from generate_series(1,100000) n; analyze offers;`);
  const queries={round:"select 1 from offers where round_id=md5('20')::uuid and user_id=md5('4')::uuid",
    work:'select 1 from offers where work_id=168'};
  const samples=[];
  for(const variant of ['existing','round_pair','work_id']) {
    if(variant==='round_pair') await db.exec('create index offers_round_pair on offers(round_id,user_id); analyze offers;');
    if(variant==='work_id') await db.exec('drop index offers_round_pair; create index offers_work on offers(work_id); analyze offers;');
    const plans={};for(const [name,query] of Object.entries(queries)) plans[name]=(await db.query(`explain (format json) ${query}`)).rows[0]['QUERY PLAN'];
    // One warmup, then three batches of 100 sequential lookups, normalize per call.
    const times={};
    for(const [name,query] of Object.entries(queries)) {
      await db.query(query);times[name]=[];
      for(let repeat=0;repeat<3;repeat++) {const start=performance.now();for(let i=0;i<100;i++) await db.query(query);
        times[name].push(Number(((performance.now()-start)/100).toFixed(4)));}
    }
    const writeMs=[];
    for(let repeat=0;repeat<3;repeat++) {
      await db.exec('begin');const start=performance.now();
      await db.exec(`insert into offers select md5(n::text)::uuid,md5('insert-'||n)::uuid,n,'rated' from generate_series(200001,201000) n`);
      writeMs.push(Math.round(performance.now()-start));await db.exec('rollback');
    }
    const sizes=(await db.query("select indexrelname,pg_relation_size(indexrelid) as bytes from pg_stat_user_indexes where relname='offers' order by indexrelname")).rows;
    samples.push({variant,plans,lookupMsPerCall:times,insert1000Ms:writeMs,indexSizes:sizes});
  }
  const report={at:new Date().toISOString(),rows:100000,synthetic:true,tool:'PGlite 0.3.14 PostgreSQL; same database and sequential process',
    limitation:'Hypothetical growth, not current 47 production offers; no latency SLA, no production EXPLAIN ANALYZE; writes rolled back in disposable fixture only',samples};
  await mkdir('outputs/performance-review',{recursive:true});await writeFile('outputs/performance-review/fk-fixture.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report));
} finally {await db.close();}
