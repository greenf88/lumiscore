// Offline bulk source verification; never connects to a database or applies a batch.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createGunzip} from 'node:zlib';
import {Transform,Readable} from 'node:stream';
import {createInterface} from 'node:readline';
import {digest} from './catalog-batch-core.mjs';
export const EDITION_DUMP={url:'https://archive.org/download/ol_dump_2026-09-30/ol_dump_editions_2026-09-30.txt.gz',bytes:12617475043,sha1:'c2b534d524ba7de1b7161574da00b3ffb51d2d69'};
export const WORK_DUMP={url:'https://archive.org/download/ol_dump_2026-09-30/ol_dump_works_2026-09-30.txt.gz',bytes:4073320823,sha1:'b5492661c5ce6d62aae87e1c14945d22826ee26b'};
export function minimalWork(w){return {key:w.key,title:w.title,authors:w.authors??[],first_publish_date:w.first_publish_date??null};}
export function minimalEdition(e){
 return {key:e.key,title:e.title,works:e.works,authors:e.authors,isbn_13:e.isbn_13??[],isbn_10:e.isbn_10??[],languages:e.languages??[],physical_format:e.physical_format??null,number_of_pages:e.number_of_pages??null,publishers:e.publishers??[],covers:(e.covers??[]).filter(x=>Number.isInteger(x)&&x>0)};
}
export async function scanEditionDump(file,candidates,{onProgress=()=>{},followDownload=false,workDump=false}={}){
 const definition=workDump?WORK_DUMP:EDITION_DUMP;
 const size=fs.statSync(file).size;
 if(size>definition.bytes||size!==definition.bytes&&!followDownload)throw Error('OFFICIAL_DUMP_INCOMPLETE');
 const wanted=new Set(candidates.map(c=>workDump?'/works/'+c.work_id:'/books/'+c.edition_id)),records=new Map(),h1=createHash('sha1'),h256=createHash('sha256');let bytes=0,lines=0,last=Date.now();
 const hashed=new Transform({transform(chunk,encoding,done){bytes+=chunk.length;h1.update(chunk);h256.update(chunk);done(null,chunk);}});
 async function* growingFile(){
  const handle=await fs.promises.open(file,'r');let offset=0,stalled=Date.now();
  try{while(offset<definition.bytes){const buffer=Buffer.allocUnsafe(Math.min(524288,definition.bytes-offset));const result=await handle.read(buffer,0,buffer.length,offset);if(result.bytesRead){offset+=result.bytesRead;stalled=Date.now();yield buffer.subarray(0,result.bytesRead);}else{if(Date.now()-stalled>180000)throw Error('DUMP_DOWNLOAD_STALLED');await new Promise(r=>setTimeout(r,1000));}}}finally{await handle.close();}
 }
 const source=followDownload?Readable.from(growingFile()):fs.createReadStream(file),stream=source.pipe(hashed).pipe(createGunzip());
 source.on('error',error=>stream.destroy(error));hashed.on('error',error=>stream.destroy(error));
 const input=createInterface({input:stream,crlfDelay:Infinity});
 try{
  for await(const line of input){
   lines++;const first=line.indexOf('\t'),second=line.indexOf('\t',first+1);const key=line.slice(first+1,second);
   if(wanted.has(key)){const columns=line.split('\t');const e=JSON.parse(columns[4]);if(e.key!==key||records.has(key))throw Error('DUMP_KEY_OR_REVISION_AMBIGUOUS');records.set(key,{revision:Number(columns[2]),modified:columns[3],record:workDump?minimalWork(e):minimalEdition(e)});}
   if(Date.now()-last>30000){last=Date.now();onProgress({compressed_bytes:bytes,lines,matched:records.size});}
  }
 }finally{input.close();source.destroy();hashed.destroy();stream.destroy();}
 const sha1=h1.digest('hex'),sha256=h256.digest('hex');if(bytes!==definition.bytes||sha1!==definition.sha1)throw Error('OFFICIAL_DUMP_HASH_MISMATCH');
 return {source:{...definition,sha256,lines},[workDump?'works':'editions']:[...records.values()].map(e=>({...e,record_sha256:digest(e.record)}))};
}
