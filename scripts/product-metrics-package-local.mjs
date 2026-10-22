// Reproducible rollback manifest; no credentials, hosted access or file writes.
import {localMetrics,text} from '../test-support/product-metrics/local-v3.mjs';
import {createHash} from 'node:crypto';
const db=await localMetrics();try{
 const functions=(await db.query(`select n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')' signature,md5(p.prosrc) body_md5,p.proconfig settings,p.prosecdef definer,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='product_metrics_test' or(n.nspname='public' and p.proname in('record_product_event_test_v1','record_product_events_test_v1','record_product_sign_in_test_v1','product_analysis_consent_test_v3')) order by 1`)).rows;
 console.log(JSON.stringify({hashes:Object.fromEntries(await Promise.all(['install.sql','scheduler-test.sql','rollback.sql'].map(async n=>[n,createHash('sha256').update(await text(n)).digest('hex')]))),functions},null,2));
}finally{await db.close();}
