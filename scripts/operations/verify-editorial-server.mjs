// Loopback HTTP-response integration; actual public catalogue reads through the
// bounded guest adapter. No browser JS is needed to validate these identities.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
const origin=process.env.EDITORIAL_TEST_ORIGIN;
if(!origin||!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw Error('Explicit loopback test origin required');
const root=new URL('../../catalog/editorial-parity-20261021/',import.meta.url);
const lists=JSON.parse(await readFile(new URL('../../lib/catalog/top-lists.json',import.meta.url),'utf8')).lists;
const scores=JSON.parse(await readFile(new URL('public-score-snapshot.json',root),'utf8')).rows;
const text=html=>html.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<!--.*?-->/gs,'');
const decode=value=>value?.replaceAll('&amp;','&').replaceAll('&#x27;',"'").replaceAll('&#39;',"'").replaceAll('&quot;','"');
async function read(path){
 const start=performance.now(),response=await fetch(origin+path);assert.equal(response.status,200,path);
 const ttfb=performance.now()-start;let source='',firstCard=null;
 for await(const chunk of response.body){source+=Buffer.from(chunk).toString();if(firstCard===null&&/<article\b[^>]*class="book-card/.test(source))firstCard=performance.now()-start;}
 return {path,ttfb,firstCard,bodyMs:performance.now()-start,html:text(source)};
}
const results=[];
for(const locale of ['nl','en'])for(const list of lists){
 const response=await read('/'+locale+'/toplijsten/'+list.slug);
 const cards=[...response.html.matchAll(/<article\b[^>]*id="work-(\d+)"[^>]*>([\s\S]*?)<\/article>/g)].map(([,id,card])=>({id,title:decode(card.match(/<h3[^>]*>(.*?)<\/h3>/s)?.[1]),score:card.match(/class="score-badge[^>]*>[\s\S]*?<strong[^>]*>(.*?)<\/strong>/)?.[1],image:decode(card.match(/<img\b[^>]*src="([^"]+)"/)?.[1]),available:!card.includes('verified English edition is not available')&&!card.includes('geen geverifieerde Nederlandse of Engelse editie')}));
 assert.deepEqual(cards.map(c=>c.id),list.workIds);
 for(const card of cards){const aggregate=scores.find(s=>String(s.work_id)===card.id);assert.equal(card.score,aggregate?.evidence_status==='available'?Number(aggregate.lumiscore).toFixed(1):'—');}
 results.push({...response,html:undefined,cards});
}
const workIds=[...new Set(lists.flatMap(list=>list.workIds))];
assert.equal(workIds.length,35,'bounded editorial scope');
for(const locale of ['nl','en'])for(const id of workIds){
 const response=await read('/'+locale+'/book/'+id+'?returnTo=%2Ftoplijsten%2F'+(lists[0].workIds.includes(id)?lists[0].slug:lists[1].slug));
 const heading=decode(response.html.match(/<h1[^>]*>(.*?)<\/h1>/s)?.[1]);
 const list=results.find(r=>r.path==='/'+locale+'/toplijsten/'+(lists[0].workIds.includes(id)?lists[0].slug:lists[1].slug));
 const card=list.cards.find(c=>c.id===id);
 assert.equal(heading,card.title,id);
 const score=response.html.match(/aria-labelledby="lumiscore-heading"[\s\S]*?<strong[^>]*>(.*?)<\/strong>/)?.[1];
 assert.equal(score,card.score,id+' score');
 const image=decode(response.html.match(/<img\b[^>]*src="([^"]+)"/)?.[1]);
 const identity=url=>url?.replace(/-[MLS]\.jpg/,'-SIZE.jpg');
 // Streamed list images can arrive in a separate React Suspense segment rather
 // than inside the initial article. Actual loaded images are checked in-browser.
 if(card.image)assert.equal(identity(image),identity(card.image),id+' image');
 assert.ok(response.html.includes('/'+locale+'/toplijsten/'));
 results.push({...response,html:undefined,id,title:heading,score,image,listImageStreamed:!card.image&&Boolean(image)});
}
await writeFile(new URL('server-html-verification.json',root),JSON.stringify({origin,checkedAt:new Date().toISOString(),scope:'guest/public; private/collection side panels disabled in local adapter; not production latency',results},null,2));
console.log(JSON.stringify({routes:results.length,lists:4,detailPages:70,passed:true}));
