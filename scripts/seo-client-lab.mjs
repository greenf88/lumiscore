// Official existing project OIDC in memory; origin-scoped interception prevents
// authentication headers reaching external cover providers. No public share link.
import lighthouse from 'file:///C:/Users/rickg/Documents/Codex/2026-09-30/seo-check/.npm-cache-lighthouse/_npx/0f94ee7615faf582/node_modules/lighthouse/core/index.js';
import * as launcher from 'file:///C:/Users/rickg/Documents/Codex/2026-09-30/seo-check/.npm-cache-lighthouse/_npx/0f94ee7615faf582/node_modules/chrome-launcher/dist/index.js';
import puppeteer from 'file:///C:/Users/rickg/Documents/Codex/2026-09-30/seo-check/.npm-cache-lighthouse/_npx/0f94ee7615faf582/node_modules/puppeteer-core/lib/puppeteer/puppeteer-core.js';
import{writeFile,mkdir}from'node:fs/promises';
const token=process.env.VERCEL_OIDC_TOKEN;if(!token)throw Error('Existing ephemeral project OIDC not supplied; no environment-file fallback.');
const candidate=process.argv[2],candidateHead=process.argv[3],applicationSha=process.argv[4],label=process.argv[5]??'bootstrap';
if(!/^https:\/\/lumiscore-[a-z0-9]+-rgkgroeneveld-9102\.vercel\.app$/.test(candidate??'')||![candidateHead,applicationSha].every(v=>/^[a-f0-9]{40}$/.test(v??''))||!/^[a-z0-9-]+$/.test(label))throw Error('Exact Preview, SHAs and proof label required');
const config={baseline:'https://lumiscore-j3yotmfsz-rgkgroeneveld-9102.vercel.app',candidate};
const chromeEnv=Object.fromEntries(['SystemRoot','WINDIR','TEMP','TMP','PATH','LOCALAPPDATA','USERPROFILE','APPDATA','HOME'].filter(k=>process.env[k]).map(k=>[k,process.env[k]]));
for(const key of Object.keys(process.env))if(/TOKEN|SECRET|SUPABASE|DATABASE_URL|POSTGRES_|GOOGLE_BOOKS/.test(key))delete process.env[key];
const out='outputs/seo-client-boundary-20261107/lighthouse-'+label;await mkdir(out,{recursive:true});const rows=[];
try{
 for(const[template,path]of Object.entries({home:'/en',browse:'/en/browse',collection:'/en/collection/dune',book:'/en/book/928100001'}))for(let pair=1;pair<=3;pair++)for(const version of pair%2?['baseline','candidate']:['candidate','baseline']){
  const origin=config[version],chrome=await launcher.launch({chromePath:'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',envVars:chromeEnv,chromeFlags:['--headless=new','--no-first-run','--disable-extensions']});let browser;
  try{browser=await puppeteer.connect({browserURL:'http://127.0.0.1:'+chrome.port});const page=await browser.newPage();await page.setRequestInterception(true);
   page.on('request',request=>{if(request.isInterceptResolutionHandled())return;const headers={...request.headers()};delete headers['x-vercel-trusted-oidc-idp-token'];if(new URL(request.url()).origin===origin)headers['x-vercel-trusted-oidc-idp-token']=token;void request.continue({headers}).catch(()=>{});});
   const{lhr}=await lighthouse(origin+path,{logLevel:'error',onlyCategories:['performance']},undefined,page);
   if(lhr.runtimeError||new URL(lhr.finalDisplayedUrl).origin!==origin||new URL(lhr.finalDisplayedUrl).pathname!==path)throw Error('Invalid protected lab response');
   const requests=lhr.audits['network-requests'].details.items,scripts=requests.filter(r=>r.resourceType==='Script'&&r.url.startsWith(origin)),legacyLoaded=scripts.some(r=>r.url.includes('LegacyReviewedCover'));
   if(version==='candidate'&&legacyLoaded)throw Error('Bound catalogue unexpectedly loaded legacy registry');
   const row={template,pair,version,at:lhr.fetchTime,url:origin+path,performance:lhr.categories.performance.score*100,lcp:lhr.audits['largest-contentful-paint'].numericValue,tbt:lhr.audits['total-blocking-time'].numericValue,cls:lhr.audits['cumulative-layout-shift'].numericValue,benchmarkIndex:lhr.environment.benchmarkIndex,scriptBytes:scripts.reduce((n,r)=>n+r.transferSize,0),imageBytes:requests.filter(r=>r.resourceType==='Image').reduce((n,r)=>n+r.transferSize,0),legacyLoaded,lcpNode:lhr.audits['lcp-breakdown-insight']?.details?.items?.find(x=>x.type==='node')?.snippet,phases:lhr.audits['lcp-breakdown-insight']?.details?.items?.find(x=>x.type==='table')?.items};
   rows.push(row);await writeFile(`${out}/${template}-${pair}-${version}.json`,JSON.stringify(lhr).replaceAll(token,'[redacted]').replaceAll(encodeURIComponent(token),'[redacted]'));await writeFile(out+'/samples.json',JSON.stringify(rows,null,2));console.log(JSON.stringify(row));
  }finally{if(browser)await browser.disconnect();await chrome.kill();}
 }
 const median=a=>[...a].sort((a,b)=>a-b)[Math.floor(a.length/2)],medians=[];
 for(const template of['home','browse','collection','book'])for(const version of['baseline','candidate']){const group=rows.filter(r=>r.template===template&&r.version===version);medians.push({template,version,...Object.fromEntries(['performance','lcp','tbt','cls','scriptBytes','imageBytes'].map(k=>[k,{median:median(group.map(r=>r[k])),min:Math.min(...group.map(r=>r[k])),max:Math.max(...group.map(r=>r[k]))}]))});}
 await writeFile(out+'/medians.json',JSON.stringify({baselineHead:'13f4d661acc5edfa339e534cb30bd9777652a016',candidateHead,applicationSha,conditions:'LH13.6,412x823/DPR1.75,simulated4xCPU/150msRTT/1638kbps,fresh profile,alternated,same TEST DB,app guest,CDN not cleared,no concurrent local build/tests. Origin-scoped request interception on BOTH versions, ephemeral existing project development OIDC in memory only; no sharing/security change. Lab only.',medians},null,2));console.log('CLIENT_LAB_COMPLETE');
}catch(error){console.error(String(error).replaceAll(token,'[redacted]'));process.exitCode=1;}
