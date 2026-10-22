// LOCAL PostgreSQL/PGlite allocation model. Never connects to any hosted database.
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fixture} from '../test-support/product-metrics/local-fixture.mjs';
const db=new PGlite();
const install=await readFile(new URL('../test-support/product-metrics/install.sql',import.meta.url),'utf8');
const context={locale:'nl',surface:'taste_test',source:'facebook',medium:'organic_social',campaign:'dystopie_202610',traffic:'synthetic'};
const route={page_opened:6,editorial_list_opened:1,book_card_opened:1,book_detail_opened:2,sign_in_succeeded:1,taste_round_started:1,rating_saved_new:10,rating_saved_updated:1,taste_round_completed:1,taste_result_opened:1};
try{
 await db.exec(fixture);await db.exec(install);await db.exec(install);
 // Storage allocation only: 1,000 different counter dimensions + opaque receipts,
 // NOT a rate-limit bypass/ingress benchmark, observed visitors or hosted writes.
 await db.query(`insert into product_metrics_test.daily_counters
 select current_date,'rating_saved',$1::jsonb||jsonb_build_object('work_id',i,'operation','new'),1
 from generate_series(1,1000) i`,[context]);
 await db.exec(`insert into product_metrics_test.receipts select gen_random_uuid(),current_date from generate_series(1,1000);
 insert into product_metrics_test.budgets values(date_trunc('minute',now()),1)`);
 const columns=(await db.query(`select 'daily_counters' as table_name,min(pg_column_size(c))::int as min_row_bytes,max(pg_column_size(c))::int as max_row_bytes,avg(pg_column_size(c))::float8 as mean_row_bytes from product_metrics_test.daily_counters c
 union all select 'receipts',min(pg_column_size(r))::int,max(pg_column_size(r))::int,avg(pg_column_size(r))::float8 from product_metrics_test.receipts r
 union all select 'budgets',min(pg_column_size(b))::int,max(pg_column_size(b))::int,avg(pg_column_size(b))::float8 from product_metrics_test.budgets b`)).rows;
 const relations=(await db.query(`select c.relname as table_name,pg_relation_size(c.oid)::float8 as heap_bytes,pg_indexes_size(c.oid)::float8 as index_bytes,pg_total_relation_size(c.oid)::float8 as total_bytes
 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='product_metrics_test' and c.relkind='r' order by c.relname`)).rows;
 const receipt=relations.find(r=>r.table_name==='receipts'),counter=relations.find(r=>r.table_name==='daily_counters');
 assert.ok(receipt&&counter);assert.equal((await db.query('select count(*)::int as n from product_metrics_test.receipts')).rows[0].n,1000);
 const functions=(await db.query(`select n.nspname as schema,p.proname as name,pg_get_function_identity_arguments(p.oid) as args,md5(p.prosrc) as body_md5,p.prosecdef as security_definer,p.proconfig as settings,p.proacl::text as acl
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='product_metrics_test' or (n.nspname='public' and p.proname in ('record_product_event_test_v1','record_product_events_test_v1','record_product_sign_in_test_v1')) order by n.nspname,p.proname`)).rows;
 const baseEvents=Object.values(route).reduce((n,v)=>n+v,0);assert.equal(baseEvents,25);
 const receiptBytes=receipt.total_bytes/1000,counterBytes=counter.total_bytes/1000;
 // Actual UTC-day deletion keeps days today..today-90 inclusive (91 dates).
 const retainedDates=91;
 const scenarios=[100,1000,10000].map(routeExecutionsPerDay=>{
  const eventsPerDay=routeExecutionsPerDay*(.8*5+.2*28),retainedEvents=eventsPerDay*retainedDates;
  return{routeExecutionsPerDay,eventsPerDay,averageEventsPerMinute:eventsPerDay/1440,retainedEvents,
   allocationWorstCaseMiB:retainedEvents*(receiptBytes+counterBytes)/1048576,
   provisionalBudgetMiB:retainedEvents*(receiptBytes+counterBytes)*3/1048576};
 });
 console.log(JSON.stringify({evidence:'LOCAL ALLOCATION MODEL; NOT HOSTED STORAGE OR LOAD PROOF',profile:`PGlite on ${process.platform}/${process.arch}; Node ${process.version}`,installSha256:createHash('sha256').update(install).digest('hex'),sampleRowsPerCounterAndReceipt:1000,columns,relations,bytesPerEventWorstCase:receiptBytes+counterBytes,
  route:{definitions:route,baseEvents,withThreeRecommendationImpressions:28,guestListToBookEvents:5,logicalMetricRowWritesPerAcceptedEvent:3,baseLogicalMetricWrites:baseEvents*3,note:'Receipt INSERT + counter INSERT/UPDATE + minute-budget INSERT/UPDATE; not WAL/index I/O or network requests. Cleanup DELETE statements additionally run on first event of a new minute. Actual triggered read-status writes are business data, not product metrics.'},
  limits:{globalEventsPerMinute:120,theoreticalMaximum28EventRoutesPerMinute:120/28,nonwaitingBusyDrops:true,retainedUtcDates:retainedDates,purge:'opportunistic on first accepted-budget event of a minute; no wall-clock deletion guarantee while idle',hostedDurations:null,hostedRecordSizes:null},
  scenarios,assumptions:'80% guest browse routes of5 events;20% authenticated10-book routes of28 events;100% delivered;1 receipt/event, worst-case1 distinct counter/event;91 UTC dates. Allocation from local1000-row pages,3x planning allowance for fill/bloat/WAL/backup not measured; NOT a measured hosted footprint or billing forecast. Aggregation normally reduces counter rows, not receipt rows. Peaks may exceed120/min despite acceptable daily averages.',functions},null,2));
}finally{await db.close();}
