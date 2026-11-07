// Explicit read-only acceptor. Uses existing official Vercel CLI authentication.
import fs from 'node:fs/promises';
import {spawn} from 'node:child_process';
import assert from 'node:assert/strict';
const origin=process.argv[2],cli=process.argv[3];
assert.match(origin??'',/^https:\/\/lumiscore-[a-z0-9]+-rgkgroeneveld-9102\.vercel\.app$/);
assert(cli,'Pass the installed official Vercel CLI entry point');
const dir='catalog/verified-synopses-20261107/',out='outputs/verified-synopses-20261107/preview-http';
const review=JSON.parse(await fs.readFile(dir+'summary-review.json','utf8'));
const map=JSON.parse(await fs.readFile(dir+'fixture-map.json','utf8'));
await fs.mkdir(out,{recursive:true});
const uas={desktop:'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',googlebot:'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',inspection:'Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)'};
const rows=[];
for(const item of review.items)for(const[ua,userAgent]of Object.entries(uas)){
 const m=map.find(m=>m.productionWorkId===item.workId),path='/'+item.language+'/book/'+m.testWorkId;
 const file=out+'/'+item.workId+'-'+ua+'.html';
 const output=await new Promise((resolve,reject)=>{const p=spawn(process.execPath,[cli,'curl',origin+path,'--','--silent','--show-error','--max-time','35','--user-agent',userAgent,'--output',file,'--write-out','%{http_code} %{time_starttransfer} %{time_total}'],{stdio:['ignore','pipe','pipe'],windowsHide:true});let s='',e='';p.stdout.on('data',b=>s+=b);p.stderr.on('data',b=>e+=b);p.once('error',reject);p.once('exit',c=>c===0?resolve(s.trim()):reject(Error('CLI request failed '+c+' '+e.slice(-250))));});
 const [status,ttfb,total]=output.split(/\s+/).map(Number),html=await fs.readFile(file,'utf8');
 // Full raw response, not text searched only in a hydrated browser DOM.
 const normalized=html.replaceAll('&#x27;',"'").replaceAll('&#39;',"'").replaceAll('&quot;','"').replaceAll('&amp;','&');
 const head=html.slice(0,html.indexOf('</head>'));
 const canonicals=[...head.matchAll(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/g)].map(x=>x[1]);
 const summary=normalized.includes(item.summary.text),source=normalized.includes(item.summary.sourceUrl),canonical=canonicals[0];
 assert.equal(status,200,path);assert(summary,'summary '+path);assert(source,'source '+path);assert.equal(canonicals.length,1,path);assert.equal(canonical,'https://lumisco.re'+path,path);
 assert(!normalized.includes('The description could not be loaded temporarily.'),'no temporary failure '+path);
 rows.push({productionWorkId:item.workId,testWorkId:m.testWorkId,editionId:m.testEditionId,locale:item.language,ua,userAgent,status,summary,source,canonical,canonicalCount:canonicals.length,ttfbMs:ttfb*1000,totalMs:total*1000,file});
 await fs.writeFile(out+'/acceptance.json',JSON.stringify({applicationSha:'ca361835d59cad0dd4b531f32ae4fda000f38267',origin,method:'Original complete HTML through authorized vercel curl. UA simulations, not real Google processing. Preview protection is separate from application metadata.',rows},null,2));
 console.log(item.workId,item.language,ua,status);
}
console.log(JSON.stringify({responses:rows.length,books:review.items.length}));
