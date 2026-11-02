// Targeted normal public bibliography read, never a catalogue/cover API crawl.
// A maximum of five explicit edition identifiers; cached failures are not retried.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ROOT} from './nl-scale-snapshot.mjs';
const ids=process.argv.slice(2);if(!ids.length||ids.length>5||new Set(ids).size!==ids.length||ids.some(id=>!/^OL[1-9]\d*M$/.test(id)))throw Error('1–5 exact reviewed edition IDs required');
const key=createHash('sha256').update(JSON.stringify(ids)).digest('hex'),file=new URL('sources/ol-explicit-editions-'+key+'.json',ROOT);
if(fs.existsSync(file)){const old=JSON.parse(fs.readFileSync(file));if(old.status!==200)throw Error('Recorded source failure; no retry');console.log(JSON.stringify({...old,cached:true}));process.exit(0);}
const url=new URL('https://openlibrary.org/api/get_many');url.searchParams.set('keys',JSON.stringify(ids.map(id=>'/books/'+id)));
const r=await fetch(url,{headers:{Accept:'application/json','User-Agent':'LumiScore-public-catalogue-review/20261102 (OpenAI Codex GPT-6; +https://lumisco.re)'},signal:AbortSignal.timeout(15000)});
const chunks=[];let size=0;for await(const c of r.body){size+=c.length;if(size>256000)throw Error('Bounded response exceeded');chunks.push(c);}const raw=Buffer.concat(chunks),parsed=r.ok?JSON.parse(raw):null;
const fields=['key','title','subtitle','works','authors','languages','isbn_13','isbn_10','publishers','publish_date','physical_format','number_of_pages','pagination','covers','by_statement','edition_name','identifiers'];
const records=parsed?.status==='ok'?Object.entries(parsed.result??{}).map(([key,v])=>({key,record:Object.fromEntries(fields.filter(f=>v[f]!=null).map(f=>[f,v[f]]))})):[];
const receipt={source:'Open Library public exact-edition API',purpose:'Resolve three already identified edition/ISBN conflicts; no source description export',url:url.href,checkedAt:new Date().toISOString(),status:r.status,sourceBodySha256:createHash('sha256').update(raw).digest('hex'),bytes:size,records,error:r.ok&&parsed?.status==='ok'?null:'Source response rejected; no automatic retry'};
fs.writeFileSync(file,JSON.stringify(receipt,null,2)+'\n');console.log(JSON.stringify(receipt));if(receipt.error)process.exitCode=1;
