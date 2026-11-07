// Existing official Lighthouse/Chrome Launcher, fresh isolated profile per run.
// Temporary Preview share credentials stay out of command lines, logs and proof.
import lighthouse from 'file:///C:/Users/rickg/Documents/Codex/2026-09-30/seo-check/.npm-cache-lighthouse/_npx/0f94ee7615faf582/node_modules/lighthouse/core/index.js';
import * as launcher from 'file:///C:/Users/rickg/Documents/Codex/2026-09-30/seo-check/.npm-cache-lighthouse/_npx/0f94ee7615faf582/node_modules/chrome-launcher/dist/index.js';
import {readFile,writeFile,mkdir,unlink} from 'node:fs/promises';
const config=JSON.parse(await readFile('outputs/seo-reliability-20261107/private-preview-access.json','utf8'));
const routes={home:'/en',browse:'/en/browse',collection:'/en/collection/dune',book:'/en/book/928100001'};
const labels=process.argv.slice(2);const selected=labels.length?labels:['hosted-baseline','hosted-candidate'];
const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)];
for(const label of selected){
 const access=new URL(config[label]),origin=access.origin,token=access.searchParams.get('_vercel_share');
 if(!token||!origin.endsWith('.vercel.app'))throw Error('Expected authorized Preview access');
 const out=`outputs/seo-reliability-20261107/lighthouse-${label}`;await mkdir(out,{recursive:true});
 let results=[];try{results=JSON.parse(await readFile(out+'/samples.json','utf8'));}catch{ /* First run. */ }
 for(const [template,path]of Object.entries(routes))for(let run=1;run<=3;run++){
  if(results.some(r=>r.template===template&&r.run===run&&r.url===origin+path))continue;
  const url=new URL(path,origin);url.searchParams.set('_vercel_share',token);
  const chrome=await launcher.launch({chromePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',chromeFlags:['--headless=new','--no-first-run','--disable-extensions']});
  try{
   const {lhr}=await lighthouse(url.href,{port:chrome.port,logLevel:'error',onlyCategories:['performance','accessibility','best-practices','seo']});
   if(lhr.runtimeError)throw Error(lhr.runtimeError.code);
   const final=new URL(lhr.finalDisplayedUrl);if(final.origin!==origin||final.pathname!==path)throw Error('Unexpected protected Preview destination');
   const clean=JSON.parse(JSON.stringify(lhr).replaceAll(token,'[redacted]').replaceAll(encodeURIComponent(token),'[redacted]'));
   await writeFile(`${out}/${template}-${run}.json`,JSON.stringify(clean));
   const row={template,run,at:lhr.fetchTime,url:origin+path,performance:lhr.categories.performance.score*100,
    lcp:lhr.audits['largest-contentful-paint'].numericValue,tbt:lhr.audits['total-blocking-time'].numericValue,cls:lhr.audits['cumulative-layout-shift'].numericValue,
    benchmarkIndex:lhr.environment.benchmarkIndex,
    lcpNode:lhr.audits['lcp-breakdown-insight']?.details?.items?.find(x=>x.type==='node')?.snippet,
    breakdown:lhr.audits['lcp-breakdown-insight']?.details?.items?.find(x=>x.type==='table')?.items,
    imageBytes:lhr.audits['network-requests'].details.items.filter(r=>r.resourceType==='Image').reduce((n,r)=>n+r.transferSize,0),
    failed:lhr.audits['network-requests'].details.items.filter(r=>r.failed).map(r=>({url:r.url.split('?')[0],status:r.statusCode}))};
   results.push(row);await writeFile(out+'/samples.json',JSON.stringify(results,null,2));console.log(JSON.stringify({label,...row}));
  }finally{await chrome.kill();}
 }
 const medians=Object.keys(routes).map(template=>{const group=results.filter(r=>r.template===template);return {template,...Object.fromEntries(['performance','lcp','tbt','cls','imageBytes'].map(k=>[k,{median:median(group.map(r=>r[k])),min:Math.min(...group.map(r=>r[k])),max:Math.max(...group.map(r=>r[k]))}]))};});
 await writeFile(out+'/medians.json',JSON.stringify({label,origin,conditions:'Lighthouse13.6 simulatedmobile412x823/DPR1.75,4xCPU,150msRTT; isolatedprofileeachrun; sequential; same test DB; authenticated deployment access only, app guest; CDN warmth not cleared; lab only',medians},null,2));
 console.log('LIGHTHOUSE_COMPLETE '+label);
}
if(selected.includes('hosted-candidate'))await unlink('outputs/seo-reliability-20261107/private-preview-access.json');
