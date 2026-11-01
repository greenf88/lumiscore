// Bounded manual research aid; never a production/client loader or bulk scraper.
import fs from 'node:fs/promises';import {createHash} from 'node:crypto';
const root=new URL('../catalog/nl-followup-002-20261031/',import.meta.url);
const clean=s=>s.replace(/<script\b[\s\S]*?<\/script>/gi,'').replace(/<style\b[\s\S]*?<\/style>/gi,'').replace(/<[^>]*>/g,' ').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').replace(/&#039;/g,"'").replace(/&quot;/g,'"').replace(/\s+/g,' ').trim();
const pages=JSON.parse(await fs.readFile(new URL('source-requests.json',root),'utf8'));
const relevantLinks=rows=>rows.filter(x=>/\/(?:project-hail-mary|mars|de-naam-van-de-wind|het-vijfde-seizoen|de-heerser|dolfje-weerwolfje|revolusi|alles-wat-er-was|leven-en-laten-leven|de-donkere-kamer-van-damokles|de-donkere-kamer-van-damocles)\.html$/.test(x.url));
if(pages.length>18)throw Error('Manual batch capped at18pages; review provider terms before scale');
await fs.mkdir(new URL('sources/',root),{recursive:true});
for(const {name,url} of pages){
 if(new URL(url).protocol!=='https:'||!['metadata.isbn.nl','www.lannoo.com','www.singeluitgeverijen.nl'].includes(new URL(url).hostname))throw Error('Unreviewed source host');
 const file=new URL('sources/'+name+'.json',root);let prior;
 try{prior=JSON.parse(await fs.readFile(file));if(prior.status===200){prior.links=relevantLinks(prior.links??[]);await fs.writeFile(file,JSON.stringify(prior,null,2)+'\n');console.log(JSON.stringify({name,cached:true}));continue;}}catch{}
 if(prior){console.log(JSON.stringify({name,previousFailureRetained:true,note:'No automatic retry'}));continue;}
 const p={url,at:new Date().toISOString(),requestScope:'Single manual exact-edition research; no automatic retries or copied narrative'};
 try{const r=await fetch(url,{signal:AbortSignal.timeout(18000)}),html=await r.text();p.status=r.status;p.sha256=createHash('sha256').update(html).digest('hex');
  if(r.ok){p.title=clean(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/)?.[1]??'');
   if(new URL(url).hostname==='www.lannoo.com'){const plain=clean(html),at=plain.indexOf('Taal boek');p.exactEditionFacts=at>=0?plain.slice(Math.max(0,at-200),at+500):'manual source review required';}
   p.editions=html.split(/<div class="uitv">/).slice(1).map(b=>b.split(/<div class="pd pd-inactive">/)[0]).map(b=>({format:clean(b.match(/<div class="uvlabel">([\s\S]*?)<\/div>/)?.[1]??''),facts:clean(b).split(' ').slice(0,120).join(' '),covers:[...b.matchAll(/<a[^>]+href="([^"]+\.(?:jpg|png|webp))"/gi)].map(m=>new URL(m[1].replaceAll('&amp;','&'),url).href)}));
   p.links=relevantLinks([...html.matchAll(/<a[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi)].map(m=>({url:new URL(m[1].replaceAll('&amp;','&'),url).href,label:clean(m[2]).slice(0,120)})).filter(x=>new URL(x.url).hostname==='metadata.isbn.nl'&&/\.html$/.test(x.url)));
  }
 }catch(e){p.error=e.message;}
 await fs.writeFile(file,JSON.stringify(p,null,2)+'\n');console.log(JSON.stringify({name,status:p.status,error:p.error,title:p.title,editions:p.editions,links:p.links}));await new Promise(r=>setTimeout(r,1500));
}
