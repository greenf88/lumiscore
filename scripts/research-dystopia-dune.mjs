// Bounded read-only bibliographic research. No DB client or auto-approval.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../catalog/edition-recovery-20261031/',import.meta.url);
const clean=s=>s.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<style\b[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&#039;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
const queries=['De zaaier','Oryx en Crake','Gever','Zeis','Inwijding','Inwijding-Roth','Divergent 1 - Inwijding','Gesplitst','Het jaar van de vloed','Kinderen van Duin','God-Keizer op Duin','Duin Kapittel','Ketters van Duin','Duin messias'];
await fs.mkdir(new URL('sources/',root),{recursive:true});
for(const query of queries){
 const file=new URL('sources/'+query.toLowerCase().replace(/[^a-z0-9]+/g,'-')+'.json',root);
 try{await fs.access(file);continue;}catch{}
 const result={query,checkedAt:new Date().toISOString(),pages:[]};
 try{
  const response=await fetch('https://metadata.isbn.nl/search.html?search='+encodeURIComponent(query),{signal:AbortSignal.timeout(18000)});
  const html=await response.text();if(!response.ok)throw Error('Search HTTP '+response.status);
  const links=query==='Inwijding-Roth'?['https://metadata.isbn.nl/56239/inwijding.html']:[...new Set(html.split('<div class="span2 wrk">').slice(1).flatMap(b=>{
   const title=clean(b.match(/<div class="wrktitle">([\s\S]*?)<\/div>/)?.[1]??'');
   const href=b.match(/<a\b[^>]*href="([^"]+)"/)?.[1];
   return title.toLowerCase()===query.toLowerCase()&&href?[new URL(href,'https://metadata.isbn.nl').href]:[];
  }))].slice(0,2);
  for(const url of links){
   await new Promise(r=>setTimeout(r,1500));
   const r=await fetch(url,{signal:AbortSignal.timeout(18000)}),text=await r.text();
   const header=clean(text.slice(text.indexOf('<h1'),text.indexOf('dit werk kent')));
   const editions=text.split(/<div class="uitv">/).slice(1).map(b=>b.split(/<div class="pd pd-inactive">/)[0]).map(b=>({format:clean(b.match(/<div class="uvlabel">([\s\S]*?)<\/div>/)?.[1]??''),facts:clean(b).split(' ').slice(0,100).join(' '),covers:[...b.matchAll(/<a[^>]+href="([^"]+\.(?:jpg|png|webp))"/gi)].map(m=>new URL(m[1].replaceAll('&amp;','&'),url).href)}));
   result.pages.push({url,status:r.status,sha256:createHash('sha256').update(text).digest('hex'),header:header.match(/^[\s\S]*?NSTC\s+\d+/)?.[0]??header.split('Vers. datum')[0],editions});
   console.log(JSON.stringify({query,url,content:header.split(/NSTC\s+\d+/)[1]?.split(' ').slice(0,125).join(' ')}));
  }
 }catch(e){result.error=e.message;}
 await fs.writeFile(file,JSON.stringify(result,null,2)+'\n');
 console.log(JSON.stringify(result));
 await new Promise(r=>setTimeout(r,1500));
}
