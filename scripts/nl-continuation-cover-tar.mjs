// Documented LARGE-cover TAR alternative for42 IDs whose original-cover item is absent.
// Distinct provider bulk dataset, never a cover-API crawl or access-denial workaround.
import fs from'node:fs';import{createHash}from'node:crypto';import{ROOT,CACHE}from'./nl-continuation-bootstrap.mjs';const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
import{parseLargeCoverIndex}from'../../lumiscore-nl-expansion-scale-20261102/scripts/nl-scale-large-cover-index.mjs';
const cache=new URL('archive-covers/',CACHE),prior=readJson(new URL('cover-archive-v2-readback.json',ROOT));
const phase=process.argv[2];if(phase&&!/^\d{3}$/.test(phase))throw Error('Explicit bounded cover phase required');
const targets=phase?readJson(new URL('cover-large-bulk-request-'+phase+'.json',ROOT)).targets:prior.filter(r=>r.status==='bulk_archive_unavailable'&&Math.floor(r.coverId/1000000)===6);
if(targets.some(t=>Math.floor(t.coverId/1000000)!==6||!t.candidateId||!t.editionKey))throw Error('Only exact group-six editions supported');
if(!targets.length||targets.length>100||new Set(targets.map(t=>t.coverId)).size!==targets.length)throw Error('Explicit unique bounded target set required');
const item='l_covers_0006',m=readJson(new URL(item+'-new-metadata.json',cache));
if(m.title!==item||!m.collection.includes('ol_exports')||m.is_dark||m.nodownload)throw Error('Not an available official OpenLibrary bulk item');
// V1 stopped on a LOCAL parser assumption (missing -L suffix). Keep its evidence,
// reuse checksummed cached indexes; no failed network request is retried.
const file=new URL(phase?'cover-large-bulk-readback-'+phase+'.json':'cover-large-bulk-v2-readback.json',ROOT),old=new URL('cover-large-bulk-readback.json',ROOT),done=fs.existsSync(file)?readJson(file):!phase&&fs.existsSync(old)?readJson(old).filter(r=>r.error!=='Unknown index format'):[];let last=0;
if(done.some(r=>r.status==='access_stop'))throw Error('Recorded source access stop; no request');
async function request(url,{range,total,cap=1000000}={}){const delay=Math.max(0,1200-(Date.now()-last));if(delay)await new Promise(r=>setTimeout(r,delay));last=Date.now();
 const r=await fetch(url,{headers:{'User-Agent':'LumiScore-CatalogReview/20261103 (OpenAI Codex GPT-6; +https://lumisco.re)',...(range?{Range:'bytes='+range[0]+'-'+range[1]}:{})},signal:AbortSignal.timeout(25000)});
 if([401,403,429].includes(r.status)){await r.body?.cancel();throw Error('ACCESS_STOP '+r.status);}
 if(!r.ok||range&&(r.status!==206||r.headers.get('content-range')!==`bytes ${range[0]}-${range[1]}/${total}`)){await r.body?.cancel();throw Error('HTTP/range mismatch '+r.status+'; no retry or full-download fallback');}
 const chunks=[];let n=0;for await(const b of r.body){n+=b.length;if(n>cap)throw Error('Bounded response exceeded');chunks.push(b);}if(range&&n!==range[1]-range[0]+1)throw Error('Short range');return Buffer.concat(chunks);
}
const groups=new Map();for(const t of targets.filter(t=>!done.some(x=>x.coverId===t.coverId))){const stem=item+'_'+String(Math.floor(t.coverId/10000)%100).padStart(2,'0');const g=groups.get(stem)??[];g.push(t);groups.set(stem,g);}
for(const[stem,ts]of groups){const index=m.files.find(f=>f.name===stem+'.index'),tar=m.files.find(f=>f.name===stem+'.tar');
 try{if(!index||!tar||index.private||tar.private||Number(index.size)>1000000||!index.sha1)throw Error('Public checksummed index/TAR absent');
  const ip=new URL(index.name,cache),ib=fs.existsSync(ip)?fs.readFileSync(ip):await request('https://archive.org/download/'+item+'/'+index.name);
  if(ib.length!==Number(index.size)||createHash('sha1').update(ib).digest('hex')!==index.sha1)throw Error('Index checksum mismatch');fs.writeFileSync(ip,ib);
  const entries=parseLargeCoverIndex(ib.toString());
  for(const t of ts){const xs=entries.filter(e=>e.coverId===t.coverId);if(xs.length!==1)throw Error('Exact member missing/ambiguous');const e=xs[0],total=Number(tar.size);
   if(!Number.isSafeInteger(total)||e.offset<512||e.offset%512||e.length<100||e.length>1000000||e.offset+e.length>total)throw Error('Unbounded member');
   const url='https://archive.org/download/'+item+'/'+tar.name,b=await request(url,{range:[e.offset-512,e.offset+e.length-1],total,cap:e.length+512}),h=b.subarray(0,512);
   const oct=(a,z)=>{const s=h.subarray(a,z).toString().replaceAll('\0','').trim();if(!/^[0-7]+$/.test(s))throw Error('Malformed header');return parseInt(s,8);};
   const name=h.subarray(0,100).toString().split('\0')[0],sum=[...h].reduce((n,c,i)=>n+(i>=148&&i<156?32:c),0);
   if(name!==e.name||oct(124,136)!==e.length||oct(148,156)!==sum||![0,48].includes(h[156]))throw Error('TAR member identity/size/checksum mismatch');
   const image=b.subarray(512);if(image[0]!==255||image[1]!==216)throw Error('Not a JPEG; no image inference');
   fs.writeFileSync(new URL(t.coverId+'-large.jpg',cache),image);done.push({...t,originalSourceStatus:t.status,status:'large_bulk_member_verified_decode_and_identity_pending',url,archiveMember:e.name,indexSha1:index.sha1,metadataSha256:m.sourceSha256,bytes:image.length,sha256:createHash('sha256').update(image).digest('hex'),checkedAt:new Date().toISOString(),fullArchiveChecksumNotClaimed:true});
   fs.writeFileSync(file,JSON.stringify(done,null,2)+'\n');console.log(JSON.stringify({coverId:t.coverId,bytes:image.length}));
  }
 }catch(error){if(error.message.startsWith('ACCESS_STOP')){done.push({status:'access_stop',error:error.message,checkedAt:new Date().toISOString()});fs.writeFileSync(file,JSON.stringify(done,null,2)+'\n');throw error;}if(error.message.includes('index format')||error.message.includes('index integer'))throw error;for(const t of ts.filter(t=>!done.some(x=>x.coverId===t.coverId)))done.push({...t,status:'large_bulk_source_failure_no_retry',error:error.message,checkedAt:new Date().toISOString()});fs.writeFileSync(file,JSON.stringify(done,null,2)+'\n');console.log(JSON.stringify({stem,error:error.message}));}
}
console.log(JSON.stringify({targets:targets.length,receipts:done.length,noCoverApiRequests:true}));
