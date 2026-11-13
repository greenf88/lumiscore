// Public, unauthenticated, sequential mobile lab. No product writes or secrets.
import lighthouse from 'file:///C:/Users/rickg/Documents/Codex/2026-09-30/seo-check/.npm-cache-lighthouse/_npx/0f94ee7615faf582/node_modules/lighthouse/core/index.js';
import * as launcher from 'file:///C:/Users/rickg/Documents/Codex/2026-09-30/seo-check/.npm-cache-lighthouse/_npx/0f94ee7615faf582/node_modules/chrome-launcher/dist/index.js';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
const origin=process.argv[2]??'https://lumisco.re',label=process.argv[3]??'production',runs=Number(process.argv[4]??1);
if(!/^[a-z0-9-]+$/.test(label)||runs<1||runs>5)throw Error('Invalid bounded lab configuration');
const routes={homeNL:'/nl',homeEN:'/en',browse:'/en/browse',browse2:'/en/browse?page=2',collection:'/nl/collection/suzanne-vermeer',editorial:'/nl/toplijsten/na-project-hail-mary',bookOL:'/en/book/1',bookStored:'/en/book/8856',bookExternal:'/en/book/7621',bookNative:'/nl/book/10472',bookFallback:'/en/book/2093'};
const selected=process.env.LAB_ROUTES?.split(',')??Object.keys(routes),out=`outputs/seo-next-20261108/${label}`;await mkdir(out,{recursive:true});
let rows=[];try{rows=JSON.parse(await readFile(out+'/samples.json','utf8'));}catch{}
for(let run=1;run<=runs;run++)for(const name of selected){if(!routes[name])throw Error('Unknown route');if(rows.some(x=>x.name===name&&x.run===run))continue;
 const chrome=await launcher.launch({port:9339,chromePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',chromeFlags:['--headless=new','--no-first-run','--disable-extensions']});
 try{const url=origin+routes[name],{lhr}=await lighthouse(url,{port:chrome.port,logLevel:'error',onlyCategories:['performance']});await writeFile(`${out}/${name}-${run}.json`,JSON.stringify(lhr));
  const a=lhr.audits,net=a['network-requests']?.details?.items??[],breakdown=a['lcp-breakdown-insight']?.details?.items??[];
  const row={name,run,url,at:lhr.fetchTime,valid:!lhr.runtimeError&&new URL(lhr.finalDisplayedUrl).pathname===new URL(url).pathname,error:lhr.runtimeError??null,warnings:lhr.runWarnings,performance:lhr.categories.performance.score*100,lcp:a['largest-contentful-paint'].numericValue,tbt:a['total-blocking-time'].numericValue,cls:a['cumulative-layout-shift'].numericValue,ttfb:a['server-response-time']?.numericValue,breakdown,images:net.filter(x=>x.resourceType==='Image').map(x=>({url:x.url,bytes:x.transferSize,resourceBytes:x.resourceSize,start:x.networkRequestTime,end:x.networkEndTime})),longTasks:a['long-tasks']?.details?.items??[],benchmark:lhr.environment.benchmarkIndex};
  rows.push(row);await writeFile(out+'/samples.json',JSON.stringify(rows,null,2));console.log(JSON.stringify({...row,breakdown:undefined,images:row.images.length,longTasks:row.longTasks.length}));
 }finally{await chrome.kill();}
}
