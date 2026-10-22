// Local allocation/extrapolation only. No network or hosted database.
import {createHash} from 'node:crypto';
import {localMetrics,context,text} from '../test-support/product-metrics/local-v3.mjs';
const db=await localMetrics();try{
 await db.query(`insert into product_metrics_test.daily_counters select current_date,'rating_saved',$1::jsonb||jsonb_build_object('work_id',i,'operation','new'),1,now()+interval '90 days' from generate_series(1,1000) i`,[context]);
 await db.exec("insert into product_metrics_test.receipts select gen_random_uuid(),now(),now()+interval '1 day' from generate_series(1,1000);insert into product_metrics_test.consent_grants select gen_random_uuid(),1,now(),now()+interval '30 minutes',null from generate_series(1,1000)");
 const relations=(await db.query(`select c.relname,pg_relation_size(c.oid)::float8 heap_bytes,pg_indexes_size(c.oid)::float8 index_bytes,pg_total_relation_size(c.oid)::float8 total_bytes from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='product_metrics_test' and c.relkind='r' order by c.relname`)).rows;
 const size=name=>relations.find(r=>r.relname===name).total_bytes/1000;
 const scenarios=[100,1000,10000].map(routesPerDay=>{
  // Assumptions, not observed visitors: 80%5-event browse,20%28-event rating route.
  const eventsPerDay=routesPerDay*9.6,receiptsPerDay=routesPerDay*(.8*5+.2*25),longReceiptsPerDay=routesPerDay*.2*3;
  const counterBytes=eventsPerDay*90*size('daily_counters'),receiptBytes=(receiptsPerDay+longReceiptsPerDay*90)*size('receipts'),grantBytes=routesPerDay/48*size('consent_grants');
  return{routesPerDay,eventsPerDay,averagePerMinute:eventsPerDay/1440,counterMiB:counterBytes/1048576,receiptMiB:receiptBytes/1048576,grantMiB:grantBytes/1048576,subtotalMiB:(counterBytes+receiptBytes+grantBytes)/1048576,subtotalWith3xPlanningMarginMiB:(counterBytes+receiptBytes+grantBytes)*3/1048576};
 });
 console.log(JSON.stringify({evidence:'LOCAL PGlite allocation; NOT hosted storage/load/cost proof',profile:`${process.platform}/${process.arch}; ${process.version}`,installSha256:createHash('sha256').update(await text('install.sql')).digest('hex'),relations,allocatedBytesPerSampleRow:{counter:size('daily_counters'),receipt:size('receipts'),grant:size('consent_grants')},scenarios,
  assumptions:'1000 deliberately distinct cells/receipts/grants; counter worst case1cell/event for90days, short receipts24h,long3/28round/login receipts90days;1grant/route30min. Actual aggregation reduces cells; indexes/page rounding inflate small samples. Excludes small bounded budgets/health/history, WAL/backups.3x is planning allowance,not observed footprint. No guaranteed delivery or unique people.',
  policy:{projectEventsPerMinute:600,eventsPerGrantPerMinute:60,grantsPerMinute:60,queue:20,batch:10,flushMs:100,retries:0,retention:'90 days + <=5 min normally without backlog; outages unbounded until repaired',logicalWritesPerAcceptedEvent:5,details:'grant SELECT FOR UPDATE + grant-budget UPSERT + project-budget UPSERT + receipt INSERT + counter UPSERT + operational accepted UPSERT; no cleanup on ingestion; counts exclude index/WAL work; receipt DELETE only if expired duplicate key',hostedOverhead:null}},null,2));
}finally{await db.close();}
