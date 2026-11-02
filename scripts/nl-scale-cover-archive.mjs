// Provider-documented bulk archives. Never enumerate or crawl the cover API.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {inflateRawSync} from 'node:zlib';
import {ROOT,readJson} from './nl-scale-snapshot.mjs';
import {locateDirectory,readDirectory} from './nl-scale-zip-directory.mjs';
import {loadReviews} from './nl-scale-reviews.mjs';
import {loadCases} from './nl-scale-case-store.mjs';
const cache=new URL('../.research-cache/nl-scale-20261102/covers/',import.meta.url);
fs.mkdirSync(cache,{recursive:true});
const {cases}=loadCases();
const drafts=[...loadReviews().values()].filter(r=>r.contentStatus==='reviewed_original_draft');
const targets=drafts.map(r=>{const d=cases.find(c=>c.candidateId===r.candidateId);if(!d)throw Error('Unknown reviewed candidate');const e=d.editionReviews.find(e=>e.titleConfirmed&&e.languageConfirmed&&e.authorConfirmed)??d.editionReviews[0];return {candidateId:r.candidateId,editionKey:e.editionKey,isbn13:e.isbn13,title:e.title,coverId:e.coverIds[0],semanticStatus:'not_yet_visually_reviewed',notImportApproval:true}});
if(targets.length>1500||targets.some(t=>!Number.isSafeInteger(t.coverId)||t.coverId<=0))throw Error('Unbounded or invalid cover manifest');
fs.writeFileSync(new URL('cover-review-targets.json',ROOT),JSON.stringify({basis:'Bound source editions of content-reviewed candidates; provisional until actual image identity review',targets},null,2)+'\n');
// Earlier failures remain immutable evidence. Only the previous LOCAL parser stop
// is eligible for the independently tested ZIP64 parser; HTTP failures are not retried.
const previousPath=new URL('cover-archive-readback.json',ROOT);
const previous=fs.existsSync(previousPath)?readJson(previousPath):[];
const localStop='ZIP64 end record requires separately reviewed support; no inference';
const receiptFile=new URL('cover-archive-v2-readback.json',ROOT),receipts=fs.existsSync(receiptFile)?readJson(receiptFile):previous.filter(r=>r.error!==localStop);
let last=0;
async function fetchBounded(url,{range,total,cap=2000000}={}){
 const wait=Math.max(0,1050-(Date.now()-last));if(wait)await new Promise(r=>setTimeout(r,wait));last=Date.now();
 const r=await fetch(url,{headers:{'User-Agent':'LumiScore-public-catalogue-review/20261102 (+https://lumisco.re)',...(range?{Range:'bytes='+range[0]+'-'+range[1]}:{})},signal:AbortSignal.timeout(35000)});
 if([401,403,429].includes(r.status)){await r.body?.cancel();throw Error('ACCESS_STOP '+r.status+' '+new URL(url).hostname);}
 if(range&&(r.status!==206||r.headers.get('content-range')!=='bytes '+range[0]+'-'+range[1]+'/'+total)){const status=r.status,actual=r.headers.get('content-range');await r.body?.cancel();throw Error('Range refused/different: HTTP '+status+', Content-Range '+actual+'; no full-download fallback');}
 if(!r.ok){await r.body?.cancel();throw Error('HTTP '+r.status);}
 const chunks=[];let length=0;
 for await(const c of r.body){length+=c.length;if(length>cap){await r.body?.cancel();throw Error('Source response cap exceeded');}chunks.push(c);}
 if(range&&length!==range[1]-range[0]+1)throw Error('Incomplete range');
 return Buffer.concat(chunks);
}
function crc32(b){let n=0xffffffff;for(const x of b){n^=x;for(let j=0;j<8;j++)n=(n>>>1)^((n&1)?0xedb88320:0);}return(n^0xffffffff)>>>0;}
const groups=new Map();
for(const t of targets){if(receipts.some(r=>r.coverId===t.coverId))continue;const g=String(Math.floor(t.coverId/1000000)).padStart(4,'0'),n=String(Math.floor(t.coverId/10000)%100).padStart(2,'0'),id='covers_'+g,file=id+'_'+n+'.zip';const k=id+'/'+file;const a=groups.get(k)??[];a.push(t);groups.set(k,a);}
for(const [group,ts] of groups){
 const [item,file]=group.split('/'),mf=new URL(item+'-metadata.json',cache);
 const previousFailure=[...previous,...receipts].find(r=>r.url==='https://archive.org/download/'+item+'/'+file&&r.status==='bulk_source_failure_no_retry'&&r.error!==localStop);
 if(previousFailure){
  for(const t of ts)receipts.push({...t,status:'prior_source_failure_no_new_request',sourceFailureReference:previous.includes(previousFailure)?'cover-archive-readback.json':'cover-archive-v2-readback.json',error:previousFailure.error,checkedAt:new Date().toISOString()});
  fs.writeFileSync(receiptFile,JSON.stringify(receipts,null,2)+'\n');continue;
 }
 let metadata;
 if(fs.existsSync(mf))metadata=readJson(mf);
 else{metadata=JSON.parse(await fetchBounded('https://archive.org/metadata/'+item,{cap:4000000}));fs.writeFileSync(mf,JSON.stringify(metadata));}
 const def=metadata.files?.find(f=>f.name===file);
 if(!def){for(const t of ts)receipts.push({...t,status:'bulk_archive_unavailable',archiveItem:item,checkedAt:new Date().toISOString()});fs.writeFileSync(receiptFile,JSON.stringify(receipts,null,2)+'\n');continue;}
 const total=Number(def.size),url='https://archive.org/download/'+item+'/'+file,dirPath=new URL(file+'-directory.json',cache);
 if(!Number.isSafeInteger(total)||total<22||total>10000000000)throw Error('Unreviewed archive size');
 const range=(start,end)=>{if(start<0||end<start||end>=total||end-start>12000000)throw Error('Unbounded ZIP range');return fetchBounded(url,{range:[start,end],total,cap:end-start+1});};
 let directory;
 try{
 if(fs.existsSync(dirPath))directory=readJson(dirPath);
 else{
  const start=Math.max(0,total-65557),tail=await range(start,total-1);
  const {count,size,offset,zip64}=await locateDirectory(tail,start,total,range);
  const bytes=await range(offset,offset+size-1),rows=readDirectory(bytes);if(rows.length!==count)throw Error('ZIP count mismatch');
  directory={url,declaredArchiveSha1:def.sha1,fullArchiveChecksumNotClaimed:true,total,zip64,parser:'PKWARE-APPNOTE-bounded-single-disk-v2',centralDirectorySha256:createHash('sha256').update(bytes).digest('hex'),entries:rows};
  fs.writeFileSync(dirPath,JSON.stringify(directory));
 }
 for(const t of ts){
  const members=directory.entries.filter(e=>new RegExp('(?:^|/)0*'+t.coverId+'\\.jpg$','i').test(e.name));
  if(members.length!==1){receipts.push({...t,status:'exact_archive_member_missing_or_ambiguous',url,checkedAt:new Date().toISOString()});continue;}
  const e=members[0];if(e.flags&1||![0,8].includes(e.method)||e.size>8000000||e.compressed>8000000)throw Error('Unsupported image member');
  const h=await range(e.offset,e.offset+29);if(h.readUInt32LE(0)!==0x04034b50||h.readUInt16LE(6)!==e.flags||h.readUInt16LE(8)!==e.method)throw Error('Local ZIP header differs');
  const nameLength=h.readUInt16LE(26),extraLength=h.readUInt16LE(28),headerLength=nameLength+extraLength;
  if(!nameLength||headerLength>131070||!e.compressed)throw Error('Unbounded local member header');
  const start=e.offset+30+headerLength,payload=await range(e.offset+30,start+e.compressed-1);
  if(payload.subarray(0,nameLength).toString()!==e.name)throw Error('Local ZIP filename differs');
  const raw=payload.subarray(headerLength);
  const b=e.method===8?inflateRawSync(raw,{maxOutputLength:e.size}):raw;
  if(b.length!==e.size||crc32(b)!==e.crc32||b[0]!==255||b[1]!==216)throw Error('Image member checksum/type mismatch');
  fs.writeFileSync(new URL(t.coverId+'.jpg',cache),b);
  receipts.push({...t,status:'archive_bytes_verified_image_decode_and_identity_pending',url,archiveMember:e.name,bytes:b.length,sha256:createHash('sha256').update(b).digest('hex'),crc32:e.crc32,checkedAt:new Date().toISOString()});
  fs.writeFileSync(receiptFile,JSON.stringify(receipts,null,2)+'\n');console.log(JSON.stringify({candidateId:t.candidateId,coverId:t.coverId,bytes:b.length,status:'archive_bytes_verified'}));
 }
 }catch(error){
  if(error.message.startsWith('ACCESS_STOP'))throw error;
  for(const t of ts.filter(t=>!receipts.some(r=>r.coverId===t.coverId)))receipts.push({...t,status:'bulk_source_failure_no_retry',url,error:error.message,checkedAt:new Date().toISOString()});
  console.log(JSON.stringify({group,error:error.message,noRetry:true}));
 }
 fs.writeFileSync(receiptFile,JSON.stringify(receipts,null,2)+'\n');
}
console.log(JSON.stringify({targets:targets.length,uniqueCovers:new Set(targets.map(t=>t.coverId)).size,receipts:receipts.length,noCoverApiRequests:true}));
