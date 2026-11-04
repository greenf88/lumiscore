// Source supplies a checksummed member index: name, data offset, byte length.
// Read only exact reviewed members of its official bulk TAR; no cover-API crawl.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ROOT,readJson} from './nl-scale-snapshot.mjs';
const cache=new URL('../.research-cache/nl-scale-20261102/covers/',import.meta.url);
fs.mkdirSync(cache,{recursive:true});
const cases=fs.readFileSync(new URL('../.research-cache/nl-scale-20261102/research-cases.jsonl',import.meta.url),'utf8').trim().split('\n').map(JSON.parse);
const drafts=fs.readdirSync(ROOT).filter(f=>/^content-review-\d+\.json$/.test(f)).flatMap(f=>readJson(new URL(f,ROOT)).entries).filter(r=>r.contentStatus==='reviewed_original_draft');
const targets=drafts.map(r=>{const d=cases.find(c=>c.candidateId===r.candidateId);const e=d.editionReviews.find(e=>e.titleConfirmed&&e.languageConfirmed&&e.authorConfirmed)??d.editionReviews[0];return {candidateId:r.candidateId,editionKey:e.editionKey,isbn13:e.isbn13,title:e.title,coverId:e.coverIds[0],semanticStatus:'not_yet_visually_reviewed',notImportApproval:true}});
if(targets.length>1500||targets.some(t=>!Number.isSafeInteger(t.coverId)||t.coverId<=0))throw Error('Unbounded member manifest');
fs.writeFileSync(new URL('cover-review-targets.json',ROOT),JSON.stringify({basis:'Exact provisional printed editions of content-reviewed candidates; no automatic identity approval',targets},null,2)+'\n');
const prior=readJson(new URL('cover-archive-readback.json',ROOT));
const donePath=new URL('cover-tar-readback.json',ROOT),done=fs.existsSync(donePath)?readJson(donePath):[];
let last=0;
async function request(url,{start,end,total,cap=4000000}={}){
 const wait=Math.max(0,1100-(Date.now()-last));if(wait)await new Promise(r=>setTimeout(r,wait));last=Date.now();
 const r=await fetch(url,{headers:{'User-Agent':'LumiScore-public-catalogue-review/20261102 (+https://lumisco.re)',...(start==null?{}:{Range:'bytes='+start+'-'+end})},signal:AbortSignal.timeout(35000)});
 if([401,403,429].includes(r.status)){await r.body?.cancel();throw Error('ACCESS_STOP '+r.status);}
 if(start!=null&&(r.status!==206||r.headers.get('content-range')!=='bytes '+start+'-'+end+'/'+total)){const status=r.status,actual=r.headers.get('content-range');await r.body?.cancel();throw Error('TAR range differs: HTTP '+status+', Content-Range '+actual+', expected bytes '+start+'-'+end+'/'+total);}
 if(!r.ok){await r.body?.cancel();throw Error('HTTP '+r.status);}
 const cs=[];let bytes=0;for await(const c of r.body){bytes+=c.length;if(bytes>cap)throw Error('Response cap exceeded');cs.push(c);}
 if(start!=null&&bytes!==end-start+1)throw Error('Incomplete TAR range');
 return Buffer.concat(cs);
}
const groups=new Map();
for(const t of targets){
 if(done.some(r=>r.coverId===t.coverId)||prior.some(r=>r.coverId===t.coverId&&r.status==='archive_bytes_verified_image_decode_and_identity_pending'))continue;
 const item='covers_'+String(Math.floor(t.coverId/1000000)).padStart(4,'0'),chunk=String(Math.floor(t.coverId/10000)%100).padStart(2,'0'),group=item+'/'+item+'_'+chunk;
 const xs=groups.get(group)??[];xs.push(t);groups.set(group,xs);
}
for(const [group,ts] of groups){
 const [item,stem]=group.split('/');
 const mp=new URL(item+'-metadata.json',cache);let m;
 if(fs.existsSync(mp))m=readJson(mp);else{m=JSON.parse(await request('https://archive.org/metadata/'+item));fs.writeFileSync(mp,JSON.stringify(m));}
 const idx=m.files?.find(f=>f.name===stem+'.index'),tar=m.files?.find(f=>f.name===stem+'.tar');
 if(!idx||!tar){for(const t of ts)done.push({...t,status:'indexed_bulk_source_unavailable',item,checkedAt:new Date().toISOString()});fs.writeFileSync(donePath,JSON.stringify(done,null,2)+'\n');continue;}
 try{
  if(Number(idx.size)>1000000||!idx.sha1||!Number.isSafeInteger(Number(tar.size)))throw Error('Unexpected index/metadata');
  const ip=new URL(idx.name,cache);let ib=fs.existsSync(ip)?fs.readFileSync(ip):null;
  if(!ib){ib=await request('https://archive.org/download/'+item+'/'+idx.name,{cap:1000000});fs.writeFileSync(ip,ib);}
  if(ib.length!==Number(idx.size)||createHash('sha1').update(ib).digest('hex')!==idx.sha1)throw Error('Index checksum mismatch');
  const rows=ib.toString().trim().split('\n').map(line=>{const [name,offset,length,...rest]=line.trim().split('\t');if(rest.length||!/^\d+\.jpg$/.test(name)||!/^\d+$/.test(offset)||!/^\d+$/.test(length))throw Error('Unknown index schema');return {name,offset:Number(offset),length:Number(length)};});
  const url='https://archive.org/download/'+item+'/'+tar.name;
  for(const t of ts){
   const xs=rows.filter(r=>Number(r.name.replace('.jpg',''))===t.coverId);if(xs.length!==1)throw Error('Exact member absent/ambiguous');
   const e=xs[0];if(e.offset<512||e.offset%512||e.length<=100||e.length>8000000||e.offset+e.length>Number(tar.size))throw Error('Unbounded TAR image');
   const b=await request(url,{start:e.offset-512,end:e.offset+e.length-1,total:Number(tar.size),cap:e.length+512});
   const h=b.subarray(0,512),name=h.subarray(0,100).toString().split('\0')[0];
   const octal=(a,z)=>{const s=h.subarray(a,z).toString().replace(/\0/g,'').trim();if(!/^[0-7]+$/.test(s))throw Error('Invalid octal header');return parseInt(s,8);};
   const size=octal(124,136),checksum=octal(148,156),sum=[...h].reduce((n,c,i)=>n+(i>=148&&i<156?32:c),0);
   if(name!==e.name||size!==e.length||sum!==checksum||![0,48].includes(h[156]))throw Error('TAR header identity/size/checksum mismatch');
   const image=b.subarray(512);if(image[0]!==255||image[1]!==216)throw Error('Not a JPEG member');
   fs.writeFileSync(new URL(t.coverId+'.jpg',cache),image);
   done.push({...t,status:'archive_bytes_verified_image_decode_and_identity_pending',url,sourceIndex:idx.name,indexSha1:idx.sha1,archiveMember:e.name,offset:e.offset,bytes:e.length,sha256:createHash('sha256').update(image).digest('hex'),fullArchiveChecksumNotClaimed:true,checkedAt:new Date().toISOString()});
   fs.writeFileSync(donePath,JSON.stringify(done,null,2)+'\n');console.log(JSON.stringify({coverId:t.coverId,bytes:e.length,indexedTarVerified:true}));
  }
 }catch(error){
  if(error.message.startsWith('ACCESS_STOP'))throw error;
  for(const t of ts.filter(t=>!done.some(r=>r.coverId===t.coverId)))done.push({...t,status:'indexed_bulk_source_failure_no_retry',item,error:error.message,checkedAt:new Date().toISOString()});
  fs.writeFileSync(donePath,JSON.stringify(done,null,2)+'\n');console.log(JSON.stringify({group,error:error.message,noRetry:true}));
 }
}
console.log(JSON.stringify({targets:targets.length,recordedTarResults:done.length,noCoverApiRequests:true}));
