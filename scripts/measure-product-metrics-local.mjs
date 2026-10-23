import {PGlite} from '@electric-sql/pglite';
import {performance} from 'node:perf_hooks';
import {fixture} from '../test-support/product-metrics/local-fixture.mjs';
import {actor,text,grant,headers} from '../test-support/product-metrics/local-v3.mjs';
const db=new PGlite();let work=1;
const summary=v=>{const s=[...v].sort((a,b)=>a-b);return{n:s.length,medianMs:s[Math.floor(s.length/2)],minMs:s[0],maxMs:s.at(-1),samplesMs:v};};
async function sample(){const times=[];for(let i=0;i<21;i++){const start=performance.now();await db.query('insert into public.ratings(user_id,work_id,rating) values($1,$2,8)',[actor,work++]);times.push(performance.now()-start);}return summary(times);}
try{
 await db.exec(fixture);await headers(db,null);await db.exec('set role authenticated');const baseline=await sample();await db.exec('reset role');
 await db.exec(await text('install.sql'));await db.exec('set role authenticated');const denied=await sample();await db.exec('reset role');
 await headers(db,await grant(db));await db.exec('set role authenticated');const accepted=await sample();await db.exec('reset role');
 const counts=(await db.query('select event,dimensions,n::int n from product_metrics_test.daily_counters')).rows;
 console.log(JSON.stringify({profile:`LOCAL PGlite/WASM ${process.platform}/${process.arch}, ${process.version};21 sequential distinct new ratings each; no network`,baseline,denied,accepted,counts,hostedStorageOverhead:null,note:'Single-engine local SQL microbenchmark,not actual concurrent cloud locks or UI/LCP. Normal rating path has no extra network request; optional AFTER observer does synchronous bounded DB work. No production/test-project writes.'},null,2));
}finally{await db.close();}
