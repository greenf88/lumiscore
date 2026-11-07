// Sequential isolated Lighthouse sessions; no authenticated browser profile.
import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const label=process.argv[2]??'baseline',origin=process.argv[3]??'https://lumisco.re';
if(!/^[a-z0-9-]+$/.test(label))throw Error('Invalid evidence label');
const cli='C:/Users/rickg/Documents/Codex/2026-09-30/seo-check/.npm-cache-lighthouse/_npx/0f94ee7615faf582/node_modules/lighthouse/cli/index.js';
const chrome='C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe';
const out=`outputs/seo-reliability-20261107/lighthouse-${label}`;await mkdir(out,{recursive:true});
const results=[];
const routes={home:'/en',browse:'/en/browse',collection:'/en/collection/dune',book:'/en/book/1'};
for(const [template,route]of Object.entries(routes))for(let run=1;run<=3;run++){
 const path=`${out}/${template}-${run}.json`,url=origin+route;
 await new Promise((resolve,reject)=>{const child=spawn(process.execPath,[cli,url,'--chrome-path='+chrome,'--chrome-flags=--headless=new --no-first-run --disable-extensions','--output=json','--output-path='+path,'--quiet','--only-categories=performance,accessibility,best-practices,seo'],{env:{...process.env,CHROME_PATH:chrome},windowsHide:true,stdio:['ignore','pipe','pipe']});let log='';for(const stream of[child.stdout,child.stderr])stream.on('data',b=>log=(log+b).slice(-3000));child.once('error',reject);child.once('exit',c=>c===0?resolve():reject(Error(`Lighthouse ${c}: ${log}`)));});
 const j=JSON.parse(await readFile(path,'utf8'));if(j.runtimeError)throw Error(JSON.stringify(j.runtimeError));
 const row={template,run,at:j.fetchTime,url:j.finalDisplayedUrl,performance:j.categories.performance.score*100,lcp:j.audits['largest-contentful-paint'].numericValue,tbt:j.audits['total-blocking-time'].numericValue,cls:j.audits['cumulative-layout-shift'].numericValue,
  lcpNode:j.audits['lcp-breakdown-insight']?.details?.items?.find(x=>x.type==='node'),breakdown:j.audits['lcp-breakdown-insight']?.details?.items?.find(x=>x.type==='table')?.items,
  imageBytes:j.audits['network-requests'].details.items.filter(r=>r.resourceType==='Image').reduce((n,r)=>n+r.transferSize,0)};
 results.push(row);await writeFile(out+'/samples.json',JSON.stringify(results,null,2));console.log(JSON.stringify({label,...row,lcpNode:row.lcpNode?.snippet}));
}
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
const medians=Object.keys(routes).map(template=>{const group=results.filter(r=>r.template===template);return {template,...Object.fromEntries(['performance','lcp','tbt','cls','imageBytes'].map(k=>[k,{median:median(group.map(r=>r[k])),min:Math.min(...group.map(r=>r[k])),max:Math.max(...group.map(r=>r[k]))}]))};});
await writeFile(out+'/medians.json',JSON.stringify({label,origin,conditions:'Lighthouse default simulated mobile; fresh browser/session per run; CDN/origin warmth not controlled; sequential, not field data',medians},null,2));
console.log('LIGHTHOUSE_COMPLETE '+label);
