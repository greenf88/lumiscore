// Bounded original-response measurements through the official authenticated Vercel CLI.
// No secrets, cookies or authentication headers are logged; not a browser/LCP measurement.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { inspectServerHtml } from '../../lib/seo/server-html.ts';
const [cli, origin, output, mode='preview'] = process.argv.slice(2);
if(!cli||!origin||!output||!['preview','production'].includes(mode))throw Error('CLI, exact origin, output directory, preview|production required');
const base=new URL(origin);
if(base.protocol!=='https:'||!(base.hostname==='lumisco.re'||base.hostname.endsWith('.vercel.app')))throw Error('Unexpected target');
const routes=mode==='preview'
 ? ['/nl/toplijsten/dystopie-vanaf-1990','/en/toplijsten/dystopie-vanaf-1990','/nl/book/921100102','/en/book/921100102','/nl/book/91021031','/nl/book/921101191']
 : ['/nl/toplijsten/dystopie-vanaf-1990','/en/toplijsten/dystopie-vanaf-1990','/nl/book/102','/en/book/102'];
await mkdir(output,{recursive:true});
const results=[];
for(const route of routes)for(let attempt=1;attempt<=3;attempt++){
 const started=performance.now();let response='',firstByte=null,firstH1=null,firstCard=null;
 const args=[cli,'curl',new URL(route,base).href,'--scope','rgkgroeneveld-9102','--','--max-time','20','-sS','-i','-w','\nRECOVERY_METRICS%{json}'];
 const child=spawn(process.execPath,args,{windowsHide:true,stdio:['ignore','pipe','pipe']});let stderr='';
 child.stdout.on('data',chunk=>{response+=chunk.toString();firstByte??=performance.now();if(firstH1===null&&/<h1\b/.test(response))firstH1=performance.now();if(firstCard===null&&/class="book-card/.test(response))firstCard=performance.now()});
 child.stderr.on('data',chunk=>{stderr+=chunk.toString()});
 const code=await new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',resolve)});
 if(code!==0)throw Error('Official deployment request failed; stopped. '+stderr.replace(/(?:sb_|eyJ)[A-Za-z0-9._-]+/g,'[redacted]').slice(-500));
 const marker=response.lastIndexOf('\nRECOVERY_METRICS'),metrics=JSON.parse(response.slice(marker+17)),raw=response.slice(0,marker),bodyAt=raw.indexOf('<!DOCTYPE');
 const html=bodyAt>=0?raw.slice(bodyAt):raw.slice(raw.indexOf('<html'));
 const headers=raw.slice(0,bodyAt), safeHeaders={};
 for(const key of ['x-robots-tag','cache-control','x-vercel-cache'])safeHeaders[key]=headers.match(new RegExp('^'+key+':\\s*(.*)$','im'))?.[1]?.trim()??null;
 if([401,403].includes(metrics.http_code))throw Error('Access refused HTTP'+metrics.http_code+'; stop, no alternate route');
 const info=inspectServerHtml(html),jsonLd=[...html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g)].map(m=>{try{JSON.parse(m[1]);return true}catch{return false}});
 const result={route,attempt,http:metrics.http_code,ttfbMs:metrics.time_starttransfer*1000,totalMs:metrics.time_total*1000,
  h1StreamObservedMs:firstH1===null?null:metrics.time_starttransfer*1000+(firstH1-firstByte),
  cardStreamObservedMs:firstCard===null?null:metrics.time_starttransfer*1000+(firstCard-firstByte),
  caveat:'Stream marker timing includes pipe buffering, not browser visibility; CLI setup excluded using curl time_starttransfer. Repeats, not verified cold cache.',
  headers:safeHeaders,...info,jsonLdValid:jsonLd.every(Boolean),jsonLdCount:jsonLd.length,temporaryDescriptionFailure:/description could not load|beschrijving kon tijdelijk/.test(html),ownSouvenirSynopsis:html.includes('medaillon als aanwijzing'),wallIncludingCliMs:performance.now()-started};
 results.push(result);console.log(JSON.stringify({mode,route,attempt,http:result.http,ttfbMs:result.ttfbMs,totalMs:result.totalMs,h1StreamObservedMs:result.h1StreamObservedMs,cardStreamObservedMs:result.cardStreamObservedMs}));
 if(attempt===1)await writeFile(join(output,route.replaceAll('/','_')+'.html'),html);
 await writeFile(join(output,mode+'-http-measurements.json'),JSON.stringify({at:new Date().toISOString(),origin:base.origin,results},null,2));
}
