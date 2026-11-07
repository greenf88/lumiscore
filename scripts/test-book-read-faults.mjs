// Real route + real catalogue loader; synthetic REST failures in loopback only.
import assert from 'node:assert/strict';import {spawn}from'node:child_process';import net from'node:net';import fs from'node:fs/promises';
const port=await new Promise(r=>{const s=net.createServer();s.listen(0,'127.0.0.1',()=>{const p=s.address().port;s.close(()=>r(p));});});
const serial=process.argv.includes('--serial-sensitivity');
const child=spawn(process.execPath,['scripts/seo-critical-local.mjs','--port='+port,'--real-book-read-faults',...(serial?['--serial-book-reads']:[])],{stdio:['ignore','pipe','pipe'],windowsHide:true});let log='';
try{await new Promise((r,j)=>{const t=setTimeout(()=>j(Error(log.slice(-1500))),45000);for(const stream of[child.stdout,child.stderr])stream.on('data',b=>{log=(log+b).slice(-10000);if(log.includes('SYNTHETIC SEO SSR PREVIEW')){clearTimeout(t);r();}});child.once('exit',c=>j(Error('Fixture exited '+c)));});
 const rows=[];for(const locale of['en','nl'])for(const [id,expected]of(serial?[[11,500]]:[[6,500],[7,404],[8,500],[9,200],[10,500],[11,200]])){
 const r=await fetch('http://127.0.0.1:'+port+'/'+locale+'/book/'+id,{signal:AbortSignal.timeout(45000)}),html=await r.text();assert.equal(r.status,expected,locale+id);const head=html.split('</head>')[0];
 if(expected===500){assert.doesNotMatch(head,/<link[^>]*rel="canonical"/);assert.doesNotMatch(html,/"@type":"Book"/);}
 if(expected===404)assert.doesNotMatch(head,/<link[^>]*rel="canonical"/);
 if(expected===200){assert.match(head,/name="robots" content="index, follow"/);assert.match(head,new RegExp('rel="canonical" href="https://lumisco.re/'+locale+'/book/'+id+'"'));assert.match(html,new RegExp('Synthetic verified '+id));}
 rows.push({locale,id,http:r.status,source: id===6?'work_db_error':id===7?'confirmed_missing':id===8?'edition_db_error':id===10?'network_error':'valid_identity_optional_storage_failed_no_cover_no_ratings'});
 }await fs.mkdir('outputs/seo-followup-20261107',{recursive:true});await fs.writeFile('outputs/seo-followup-20261107/'+(serial?'serial-sensitivity':'real-loader-fault-proof')+'.json',JSON.stringify({at:new Date().toISOString(),serial,rows},null,2));console.log(JSON.stringify({realLoaderChecks:rows.length,serialSensitivity:serial,temporaryFailuresNot404:true,missingIs404:!serial,optionalPresentationFailureStillIndexable:!serial}));
}catch(error){console.error(log.slice(-6000));throw error;}finally{child.kill('SIGTERM');}
