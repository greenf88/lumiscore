// Bounded guest-only hosted acceptance. Uses existing official Vercel CLI access.
// Cookie jars are private ignored test outputs; never print cookies or grants.
import {spawn} from 'node:child_process';
import {mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {writeFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const origin=process.argv[2],cli=process.env.VERCEL_CLI_PATH;
assert.equal(origin,'https://lumiscore-p66zy1mg0-rgkgroeneveld-9102.vercel.app');assert.ok(cli);
const out=new URL('../outputs/product-measurements-20261028/',import.meta.url);await mkdir(out,{recursive:true});
const checks=[],ids=[],timings=[];
const jar=i=>decodeURIComponent(new URL(`guest-${i}.private.cookies`,out).pathname).replace(/^\/([A-Z]:)/,'$1');
async function request(client,path,{method='GET',body,raw,headers=[]}={}){
 const args=[cli,'curl',path,'--deployment',origin,'--scope','rgkgroeneveld-9102','--','-sS','-D','-','--max-time','20','-b',jar(client),'-c',jar(client),'-X',method,'-w','\nPR51_TIMING%{json}'];
 if(method!=='GET')args.push('-H',`Origin: ${origin}`,'-H','Content-Type: application/json');
 for(const h of headers)args.push('-H',h);
 if(body!==undefined||raw!==undefined)args.push('--data-binary','@-');
 const result=await new Promise((resolve,reject)=>{const child=spawn(process.execPath,args,{windowsHide:true,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';child.stdout.on('data',x=>stdout+=x);child.stderr.on('data',x=>stderr+=x);child.on('error',reject);child.on('close',code=>code?reject(Error(`CLI failure ${code}; no credential-bearing diagnostics printed`)):resolve(stdout));child.stdin.end(raw??(body===undefined?'':JSON.stringify(body)));});
 const split=result.lastIndexOf('\nPR51_TIMING');assert.ok(split>=0);const timing=JSON.parse(result.slice(split+12));
 const response=result.slice(0,split),matches=[...response.matchAll(/HTTP\/\S+ (\d{3})[^\r\n]*\r?\n/g)],last=matches.at(-1);assert.ok(last);
 const end=response.indexOf('\r\n\r\n',last.index),lf=response.indexOf('\n\n',last.index),offset=end>=0?end:lf;
 const text=response.slice(offset+(end>=0?4:2));let data;try{data=JSON.parse(text);}catch{data=null;}
 return {status:Number(last[1]),data,time:{ttfbMs:timing.time_starttransfer*1000,totalMs:timing.time_total*1000,uploadedBytes:timing.size_upload,downloadedBytes:timing.size_download}};
}
const context={locale:'nl',surface:'editorial',source:'facebook',medium:'organic_social',campaign:'dystopie_202610',traffic:'synthetic',list_id:'dystopie-vanaf-1990'};
const event=()=>{const id=randomUUID();ids.push(id);writeFileSync(new URL('guest-receipts.private.json',out),JSON.stringify(ids));return {event_id:id,event:'editorial_list_opened',properties:context};};
async function check(label,client,path,options,status){const r=await request(client,path,options);assert.equal(r.status,status,label);checks.push({label,status:r.status});return r;}
const route='/api/product-metrics',consent='/api/product-analysis-consent';
// Clean only this harness's previous cookie jars. Revoke first; do not replay
// an old accepted choice as a supposed first-visit/default-off test.
for(const client of [1,2,3]){try{await readFile(jar(client));await request(client,consent,{method:'POST',body:{choice:'denied',version:1}});await rm(jar(client));}catch(e){if(e.code!=='ENOENT')throw e;}}
await check('no choice: no optional writes',1,route,{method:'POST',body:{events:[event()]}},204);
const refused=await check('refuse',1,consent,{method:'POST',body:{choice:'denied',version:1}},200);assert.equal(refused.data.active,false);
await check('refused: no optional writes',1,route,{method:'POST',body:{events:[event()]}},204);
const accepted=await check('accept',1,consent,{method:'POST',body:{choice:'accepted',version:1}},200);assert.equal(accepted.data.active,true);
const duplicate=event();await check('accepted event',1,route,{method:'POST',body:{events:[duplicate]}},202);await check('same receipt retry',1,route,{method:'POST',body:{events:[duplicate]}},202);
await check('oversize rejected',1,route,{method:'POST',raw:'x'.repeat(8193)},413);
await check('private/free text payload rejected',1,route,{method:'POST',body:{events:[{...event(),properties:{...context,email:'synthetic@example.invalid'}}]}},400);
await check('canonical rating event cannot be forged',1,route,{method:'POST',body:{events:[{...event(),event:'rating_saved'}]}},400);
await check('DNT overrides accepted grant',1,route,{method:'POST',body:{events:[event()]},headers:['DNT: 1']},204);
await check('invalid rating remains invalid',1,'/api/ratings/921100102',{method:'PUT',body:{rating:0}},400);
for(let i=0;i<3;i++){const r=await check('accepted delivery timing '+i,1,route,{method:'POST',body:{events:[event()]}},202);timings.push({kind:'accepted-collector-http',...r.time});}
await check('withdraw',1,consent,{method:'POST',body:{choice:'denied',version:1}},200);
for(let i=0;i<3;i++){const r=await check('withdrawn grant ignores pending event '+i,1,route,{method:'POST',body:{events:[event()]}},204);timings.push({kind:'denied-collector-http',...r.time});}
// Two independent grants, ten-event batches; no unbounded queue or retries.
const minuteOffset=Date.now()%60000;if(minuteOffset>5000)await new Promise(resolve=>setTimeout(resolve,62000-minuteOffset));
for(const client of [2,3]){const r=await check('peak consent '+client,client,consent,{method:'POST',body:{choice:'accepted',version:1}},200);assert.equal(r.data.active,true);}
const peak=await Promise.all([2,3].map(async client=>{const runs=[];for(let batch=0;batch<2;batch++){const r=await check(`peak ${client}/${batch}`,client,route,{method:'POST',body:{events:Array.from({length:10},event)}},202);runs.push(r.time);}return {client,runs};}));
// Exactly one excess event on a single grant, project load stays far below 600/min.
for(let batch=0;batch<4;batch++)await check('grant limit batch '+batch,2,route,{method:'POST',body:{events:Array.from({length:10},event)}},202);
await check('61st event on grant is visibly limited',2,route,{method:'POST',body:{events:[event()]}},429);
for(const client of [2,3])await check('revoke peak grant '+client,client,consent,{method:'POST',body:{choice:'denied',version:1}},200);
const summary=kind=>{const v=timings.filter(x=>x.kind===kind).map(x=>x.totalMs).sort((a,b)=>a-b);return {n:v.length,medianMs:v[1],minMs:v[0],maxMs:v.at(-1)};};
const proof={at:new Date().toISOString(),deployment:origin,profile:'Windows desktop official vercel curl; CLI startup excluded; no network throttle; sequential acceptance/denial samples; two concurrent guest grants',checks,timings,summary:{accepted:summary('accepted-collector-http'),denied:summary('denied-collector-http')},peak,expectedCounted:84,limitations:['HTTP delivery/storage acknowledgement is supplemented by separate SQL readback','Not rating-storage overhead or browser paint','First sample is not proven cold','Two concurrent clients do not prove a production campaign envelope','One intentional grant rejection means synthetic event counts are incomplete by exactly that observed event; unknown network losses cannot be ruled out']};
await writeFile(new URL('guest-http-proof.json',out),JSON.stringify(proof,null,2));await writeFile(new URL('guest-receipts.private.json',out),JSON.stringify(ids));
for(const client of [1,2,3])await rm(jar(client),{force:true});
console.log(JSON.stringify(proof,null,2));
