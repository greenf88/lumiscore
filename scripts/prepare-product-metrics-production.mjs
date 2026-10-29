// Offline renderer only: stdout files, no filesystem writes or remote access.
import {PGlite} from '@electric-sql/pglite';
import {createHash} from 'node:crypto';
import {fixture} from '../test-support/product-metrics/local-fixture.mjs';
import {productionInstaller,productionScheduler,productionRollback,productionReport,productionMonitor,productionVerification} from '../test-support/product-metrics/production-package.mjs';
const db=new PGlite();try{
 const files={'install.sql':await productionInstaller(),'scheduler.sql':await productionScheduler(),'report.sql':await productionReport(),'monitor.sql':await productionMonitor(),'verify-install.sql':await productionVerification()};
 await db.exec(fixture);await db.exec("drop schema discovery_test_private cascade;set lumiscore.metrics.release_target='qvplwejffhjvxaypmjut'");await db.exec(files['install.sql']);
 const functions=(await db.query(`select n.nspname||'.'||p.proname||'('||oidvectortypes(p.proargtypes)||')' signature,md5(p.prosrc) body_md5,p.proconfig settings,p.prosecdef definer,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='product_metrics' or(n.nspname='public' and p.proname in('record_product_event_v1','record_product_events_v1','record_product_sign_in_v1','product_analysis_consent_v3')) order by 1`)).rows;
 files['rollback.sql']=productionRollback(functions);
 files['package-manifest.json']=JSON.stringify({project:'qvplwejffhjvxaypmjut',state:'PROPOSAL_NOT_INSTALLED',source:'test-support/product-metrics/install.sql; mechanical names/traffic mapping plus absent-baseline and explicit service_role rights',hashes:Object.fromEntries(Object.entries(files).map(([n,s])=>[n,createHash('sha256').update(s).digest('hex')])),functions},null,2)+'\n';
 console.log(JSON.stringify(files));
}finally{await db.close();}
