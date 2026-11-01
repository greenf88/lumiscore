// Two existing test-only editions; separate from the160 production actions.
import fs from'node:fs/promises';import{createHash}from'node:crypto';import{createRequire}from'node:module';
const require=createRequire(import.meta.url),sharp=createRequire(require.resolve('next/package.json'))('sharp');
const dir=new URL('../catalog/nl-research-005-20261101/',import.meta.url),rows=[];
for(const[id,isbn]of[[65,'9789022574492'],[48,'9789056727659']]){
 const s=JSON.parse(await fs.readFile(new URL(`sources/fixture${id}-exact-edition.json`,dir))),e=s.editions.find(e=>e.facts.includes(isbn));
 if(!e||e.format!=='Paperback'||!e.covers[0])throw Error('Exact print binding missing');
 const start=Date.now(),r=await fetch(e.covers[0],{signal:AbortSignal.timeout(16000)});if(!r.ok)throw Error('Asset refused '+r.status);
 const b=Buffer.from(await r.arrayBuffer()),m=await sharp(b).metadata(),o={workId:id,isbn,url:e.covers[0],source:s.url,sourceHash:s.sha256,at:new Date().toISOString(),status:r.status,bytes:b.length,ms:Date.now()-start,sha256:createHash('sha256').update(b).digest('hex'),width:m.width,height:m.height};
 await fs.writeFile(new URL('cover-assets/fixture-'+id+'.jpg',dir),b);rows.push(o);console.log(JSON.stringify(o));
 await new Promise(r=>setTimeout(r,1700));
}
await fs.writeFile(new URL('fixture-cover-transport.json',dir),JSON.stringify(rows,null,2)+'\n');
await sharp({create:{width:500,height:400,channels:3,background:'#fff'}}).composite(await Promise.all(rows.map(async(r,i)=>({input:await sharp(await fs.readFile(new URL('cover-assets/fixture-'+r.workId+'.jpg',dir))).resize(230,380,{fit:'inside'}).toBuffer(),left:i*250,top:0})))).png().toFile(new URL('cover-review-fixtures.png',dir).pathname.replace(/^\/(\w:)/,'$1'));
