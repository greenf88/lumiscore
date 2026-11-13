// Interleaved built baseline/candidate, identical read-only test bridge and data.
import lighthouse from 'file:///C:/Users/rickg/Documents/Codex/2026-09-30/seo-check/.npm-cache-lighthouse/_npx/0f94ee7615faf582/node_modules/lighthouse/core/index.js';
import * as launcher from 'file:///C:/Users/rickg/Documents/Codex/2026-09-30/seo-check/.npm-cache-lighthouse/_npx/0f94ee7615faf582/node_modules/chrome-launcher/dist/index.js';
import{readFile,writeFile,mkdir}from'node:fs/promises';
const routes={bookPRH:'/en/book/928100001',bookStored:'/en/book/991880009',bookExternal:'/en/book/991880007',bookNL:'/nl/book/991880004',bookFallback:'/en/book/991880001',nativePRH:'/en/book/924100228',nativeUnbidan:'/nl/book/990710001',nativeISBN:'/nl/book/8800306'};
const out='outputs/seo-next-20261108/paired-final';await mkdir(out,{recursive:true});let rows=[];try{rows=JSON.parse(await readFile(out+'/samples.json','utf8'));}catch{}
for(const [name,path]of Object.entries(routes))for(let pair=1;pair<=5;pair++)for(const version of pair%2?['baseline','candidate']:['candidate','baseline']){
 if(rows.some(x=>x.name===name&&x.pair===pair&&x.version===version))continue;
 const url='http://127.0.0.1:'+(version==='baseline'?45432:45433)+path,check=await fetch(url);if(check.status!==200)throw Error('Invalid fixture route '+url+' '+check.status);
 const chrome=await launcher.launch({port:9339,chromePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',chromeFlags:['--headless=new','--no-first-run','--disable-extensions']});
 try{const{lhr}=await lighthouse(url,{port:chrome.port,logLevel:'error',onlyCategories:['performance']});await writeFile(`${out}/${name}-${pair}-${version}.json`,JSON.stringify(lhr));
 const a=lhr.audits,net=a['network-requests']?.details?.items??[],row={name,path,pair,version,at:lhr.fetchTime,valid:!lhr.runtimeError&&lhr.finalDisplayedUrl===url,error:lhr.runtimeError??null,warnings:lhr.runWarnings,performance:lhr.categories.performance.score*100,lcp:a['largest-contentful-paint'].numericValue,tbt:a['total-blocking-time'].numericValue,cls:a['cumulative-layout-shift'].numericValue,breakdown:a['lcp-breakdown-insight']?.details?.items??[],imageBytes:net.filter(x=>x.resourceType==='Image').reduce((n,x)=>n+x.transferSize,0),scriptBytes:net.filter(x=>x.resourceType==='Script').reduce((n,x)=>n+x.transferSize,0),images:net.filter(x=>x.resourceType==='Image').map(x=>({url:x.url,bytes:x.transferSize,status:x.statusCode,failed:x.failed})),benchmark:lhr.environment.benchmarkIndex};
 rows.push(row);await writeFile(out+'/samples.json',JSON.stringify(rows,null,2));console.log(JSON.stringify({...row,breakdown:undefined,images:undefined}));
 }finally{await chrome.kill();}
}
