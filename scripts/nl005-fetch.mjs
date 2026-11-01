// Named, bounded individual bibliography checks. Not a crawler or database importer.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../catalog/nl-research-005-20261101/',import.meta.url);
const hash=x=>createHash('sha256').update(x).digest('hex');
const clean=s=>s.replace(/<script\b[\s\S]*?<\/script>/giu,'').replace(/<style\b[\s\S]*?<\/style>/giu,'').replace(/<[^>]*>/gu,' ').replaceAll('&amp;','&').replaceAll('&nbsp;',' ').replaceAll('&#039;',"'").replaceAll('&quot;','"').replace(/\s+/gu,' ').trim();
const rows=JSON.parse(await fs.readFile(process.argv[2],'utf8'));if(!Array.isArray(rows)||rows.length>10)throw Error('Maximum10 explicitly named checks per invocation');
await fs.mkdir(new URL('sources/',root),{recursive:true});
for(const q of rows){
 const url=new URL(q.url);if(url.hostname!=='metadata.isbn.nl'||!/^\/(search\.html|\d+\/)/u.test(url.pathname))throw Error('Unreviewed source URL');
 const path=new URL('sources/'+q.name+'.json',root);let cached;try{cached=JSON.parse(await fs.readFile(path));}catch{}if(cached){console.log(JSON.stringify({...cached,cached:true}));continue;}
 const out={...q,checkedAt:new Date().toISOString(),role:'Named edition/content research; discovery is not language/identity approval',fullPublisherTextStored:false};
 try{const r=await fetch(url,{signal:AbortSignal.timeout(16000)});out.status=r.status;if([401,403,429].includes(r.status)){out.error='Provider refusal or rate limit; stop, no alternate access';await fs.writeFile(path,JSON.stringify(out,null,2));throw Error(out.error);}
 const html=await r.text();out.sha256=hash(html);
 if(r.ok){const header=html.split(/<div class="main-container/u)[0];out.title=clean(header.match(/<h1[^>]*>([\s\S]*?)<\/h1>/u)?.[1]??'');out.authors=clean(html.match(/<dt>Auteur\(s\)<\/dt><dd>([\s\S]*?)<\/dd>/u)?.[1]??'');
 out.editions=html.split(/<div class="uitv">/u).slice(1).map(b=>b.split(/<div class="pd pd-inactive">/u)[0]).map(b=>({format:clean(b.match(/<div class="uvlabel">([\s\S]*?)<\/div>/u)?.[1]??''),facts:clean(b).split(' ').slice(0,100).join(' '),covers:[...b.matchAll(/<a[^>]+href="([^"]+\.(?:jpg|png|webp))"/giu)].map(m=>new URL(m[1].replaceAll('&amp;','&'),url).href),previews:[...b.matchAll(/<img[^>]+src="([^"]+)"/giu)].map(m=>new URL(m[1].replaceAll('&amp;','&'),url).href)}));
 out.links=out.editions.length?[]:[...html.matchAll(/<a[^>]+href="([^"]+\.html)"[^>]*>([\s\S]*?)<\/a>/giu)].map(m=>({url:new URL(m[1],url).href,label:clean(m[2])})).filter(x=>/^https:\/\/metadata\.isbn\.nl\/\d+\//u.test(x.url)).filter((x,i,a)=>a.findIndex(y=>y.url===x.url)===i).slice(0,12);
 const narrative=clean(html.match(/<meta name="(?:og:)?description" content="([\s\S]*?)"\s*\/>/u)?.[1]??'');out.content={sha256:hash(narrative),words:narrative.split(' ').filter(Boolean).length,stored:false};
 console.log(JSON.stringify(out.editions.length?{id:out.candidateId,name:out.name,title:out.title,author:out.authors,printed:out.editions.filter(e=>['Paperback','Hardback'].includes(e.format)).map(e=>e.facts),premiseForReviewOnly:narrative.split(' ').slice(0,160).join(' ')}:{candidateId:out.candidateId,url:out.url,status:out.status,title:out.title,links:out.links.slice(0,4),sha256:out.sha256}));
 }}catch(e){out.error=e.message;console.log(JSON.stringify(out));if(/Provider refusal/u.test(out.error))throw e;}
 await fs.writeFile(path,JSON.stringify(out,null,2)+'\n');await new Promise(r=>setTimeout(r,1700));
}
