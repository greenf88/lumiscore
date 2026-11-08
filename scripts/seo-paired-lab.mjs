// Confirm suspected TBT regression with interleaved same-machine comparisons.
// Exact existing runtime-equivalent base and candidate; fresh profiles, no writes.
import lighthouse from 'file:///C:/Users/rickg/Documents/Codex/2026-09-30/seo-check/.npm-cache-lighthouse/_npx/0f94ee7615faf582/node_modules/lighthouse/core/index.js';
import * as launcher from 'file:///C:/Users/rickg/Documents/Codex/2026-09-30/seo-check/.npm-cache-lighthouse/_npx/0f94ee7615faf582/node_modules/chrome-launcher/dist/index.js';
import{readFile,writeFile,mkdir}from'node:fs/promises';
const config=JSON.parse(await readFile('outputs/seo-reliability-20261107/private-preview-access.json','utf8'));
const out='outputs/seo-reliability-20261107/lighthouse-paired';await mkdir(out,{recursive:true});const results=[];
for(const [template,path]of Object.entries({collection:'/en/collection/dune',book:'/en/book/928100001'}))for(let pair=1;pair<=3;pair++)for(const label of pair%2?['hosted-baseline','hosted-final']:['hosted-final','hosted-baseline']){
 const url=new URL(path,config[label]),token=new URL(config[label]).searchParams.get('_vercel_share');if(!token)throw Error('Existing access required');url.searchParams.set('_vercel_share',token);
 const chrome=await launcher.launch({chromePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',chromeFlags:['--headless=new','--no-first-run','--disable-extensions']});
 try{const{lhr}=await lighthouse(url.href,{port:chrome.port,logLevel:'error',onlyCategories:['performance']});
  if(lhr.runtimeError||new URL(lhr.finalDisplayedUrl).origin!==url.origin||new URL(lhr.finalDisplayedUrl).pathname!==path)throw Error('Invalid lab result');
  await writeFile(`${out}/${template}-${pair}-${label}.json`,JSON.stringify(lhr).replaceAll(token,'[redacted]').replaceAll(encodeURIComponent(token),'[redacted]'));
  const row={template,pair,label,at:lhr.fetchTime,performance:lhr.categories.performance.score*100,lcp:lhr.audits['largest-contentful-paint'].numericValue,tbt:lhr.audits['total-blocking-time'].numericValue,cls:lhr.audits['cumulative-layout-shift'].numericValue,benchmarkIndex:lhr.environment.benchmarkIndex,imageBytes:lhr.audits['network-requests'].details.items.filter(r=>r.resourceType==='Image').reduce((n,r)=>n+r.transferSize,0)};
  results.push(row);await writeFile(out+'/samples.json',JSON.stringify(results,null,2));console.log(JSON.stringify(row));
 }finally{await chrome.kill();}
}
console.log('PAIRED_LAB_COMPLETE');
