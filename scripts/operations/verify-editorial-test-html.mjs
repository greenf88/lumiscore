// Bounded real local app -> test-project reads. No synthetic response adapter.
import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
const origin=process.env.EDITORIAL_TEST_ORIGIN;
if(!origin||!['127.0.0.1','localhost'].includes(new URL(origin).hostname))throw Error('Loopback only');
const required=[921100102,921102718,921100208,921102600,921100100,921102717,921100179,921102724,921102846,921100199];
const extra=[921100030,921100032,921100117,921104316,921100025,921100304];
const strip=s=>s.replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<!--.*?-->/gs,'');
const decode=s=>s?.replaceAll('&amp;','&').replaceAll('&#x27;',"'").replaceAll('&#39;',"'").replaceAll('&quot;','"');
async function read(path){const start=performance.now();const r=await fetch(origin+path,{signal:AbortSignal.timeout(30000)});assert.equal(r.status,200,path);const ttfb=performance.now()-start;let html='',firstCard=null;for await(const b of r.body){html+=Buffer.from(b).toString();if(firstCard===null&&/<article\b[^>]*class="book-card/.test(html))firstCard=performance.now()-start;}return {path,ttfb,firstCard,bodyMs:performance.now()-start,html:strip(html)};}
const results=[];
for(const locale of ['nl','en']){
 const lists=[];
 for(const slug of ['dystopie-vanaf-1990','fantasy-sciencefiction']){
  const r=await read('/'+locale+'/toplijsten/'+slug);
  const cards=[...r.html.matchAll(/<article\b[^>]*id="work-(\d+)"[^>]*>([\s\S]*?)<\/article>/g)].map(([,id,c])=>({id:Number(id),title:decode(c.match(/<h3[^>]*>(.*?)<\/h3>/s)?.[1]),score:c.match(/class="score-badge[^>]*>[\s\S]*?<strong[^>]*>(.*?)<\/strong>/)?.[1],image:decode(c.match(/<img\b[^>]*src="([^"]+)"/)?.[1])}));
  if(slug.startsWith('dystopie'))assert.deepEqual(cards.map(c=>c.id),required);
  for(const c of cards)assert.equal(c.score,'—','No test ratings may be manufactured');
  lists.push({slug,cards});results.push({...r,html:undefined,cards});
 }
 for(const id of required.concat(extra)){
  const slug=required.includes(id)?'dystopie-vanaf-1990':'fantasy-sciencefiction';
  const r=await read('/'+locale+'/book/'+id+'?returnTo=%2Ftoplijsten%2F'+slug),card=lists.find(l=>l.slug===slug).cards.find(c=>c.id===id);
  assert.ok(card);const title=decode(r.html.match(/<h1[^>]*>(.*?)<\/h1>/s)?.[1]);assert.equal(title,card.title);
  const score=r.html.match(/aria-labelledby="lumiscore-heading"[\s\S]*?<strong[^>]*>(.*?)<\/strong>/)?.[1];assert.equal(score,card.score);
  const image=decode(r.html.match(/<img\b[^>]*src="([^"]+)"/)?.[1]);if(card.image)assert.equal(image?.replace(/-[MLS]\.jpg/,'-SIZE.jpg'),card.image.replace(/-[MLS]\.jpg/,'-SIZE.jpg'));
  assert.ok(r.html.includes('/'+locale+'/toplijsten/'+slug),'Verified return');
  results.push({...r,html:undefined,id,title,score,image});
 }
}
await writeFile(new URL('../../catalog/editorial-parity-20261021/campaign-local-test-html.json',import.meta.url),JSON.stringify({checkedAt:new Date().toISOString(),origin,environment:'actual local application + isolated test database; not hosted latency',results},null,2));
console.log(JSON.stringify({routes:results.length,detailPages:32,listPages:4,passed:true}));
