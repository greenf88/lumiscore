// Additional provider-documented LARGE ZIP members. Reuses the reviewed ZIP64 parser.
// No cover API crawling, full archive downloads, or automatic identity approval.
import fs from 'node:fs';import{createHash}from'node:crypto';import{inflateRawSync}from'node:zlib';
import{ROOT,readJson}from'./nl-scale-snapshot.mjs';import{locateDirectory,readDirectory}from'./nl-scale-zip-directory.mjs';
const cache=new URL('../.research-cache/nl-scale-20261102/covers/',import.meta.url),input=readJson(new URL('cover-large-zip-request.json',ROOT));
const targets=input.targets;if(!targets.length||targets.length>100||new Set(targets.map(t=>t.coverId)).size!==targets.length||targets.some(t=>!Number.isSafeInteger(t.coverId)||![13,14].includes(Math.floor(t.coverId/1000000))||!t.candidateId||!t.editionKey))throw Error('Exact bounded reviewed target manifest required');
const file=new URL('cover-large-zip-readback.json',ROOT),done=fs.existsSync(file)?readJson(file):[];
if(done.some(r=>r.status==='access_stop'))throw Error('Recorded access stop; no further requests');
let last=0;async function request(url,start,end,total){const delay=Math.max(0,1250-(Date.now()-last));if(delay)await new Promise(r=>setTimeout(r,delay));last=Date.now();
 if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start<0||end<start||end>=total||end-start>12000000)throw Error('Unbounded range');
 const r=await fetch(url,{headers:{'User-Agent':'LumiScore-CatalogReview/20261102 (OpenAI Codex GPT-6; +https://lumisco.re)',Range:`bytes=${start}-${end}`},signal:AbortSignal.timeout(25000)});
 if([401,403,429].includes(r.status)){await r.body?.cancel();throw Error('ACCESS_STOP '+r.status);}
 if(r.status!==206||r.headers.get('content-range')!==`bytes ${start}-${end}/${total}`){await r.body?.cancel();throw Error('HTTP/range mismatch '+r.status+'; no full-download fallback');}
 const chunks=[];let n=0;for await(const b of r.body){n+=b.length;if(n>end-start+1){await r.body?.cancel();throw Error('Response cap');}chunks.push(b);}if(n!==end-start+1)throw Error('Short range');return Buffer.concat(chunks);
}
function crc32(b){let n=0xffffffff;for(const x of b){n^=x;for(let j=0;j<8;j++)n=(n>>>1)^((n&1)?0xedb88320:0);}return(n^0xffffffff)>>>0;}
const groups=new Map();for(const t of targets.filter(t=>!done.some(r=>r.coverId===t.coverId))){const item='l_covers_'+String(Math.floor(t.coverId/1000000)).padStart(4,'0'),name=item+'_'+String(Math.floor(t.coverId/10000)%100).padStart(2,'0')+'.zip',k=item+'/'+name;groups.set(k,[...(groups.get(k)??[]),t]);}
for(const[group,ts]of groups){const[item,name]=group.split('/'),meta=readJson(new URL(item+'-new-metadata.json',cache));
 if(meta.id!==item||meta.title!=='Open Library Cover Archive'||!meta.collection.includes('ol_exports')||meta.is_dark||meta.nodownload||!meta.sourceSha256)throw Error('Official public metadata not verified');
 const def=meta.files.find(f=>f.name===name),url='https://archive.org/download/'+item+'/'+name;
 try{if(!def||def.private||!def.sha1)throw Error('Public checksummed archive absent');const total=Number(def.size);if(!Number.isSafeInteger(total)||total<22||total>10000000000)throw Error('Unbounded archive');
  const path=new URL(name+'-directory.json',cache),range=(a,z)=>request(url,a,z,total);let dir;
  if(fs.existsSync(path)){dir=readJson(path);if(dir.url!==url||dir.total!==total||dir.declaredArchiveSha1!==def.sha1)throw Error('Cached directory drift');}
  else{const start=Math.max(0,total-65557),tail=await range(start,total-1),{count,size,offset,zip64}=await locateDirectory(tail,start,total,range),raw=await range(offset,offset+size-1),entries=readDirectory(raw);if(entries.length!==count)throw Error('Directory count');dir={url,total,zip64,declaredArchiveSha1:def.sha1,centralDirectorySha256:createHash('sha256').update(raw).digest('hex'),entries,fullArchiveChecksumNotClaimed:true};fs.writeFileSync(path,JSON.stringify(dir));}
  for(const t of ts){const xs=dir.entries.filter(e=>new RegExp('(?:^|/)0*'+t.coverId+'-L\\.jpg$','i').test(e.name));if(xs.length!==1)throw Error('Exact LARGE member absent/ambiguous');const e=xs[0];if(e.flags&1||![0,8].includes(e.method)||e.size<100||e.size>8000000||e.compressed>8000000)throw Error('Unsupported member');
   const h=await range(e.offset,e.offset+29);if(h.readUInt32LE(0)!==0x04034b50||h.readUInt16LE(6)!==e.flags||h.readUInt16LE(8)!==e.method)throw Error('Member header differs');const n=h.readUInt16LE(26),extra=h.readUInt16LE(28),header=n+extra;if(!n||header>131070||!e.compressed)throw Error('Unbounded header');
   const start=e.offset+30+header,payload=await range(e.offset+30,start+e.compressed-1);if(payload.subarray(0,n).toString()!==e.name)throw Error('Member name differs');const raw=payload.subarray(header),bytes=e.method===8?inflateRawSync(raw,{maxOutputLength:e.size}):raw;if(bytes.length!==e.size||crc32(bytes)!==e.crc32||bytes[0]!==255||bytes[1]!==216)throw Error('Member checksum/type differs');
   fs.writeFileSync(new URL(t.coverId+'-large.jpg',cache),bytes);done.push({...t,status:'large_zip_bytes_verified_decode_and_identity_pending',url,archiveMember:e.name,metadataSha256:meta.sourceSha256,centralDirectorySha256:dir.centralDirectorySha256,archiveSha1:def.sha1,fullArchiveChecksumNotClaimed:true,bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),checkedAt:new Date().toISOString()});fs.writeFileSync(file,JSON.stringify(done,null,2)+'\n');console.log(JSON.stringify({cover:t.coverId,bytes:bytes.length}));
  }
 }catch(error){if(error.message.startsWith('ACCESS_STOP')){done.push({status:'access_stop',url,error:error.message,checkedAt:new Date().toISOString()});fs.writeFileSync(file,JSON.stringify(done,null,2)+'\n');throw error;}for(const t of ts.filter(t=>!done.some(r=>r.coverId===t.coverId)))done.push({...t,status:'new_large_zip_source_failure_no_retry',url,error:error.message,checkedAt:new Date().toISOString()});fs.writeFileSync(file,JSON.stringify(done,null,2)+'\n');console.log(JSON.stringify({group,error:error.message,noRetry:true}));}
}
console.log(JSON.stringify({targets:targets.length,receipts:done.length,noCoverApiRequests:true}));
