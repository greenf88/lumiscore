import test from 'node:test';import assert from 'node:assert/strict';import {PGlite} from '@electric-sql/pglite';
import {cleanupCronCommand,cleanupJobName,cleanupSchedulerSql} from './snapshot-cleanup-scheduler.mjs';import fs from 'node:fs/promises';
test('cleanup scheduler pauses after three consecutive failures, success resets and unrelated jobs remain',async()=>{
 const db=new PGlite();try{
 await db.exec(`create schema cron;create table cron.job(jobid bigint primary key,jobname text,active boolean);create table cron.job_run_details(jobid bigint,runid bigint,status text);
 create table calls(n int);insert into calls values(0);
 create function public.cleanup_catalog_description_snapshots(integer) returns void language sql as 'update calls set n=n+1';
 create function cron.alter_job(job_id bigint,active boolean) returns void language sql as 'update cron.job set active=$2 where jobid=$1';
 insert into cron.job values(1,'${cleanupJobName}',true),(2,'unrelated-job',true);`);
 await db.exec(cleanupCronCommand());assert.equal((await db.query('select n from calls')).rows[0].n,1);
 await db.exec(`insert into cron.job_run_details values(1,1,'failed'),(1,2,'failed'),(1,3,'failed')`);
 await db.exec(cleanupCronCommand());assert.equal((await db.query('select active from cron.job where jobid=1')).rows[0].active,false);
 assert.equal((await db.query('select n from calls')).rows[0].n,1);assert.equal((await db.query('select active from cron.job where jobid=2')).rows[0].active,true);
 await db.exec(`update cron.job set active=true where jobid=1;insert into cron.job_run_details values(1,4,'succeeded')`);
 await db.exec(cleanupCronCommand());assert.equal((await db.query('select n from calls')).rows[0].n,2);
 assert.equal(await fs.readFile(new URL('../docs/snapshot-cleanup-20261108/scheduler.sql',import.meta.url),'utf8'),cleanupSchedulerSql());
 assert.throws(()=>cleanupCronCommand("bad'job"),/Invalid/);
 }finally{await db.close();}
});
