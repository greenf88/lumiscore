import {readFileSync} from 'node:fs';
const {reviewTargets:targets}=JSON.parse(readFileSync(new URL('../catalog/covers-silver-flames-20261023/identities.json',import.meta.url),'utf8'));
const out=[];
for(let start=0;start<targets.length;start+=2)await Promise.all(targets.slice(start,start+2).map(async d=>{
 const probes=[['open_library','https://openlibrary.org/books/'+d.editionOlid+'.json'],['google_books','https://www.googleapis.com/books/v1/volumes?q=isbn:'+d.isbn13+'&maxResults=5&projection=full']];
 const results=[];for(const [source,url] of probes){const began=Date.now();try{
  const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(8000)});
  const r={source,url,status:response.status,elapsedMs:Date.now()-began};
  if(response.ok){const b=await response.json();if(source==='open_library')r.facts={key:b.key,title:b.title,works:b.works,languages:b.languages,isbn13:b.isbn_13,covers:b.covers,descriptionPresent:Boolean(b.description)};
  else r.facts=(b.items??[]).map(i=>({id:i.id,title:i.volumeInfo?.title,authors:i.volumeInfo?.authors,language:i.volumeInfo?.language,identifiers:i.volumeInfo?.industryIdentifiers,images:i.volumeInfo?.imageLinks,descriptionPresent:Boolean(i.volumeInfo?.description)}));}
  results.push(r);
 }catch(error){results.push({source,url,error:String(error),elapsedMs:Date.now()-began});}}
 out.push({workId:d.workId,editionId:d.editionId,isbn:d.isbn13,results});
}));
console.log(JSON.stringify({checkedAt:new Date().toISOString(),maxConcurrency:2,results:out},null,2));
