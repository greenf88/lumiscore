// Prove the real router audit exposes the pre-PR69 UA-dependent streaming fault.
// Isolated loopback fixture; no database, external descriptions, credentials or writes.
import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {readFile,mkdir} from 'node:fs/promises';import {fileURLToPath} from 'node:url';import net from 'node:net';
const root=fileURLToPath(new URL('../',import.meta.url));const py=process.env.METADATA_AUDIT_PYTHON??(process.platform==='win32'?'python':'python3');
const port=await new Promise(resolve=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>resolve(p));});});
const child=spawn(process.execPath,['scripts/seo-critical-local.mjs','--port='+port,'--slow-cover','--slow-description','--metadata-before-repair'],{cwd:root,stdio:['ignore','pipe','pipe'],windowsHide:true});let log='';
try{
 await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('Fixture startup timeout '+log.slice(-1200))),45000);child.once('exit',c=>{clearTimeout(timer);reject(Error('Fixture exit '+c+' '+log.slice(-1200)));});for(const s of [child.stdout,child.stderr])s.on('data',b=>{log=(log+b).slice(-6000);if(log.includes('SYNTHETIC SEO SSR PREVIEW')){clearTimeout(timer);resolve();}});});
 const warm=await fetch('http://127.0.0.1:'+port+'/en',{signal:AbortSignal.timeout(90000)});const warmText=await warm.text();assert.equal(warm.status,200,log.slice(-5000)+' '+warmText.slice(0,1000));
 const out='outputs/metadata-fault-sensitivity';await mkdir(root+out,{recursive:true});
 await new Promise((resolve,reject)=>{const p=spawn(py,['scripts/audit-metadata-head.py','--origin','http://127.0.0.1:'+port,'--output',out,'--paths','/nl','/en','/en/book/1','--uas','desktop','googlebot','inspection'],{cwd:root,stdio:['ignore','pipe','pipe'],windowsHide:true});let msg='';p.stdout.on('data',b=>msg+=b);p.stderr.on('data',b=>msg+=b);p.once('error',reject);p.once('exit',c=>c===0?resolve():reject(Error(msg)));});
 const report=JSON.parse(await readFile(root+out+'/responses.json','utf8'));assert.equal(report.rows.length,9);
 for(const r of report.rows){assert(!r.error,r.url);assert.equal(r.status,200);const c=r.html.tags.filter(t=>t.kind==='canonical');assert.equal(c.length,1);assert.equal(c[0].inHead,r.ua==='inspection',r.url+' '+r.ua);assert.equal(r.html.relevantOutsideHead.length>0,r.ua!=='inspection',r.url+' '+r.ua);}
 console.log(JSON.stringify({requests:9,preRepairEmptyConfig:true,ordinaryAndGooglebotRejected:6,inspectionDifferent:3,actualRouter:true,optionalSourcesSimulated:true}));
}finally{child.kill('SIGTERM');}
