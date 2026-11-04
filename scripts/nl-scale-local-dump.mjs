// Offline reuse of the existing verified monthly dumps. No application/DB writes.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {createGunzip} from 'node:zlib';
import {Transform} from 'node:stream';
import {createInterface} from 'node:readline';
import {once} from 'node:events';
import {validIsbn} from './catalog-selection-core.mjs';
import {EDITION_DUMP,WORK_DUMP,minimalEdition} from './catalog-batch-dump.mjs';
import {ROOT,OUTPUT,readJson,loadSnapshot,localPath} from './nl-scale-snapshot.mjs';
const cache=new URL('../.research-cache/nl-scale-20261102/',import.meta.url);
fs.mkdirSync(cache,{recursive:true});fs.mkdirSync(OUTPUT,{recursive:true});
const statePath=new URL('dump-progress.json',OUTPUT);
const say=x=>{fs.writeFileSync(statePath,JSON.stringify({...x,at:new Date().toISOString()},null,2));console.log(JSON.stringify(x));};
const fingerprint=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const printFormats=new Set(['paperback','hardcover','hardback','softcover','mass market paperback','trade paperback','library binding','paperbound','gebonden','paperback boek']);
const normalFormat=x=>String(x??'').normalize('NFKC').toLowerCase().replaceAll('-',' ').replace(/\s+/g,' ').trim();
const mode=process.argv[2];
if(mode==='ratings'){
 const metadata=readJson(new URL('sources/archive-export-metadata.json',ROOT));
 const definition=metadata.files.find(f=>f.name==='ol_dump_ratings_2026-09-30.txt.gz');
 if(!definition||Number(definition.size)>20000000)throw Error('Unreviewed ratings export size');
 const file=new URL(definition.name,cache);
 if(!fs.existsSync(file)){
  const response=await fetch('https://archive.org/download/ol_dump_2026-09-30/'+definition.name,{signal:AbortSignal.timeout(120000)});
  if(!response.ok)throw Error('Export HTTP '+response.status+'; no retry');
  const dest=fs.createWriteStream(localPath(file)+'.partial');let bytes=0;
  for await(const chunk of response.body){bytes+=chunk.length;if(bytes>Number(definition.size))throw Error('Export exceeded declared size');if(!dest.write(chunk))await once(dest,'drain');}
  dest.end();await once(dest,'finish');if(bytes!==Number(definition.size))throw Error('Incomplete export');fs.renameSync(localPath(file)+'.partial',localPath(file));
 }
 const raw=fs.readFileSync(file);if(raw.length!==Number(definition.size)||createHash('sha1').update(raw).digest('hex')!==definition.sha1)throw Error('Ratings checksum mismatch');
 const rows=new Map();let n=0;
 const lines=createInterface({input:fs.createReadStream(file).pipe(createGunzip()),crlfDelay:Infinity});
 for await(const line of lines){if(!line.startsWith('/works/'))continue;const [work,,rating,,...rest]=line.split('\t');if(rest.length||!/^\/works\/OL\d+W$/.test(work)||!/^[1-5]$/.test(rating))throw Error('Unexpected public rating export schema');const row=rows.get(work)??{count:0,total:0};row.count++;row.total+=Number(rating);rows.set(work,row);n++;}
 const result={source:'https://archive.org/download/ol_dump_2026-09-30/'+definition.name,sha1:definition.sha1,checkedAt:new Date().toISOString(),records:n,definition:'Recorded public rating rows, not unique readers or a Dutch sales/loan ranking.',works:Object.fromEntries(rows)};
 fs.writeFileSync(new URL('rating-signals.json',cache),JSON.stringify(result));say({mode,records:n,works:rows.size});
}else if(mode==='editions'||mode==='edition-reserve'){
 const snapshot=loadSnapshot(),existing=new Map(snapshot.works.filter(w=>w.open_library_id).map(w=>['/works/'+w.open_library_id.replace('/works/',''),w])),knownAuthors=new Set(snapshot.authors.filter(a=>a.open_library_id).map(a=>'/authors/'+a.open_library_id.replace('/authors/','')));
 const signals=readJson(new URL('rating-signals.json',cache));
 // Resolve against the worktree sibling explicitly; source is never changed.
 const sourcePath=localPath(new URL('../../../lumiscore-catalog-integrity-20261030/.research-cache/ol_dump_editions_2026-09-30.txt.gz',ROOT));
 if(fs.statSync(sourcePath).size!==EDITION_DUMP.bytes)throw Error('Pinned edition dump size mismatch');
 const h=createHash('sha1'),h256=createHash('sha256');let compressed=0,total=0,dutch=0,eligible=0,last=Date.now(),newCapSkipped=0;
 const wanted=new Map(),newIds=new Set();
 const tap=new Transform({transform(chunk,encoding,done){compressed+=chunk.length;h.update(chunk);h256.update(chunk);done(null,chunk)}});
 const stream=fs.createReadStream(sourcePath).pipe(tap).pipe(createGunzip());
 const lines=createInterface({input:stream,crlfDelay:Infinity});
 for await(const line of lines){
  total++;
  if(line.includes('"/languages/dut"')||line.includes('"/languages/nld"')||line.includes('"/languages/nl"')){
   const columns=line.split('\t');const e=JSON.parse(columns[4]);dutch++;
   const languages=e.languages?.map(l=>l.key)??[],parents=e.works?.map(w=>w.key)??[];
   const isbn13=(e.isbn_13??[]).find(validIsbn),isbn10=(e.isbn_10??[]).find(validIsbn),format=normalFormat(e.physical_format);
   if(languages.length===1&&['/languages/dut','/languages/nld','/languages/nl'].includes(languages[0])&&parents.length===1&&(isbn13||isbn10)&&printFormats.has(format)&&(e.covers??[]).some(n=>Number.isInteger(n)&&n>0)&&!/\b(?:abridged|adapted|audiobook|cassette|audio cd)\b/i.test(e.title+' '+(e.edition_name??''))){
    eligible++;const key=parents[0],current=existing.get(key),ratings=signals.works[key]?.count??0,known=(e.authors??[]).some(a=>knownAuthors.has(a.key));
    if(mode!=='edition-reserve'&&!current&&!known&&ratings<3)continue;
    if(!current&&!newIds.has(key)&&newIds.size>=10000){newCapSkipped++;continue;}
    if(!current)newIds.add(key);
    const record={...minimalEdition(e),publish_date:e.publish_date??null,edition_name:e.edition_name??null,by_statement:e.by_statement??null,revision:Number(columns[2]),modified:columns[3]};
    const entry={workKey:key,currentWorkId:current?.id??null,title:e.title,source:{url:EDITION_DUMP.url,edition:e.key,recordSha256:fingerprint(record)},record,popularitySignals:ratings?[{kind:'public_rating_rows',count:ratings,region:'global; not Dutch-specific',period:'monthly snapshot 2026-09-30',source:signals.source}]:[],knownCatalogueAuthor:known,reviewStatus:'not_yet_researched'};
    const group=wanted.get(key)??[];
    if(!group.some(x=>x.record.key===e.key))group.push(entry);
    group.sort((a,b)=>(b.record.isbn_13.length>0)-(a.record.isbn_13.length>0)||b.record.covers.length-a.record.covers.length||a.record.key.localeCompare(b.record.key));
    wanted.set(key,group.slice(0,3));
   }
  }
  if(Date.now()-last>30000){last=Date.now();say({mode,compressed,total,dutch,eligible,existingCandidates:[...wanted.keys()].filter(k=>existing.has(k)).length,newCandidates:newIds.size,newCapSkipped});fs.writeFileSync(new URL('editions-extract-checkpoint.json',cache),JSON.stringify([...wanted.values()].flat()));}
 }
 const sha1=h.digest('hex'),sha256=h256.digest('hex');if(sha1!==EDITION_DUMP.sha1||compressed!==EDITION_DUMP.bytes)throw Error('Pinned edition dump checksum mismatch');
 const data={source:{...EDITION_DUMP,sha256},checkedAt:new Date().toISOString(),reviewStatus:'candidates only, not approved',total,dutch,eligible,newCapSkipped,entries:[...wanted.values()].flat()};
 fs.writeFileSync(new URL(mode==='edition-reserve'?'editions-reserve-extract.json':'editions-extract.json',cache),JSON.stringify(data));say({mode,complete:true,total,dutch,eligible,uniqueWorks:wanted.size,newCandidates:newIds.size,newCapSkipped});
}else if(mode==='works'||mode==='reserve-works'){
 const editions=readJson(new URL(mode==='reserve-works'?'editions-reserve-extract.json':'editions-extract.json',cache));
 if(editions.source.sha1!==EDITION_DUMP.sha1)throw Error('Unverified edition corpus');
 const wanted=new Set(editions.entries.map(e=>e.workKey));
 const old=readJson(new URL('../../../lumiscore-catalog-integrity-20261030/.research-cache/bulk-works-matched.json',ROOT));
 const records=new Map(old.filter(w=>wanted.has(w.key)).map(w=>[w.key,{record:w,provenance:'existing previously matched monthly source cache'}]));
 const reused=records.size,missing=new Set([...wanted].filter(k=>!records.has(k)));
 const sourcePath=localPath(new URL('../../../lumiscore-catalog-integrity-20261030/.research-cache/ol_dump_works_2026-09-30.txt.gz',ROOT));
 if(fs.statSync(sourcePath).size!==WORK_DUMP.bytes)throw Error('Pinned work dump size mismatch');
 let bytes=0,total=0,last=Date.now();const hash=createHash('sha1'),h256=createHash('sha256');
 const tap=new Transform({transform(chunk,encoding,done){bytes+=chunk.length;hash.update(chunk);h256.update(chunk);done(null,chunk)}});
 const lines=createInterface({input:fs.createReadStream(sourcePath).pipe(tap).pipe(createGunzip()),crlfDelay:Infinity});
 for await(const line of lines){
  total++;const a=line.indexOf('\t'),b=line.indexOf('\t',a+1),key=line.slice(a+1,b);
  if(missing.has(key)){const columns=line.split('\t'),record=JSON.parse(columns[4]);if(record.key!==key)throw Error('Source identity drift');records.set(key,{record,provenance:'new match from pinned monthly work dump',revision:Number(columns[2]),modified:columns[3]});missing.delete(key);}
  if(Date.now()-last>30000){last=Date.now();say({mode,compressed:bytes,total,reused,matched:records.size,remaining:missing.size});fs.writeFileSync(new URL('works-extract-checkpoint.json',cache),JSON.stringify([...records.values()]));}
 }
 const sha1=hash.digest('hex'),sha256=h256.digest('hex');if(sha1!==WORK_DUMP.sha1||bytes!==WORK_DUMP.bytes)throw Error('Pinned work checksum mismatch');
 const result={source:{...WORK_DUMP,sha256},checkedAt:new Date().toISOString(),reused,missing:[...missing],reviewStatus:'source candidates, not approved summaries',records:[...records.values()].map(v=>({...v,recordSha256:fingerprint(v.record)}))};
 fs.writeFileSync(new URL(mode==='reserve-works'?'works-reserve-extract.json':'works-extract.json',cache),JSON.stringify(result));say({mode,complete:true,total,reused,matched:records.size,missing:missing.size});
}else throw Error('Mode must be ratings, editions or works');
