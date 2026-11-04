// Materialise public source facts, not approved presentation records.
import fs from 'node:fs';
import {ROOT,readJson} from './nl-scale-snapshot.mjs';
const dir=new URL('sources/',ROOT),books=new Map(),linked=new Map();
for(const f of fs.readdirSync(dir).filter(f=>/^kb-[a-f0-9]{64}\.json$/.test(f))){
 const src=readJson(new URL(f,dir));if(src.status!==200||src.error)continue;
 if(src.label.startsWith('exact NL candidate ISBN'))for(const r of src.data.results.bindings){
  const b=books.get(r.book.value)??{uri:r.book.value,isbn:r.isbn.value,isbns:[],properties:{},sources:[]};
  if(!b.isbns.includes(r.isbn.value))b.isbns.push(r.isbn.value);
  const v={type:r.value.type,value:r.value.value,language:r.value['xml:lang']??null};
  const arr=b.properties[r.p.value]??=[];if(!arr.some(x=>JSON.stringify(x)===JSON.stringify(v)))arr.push(v);
  if(!b.sources.includes(f))b.sources.push(f);books.set(b.uri,b);
 }
 if(src.label.startsWith('linked ISBN'))for(const r of src.data.results.bindings){
  const n=linked.get(r.node.value)??{uri:r.node.value,properties:{},sources:[]};
  const v={type:r.value.type,value:r.value.value};
  const arr=n.properties[r.p.value]??=[];if(!arr.some(x=>JSON.stringify(x)===JSON.stringify(v)))arr.push(v);
  if(!n.sources.includes(f))n.sources.push(f);linked.set(n.uri,n);
 }
}
const p=(b,n)=>(b?.properties['http://schema.org/'+n]??[]).map(x=>x.value);
for(const b of books.values()){
 b.titles=p(b,'name');b.languages=p(b,'inLanguage');b.formats=p(b,'bookFormat');
 b.authors=p(b,'author').map(uri=>({uri,names:p(linked.get(uri),'name'),alternateNames:p(linked.get(uri),'alternateName'),labels:linked.get(uri)?.properties['http://www.w3.org/2000/01/rdf-schema#label']?.map(x=>x.value)??[],sameAs:p(linked.get(uri),'sameAs')}));
 b.publications=p(b,'publication').map(uri=>({uri,properties:linked.get(uri)?.properties??{}}));
 b.originals=p(b,'translationOfWork').map(uri=>({uri,properties:linked.get(uri)?.properties??{}}));
 b.descriptionCandidates=p(b,'description').map(text=>({text,status:'unreviewed_source_text',notSummaryApproval:true}));
}
fs.writeFileSync(new URL('sources/kb-normalized-facts.json',ROOT),JSON.stringify({kind:'unreviewed source facts; no format inference or summary approval',books:[...books.values()]},null,2)+'\n');
console.log(JSON.stringify({books:books.size,isbn:new Set([...books.values()].map(b=>b.isbn)).size,authors:linked.size,longDescriptionRecords:[...books.values()].filter(b=>b.descriptionCandidates.some(x=>x.text.split(/\s+/).length>=45)).length}));
