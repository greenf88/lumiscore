import {PGlite} from '@electric-sql/pglite';
import {readFile} from 'node:fs/promises';
import {performance} from 'node:perf_hooks';
import {fixture} from '../test-support/product-metrics/local-fixture.mjs';
const db=new PGlite(),actor='b0000000-0000-4000-8000-000000000001';let work=1;
const summary=values=>{const n=[...values].sort((a,b)=>a-b);return{n:n.length,medianMs:n[Math.floor(n.length/2)],minMs:n[0],maxMs:n.at(-1),samplesMs:values};};
async function sample(){const times=[];for(let i=0;i<21;i++){const start=performance.now();await db.query('insert into public.ratings(user_id,work_id,rating) values($1,$2,8)',[actor,work++]);times.push(performance.now()-start);}return summary(times);}
try{
 await db.exec(fixture);await db.query("select set_config('request.jwt.claim.sub',$1,false)",[actor]);
 await db.exec('set role authenticated');const before=await sample();await db.exec('reset role');
 await db.exec(await readFile(new URL('../test-support/product-metrics/install.sql',import.meta.url),'utf8'));
 await db.exec('set role authenticated');const noContext=await sample();await db.exec('reset role');
 const c={locale:'nl',surface:'taste_test',source:'facebook',medium:'organic_social',campaign:'dystopie_202610',traffic:'synthetic'};
 await db.query("select set_config('request.headers',$1,false)",[JSON.stringify({'x-lumiscore-product-context':JSON.stringify(c)})]);
 await db.exec('set role authenticated');const withContext=await sample();
 console.log(JSON.stringify({profile:`LOCAL PGlite/WASM on ${process.platform}/${process.arch}, Node ${process.version}; warmed sequential single-actor writes; no network`,before,noContext,withContext,hostedImpact:null,note:'SQL microbenchmark only. Not browser, hosted or production latency. No additional database network requests are introduced on rating/round paths.'},null,2));
}finally{await db.close();}
