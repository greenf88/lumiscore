// Official monthly author export; one bounded download, then offline exact-key extraction.
import fs from 'node:fs';
import {once} from 'node:events';
import {createHash} from 'node:crypto';
import {createGunzip} from 'node:zlib';
import {Transform} from 'node:stream';
import {createInterface} from 'node:readline';
import {ROOT,readJson,localPath,loadSnapshot} from './nl-scale-snapshot.mjs';
const cache=new URL('../.research-cache/nl-scale-20261102/',import.meta.url);
const meta=readJson(new URL('sources/archive-author-metadata.json',ROOT)).files;
if(meta.length!==1||Number(meta[0].size)>800000000)throw Error('Unexpected reviewed export size');
const def=meta[0],file=new URL(def.name,cache),url='https://archive.org/download/ol_dump_2026-09-30/'+def.name;
if(!fs.existsSync(file)){
 const partial=localPath(file)+'.partial';
 if(fs.existsSync(partial))throw Error('Interrupted export needs explicit inspected resume; no duplicate download');
 const r=await fetch(url,{signal:AbortSignal.timeout(900000)});
 if(!r.ok)throw Error('Export HTTP '+r.status+'; no retry');
 const out=fs.createWriteStream(partial);let bytes=0;
 for await(const c of r.body){bytes+=c.length;if(bytes>Number(def.size))throw Error('Response exceeded metadata');if(!out.write(c))await once(out,'drain');}
 out.end();await once(out,'finish');if(bytes!==Number(def.size))throw Error('Incomplete export');fs.renameSync(partial,localPath(file));
}
const works=readJson(new URL('works-extract.json',cache));
const wanted=new Set(works.records.flatMap(x=>(x.record.authors??[]).map(a=>a.author?.key)).filter(Boolean));
for(const a of loadSnapshot().authors)if(a.open_library_id)wanted.add('/authors/'+a.open_library_id.replace('/authors/',''));
const hash=createHash('sha1'),h256=createHash('sha256');let bytes=0,total=0,last=Date.now();const records=[];
const tap=new Transform({transform(c,e,done){bytes+=c.length;hash.update(c);h256.update(c);done(null,c)}});
const lines=createInterface({input:fs.createReadStream(file).pipe(tap).pipe(createGunzip()),crlfDelay:Infinity});
for await(const line of lines){
 total++;const a=line.indexOf('\t'),b=line.indexOf('\t',a+1),key=line.slice(a+1,b);
 if(wanted.has(key)){const cols=line.split('\t'),r=JSON.parse(cols[4]);records.push({record:r,revision:cols[2],modified:cols[3],recordSha256:createHash('sha256').update(JSON.stringify(r)).digest('hex')});}
 if(Date.now()-last>30000){last=Date.now();console.log(JSON.stringify({total,bytes,matched:records.length,wanted:wanted.size}));}
}
if(bytes!==Number(def.size)||hash.digest('hex')!==def.sha1)throw Error('Author export checksum mismatch');
fs.writeFileSync(new URL('authors-extract.json',cache),JSON.stringify({source:{url,sha1:def.sha1,sha256:h256.digest('hex')},checkedAt:new Date().toISOString(),total,records}));
console.log(JSON.stringify({complete:true,matched:records.length,wanted:wanted.size}));
