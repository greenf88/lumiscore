// Full same-author catalogue comparison candidates; never an automatic merge.
import fs from 'node:fs';
import {ROOT,readJson,loadSnapshot} from './nl-scale-snapshot.mjs';
import {norm} from './nl-scale-identity.mjs';
const snap=loadSnapshot(),cache=new URL('../.research-cache/nl-scale-20261102/',import.meta.url);
const source=readJson(new URL('authors-extract.json',cache)).records.map(x=>x.record);
const sourceByKey=new Map(source.map(x=>[x.key,x]));
const sourceKey=s=>'/authors/'+String(s??'').replace('/authors/','');
const nameIndex=new Map(),wdIndex=new Map();
for(const a of snap.authors){
 const s=sourceByKey.get(sourceKey(a.open_library_id));
 for(const n of new Set([a.name,s?.name,...(s?.alternate_names??[])].filter(Boolean).map(norm))){
  const ids=nameIndex.get(n)??[];if(!ids.includes(a.id))ids.push(a.id);nameIndex.set(n,ids);
 }
 if(s?.remote_ids?.wikidata){const ids=wdIndex.get(s.remote_ids.wikidata)??[];ids.push(a.id);wdIndex.set(s.remote_ids.wikidata,ids);}
}
const cases=fs.readFileSync(new URL('research-cases.jsonl',cache),'utf8').trim().split('\n').map(JSON.parse);
const out=[];
for(const d of cases.filter(x=>!x.workId)){
 const matches=[];
 for(const sa of d.sourceAuthors){
  const s=sourceByKey.get(sa.key);
  for(const n of [s?.name,...(s?.alternate_names??[])].filter(Boolean)){
   for(const id of nameIndex.get(norm(n))??[])matches.push({authorId:id,method:'exact_author_alias',sourceName:n});
  }
  for(const id of wdIndex.get(s?.remote_ids?.wikidata)??[])matches.push({authorId:id,method:'shared_wikidata_authority',wikidata:s.remote_ids.wikidata});
 }
 const authorIds=new Set(matches.map(x=>x.authorId));
 const works=snap.works.filter(w=>authorIds.has(w.author_id));
 out.push({candidateId:d.candidateId,sourceAuthors:d.sourceAuthors.map(a=>({key:a.key,name:a.name})),authorityMatches:[...new Map(matches.map(m=>[JSON.stringify(m),m])).values()],sameAuthorExistingWorks:works.map(w=>({workId:w.id,title:w.title,author:w.author,sourceWorkId:w.open_library_id,aliases:snap.aliases.filter(a=>a.work_id===w.id).map(a=>a.title),editionTitles:[...new Set(snap.editions.filter(e=>e.work_id===w.id).map(e=>e.title).filter(Boolean))]})),status:'comparison_required_no_merge_or_absence_approval'});
}
fs.writeFileSync(new URL('identity-neighbours.json',ROOT),JSON.stringify({policy:'Exact authority/alias neighbours aid original, English and Dutch title review. A shared author does not mean a shared Work; no fuzzy equality approval.',cases:out},null,2)+'\n');
console.log(JSON.stringify({possibleNew:out.length,withExistingAuthorWorks:out.filter(r=>r.sameAuthorExistingWorks.length).length,allHaveNotBeenCalledAbsent:true}));
