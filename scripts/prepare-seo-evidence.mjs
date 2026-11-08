import{readFile,writeFile,mkdir,readdir}from'node:fs/promises';import{createHash}from'node:crypto';import{execFileSync}from'node:child_process';
const source='outputs/seo-reliability-20261107',out='docs/seo-reliability-20261107',app='4eb8b724153dfddd28094fd23307fa9a9d807a71',measuredApp='63a1902aca4113c28380d4a8128ffda101ccbab2',base='6009f2c0c6ed9c3b086fe73db9daee3fe23c3cdc';
await mkdir(out,{recursive:true});const hash=b=>createHash('sha256').update(b).digest('hex'),json=async p=>JSON.parse(await readFile(source+'/'+p,'utf8'));
const write=async(name,data)=>writeFile(out+'/'+name,JSON.stringify(data,null,2)+'\n');
for(const[from,to]of [['selection.json','selection.json'],['browser/matrix.json','browser-matrix.json'],['hosted-http/matrix.json','hosted-head-matrix.json'],['readonly-http/matrix.json','readonly-head-matrix.json'],['lighthouse-hosted-baseline/medians.json','lighthouse-before.json'],['lighthouse-hosted-final/medians.json','lighthouse-after.json'],['lighthouse-paired/samples.json','lighthouse-paired-samples.json']])await write(to,await json(from));
await write('optimizer-http-receipt.json',await json('cover-http/receipt.json'));
await write('optimizer-decoded.json',await json('cover-http/decoded.json'));
for(const[file,name]of [['built-browse.json','built-browse-summary.json'],['readonly-test-pagination.json','readonly-pagination-summary.json']]){
 const d=await json(file);await write(name,{...d,runs:d.runs.map(r=>({concurrency:r.concurrency,pages:r.pages,books:r.books??r.total,unique:r.unique,empty200:r.empty200})),fullLocalProof:{path:source+'/'+file,sha256:hash(await readFile(source+'/'+file))}});
}
const audit=JSON.parse((await readFile('C:/Users/rickg/Documents/Codex/2026-09-30/seo-check/work/crawl-results-lumiscore-2026-11-07.json','utf8')).replace(/^\uFEFF/,''));
const short=audit.pages.filter(p=>p.indexable_by_page_signals&&p.description_length>0&&p.description_length<70);
await write('short-description-decisions.json',{auditDate:'2026-11-07',total:short.length,rows:short.map(p=>({url:p.final_url,description:p.description,length:p.description_length,decision:p.page_type!=='collection'?'template_improved':p.final_url.includes('geef-me-de-ruimte')||p.final_url.includes('kinderen-van-moeder-aarde')?'localized_source_copy_followup':'retain_concise_specific_context'}))});
const samples=await json('lighthouse-hosted-final/samples.json');const checks=[];
for(const s of samples){const raw=await json(`lighthouse-hosted-final/${s.template}-${s.run}.json`),images=raw.audits['network-requests'].details.items.filter(r=>r.resourceType==='Image'&&r.transferSize>0),duplicates=[];const seen=new Set();for(const r of images){if(seen.has(r.url))duplicates.push(r.url);seen.add(r.url);}checks.push({...s,duplicateTransferredImageUrls:duplicates});}
await write('performance-phases.json',{applicationSha:measuredApp,meaning:'Raw trace phases differ from Lighthouse simulated score. Retain every run; duplicate detection counts identical transferred Image URLs, not proof of every possible rendition identity.',rows:checks});
const names=execFileSync('git',['diff','--name-only',base,app,'--','app','lib','server','vite.config.ts','package.json','pnpm-lock.yaml','docs/proposals'],{encoding:'utf8'}).trim().split(/\r?\n/).filter(Boolean);
const files=names.map(path=>({path,sha256:hash(execFileSync('git',['show',app+':'+path],{maxBuffer:10000000}))}));
await write('application-hashes.json',{applicationSha:app,baseSha:base,method:'SHA256 of exact Git blobs, not platform line-ending worktree bytes',files});
const proofs=[];for(const name of(await readdir(out)).filter(n=>n!=='evidence-manifest.json')){const b=await readFile(out+'/'+name);proofs.push({path:out+'/'+name,bytes:b.length,sha256:hash(b)});}
await write('evidence-manifest.json',{applicationSha:app,proofs});console.log(JSON.stringify({applicationSha:app,sourceFiles:files.length,proofs:proofs.length,shortDescriptions:short.length,duplicateTransferredImages:checks.reduce((n,r)=>n+r.duplicateTransferredImageUrls.length,0)}));
