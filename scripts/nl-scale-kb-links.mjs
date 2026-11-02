import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {readKB,CACHE} from './nl-scale-kb.mjs';
import {ROOT,readJson} from './nl-scale-snapshot.mjs';
const records=fs.readdirSync(CACHE).filter(x=>/^kb-[a-f0-9]{64}\.json$/.test(x)).map(x=>readJson(new URL(x,CACHE))).filter(x=>x.label.startsWith('exact NL candidate ISBN'));
const bindings=records.flatMap(r=>r.data.results.bindings);
const authors=[...new Set(bindings.filter(r=>r.p.value==='http://schema.org/author'&&r.value.type==='uri').map(r=>r.value.value))].sort();
const nodes=[...new Set(bindings.filter(r=>['http://schema.org/publication','http://schema.org/translationOfWork'].includes(r.p.value)&&r.value.type==='uri').map(r=>r.value.value))].sort();
const manifestPath=new URL('sources/kb-links-manifest.json',ROOT);
const manifest=fs.existsSync(manifestPath)?readJson(manifestPath).queries:[];
for(const [kind,allValues] of [['author',authors],['publication-original',nodes]]){
 const covered=new Set(manifest.filter(q=>q.kind===kind).flatMap(q=>q.nodes));
 const values=allValues.filter(v=>!covered.has(v));
 for(let start=0;start<values.length;start+=60){
  const vs=values.slice(start,start+60);
  if(!vs.every(v=>/^https?:\/\/data\.bibliotheken\.nl\/[A-Za-z0-9/._-]+$/.test(v)))throw Error('Unexpected KB link URI');
  const predicates=kind==='author'?'VALUES ?p { <http://schema.org/name> <http://schema.org/alternateName> <http://www.w3.org/2000/01/rdf-schema#label> <http://schema.org/sameAs> }':'';
  const query='SELECT ?node ?p ?value WHERE { GRAPH <http://data.bibliotheken.nl/'+(kind==='author'?'nta':'nbt')+'> { VALUES ?node { '+vs.map(v=>'<'+v+'>').join(' ')+' } '+predicates+' ?node ?p ?value } } LIMIT 9000';
  const r=await readKB(query,{label:'linked ISBN '+kind+' '+start+'..'+(start+vs.length-1)});
  if(r.data.results.bindings.length>=9000)throw Error('KB truncation; split before interpreting');
  manifest.push({kind,nodes:vs,querySha256:createHash('sha256').update(query).digest('hex'),responseSha256:r.sha256,rows:r.data.results.bindings.length,checkedAt:r.checkedAt});
  console.log(JSON.stringify({kind,done:start+vs.length,total:values.length,rows:r.data.results.bindings.length,cached:r.cached??false}));
 }
}
fs.writeFileSync(manifestPath,JSON.stringify({complete:true,authors:authors.length,linkedNodes:nodes.length,queries:manifest},null,2)+'\n');
