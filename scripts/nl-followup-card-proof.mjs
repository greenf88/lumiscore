// Two observed, same-image variants only. No URL guessing, bulk retries or hosting changes.
import fs from 'node:fs/promises';
import {createHash} from 'node:crypto';
const root=new URL('../catalog/nl-followup-002-20261031/',import.meta.url);
const dom=JSON.parse(await fs.readFile(new URL('card-dom-proof.json',root)));
const covers=JSON.parse(await fs.readFile(new URL('cover-proof.json',root)));
const dimensions={1:[1642,2539],17:[527,800],23:[1401,2146],30:[424,652],1993:[1643,2631]};
const descriptions={1:'Andy Weir, Project Hail Mary; astronaut/planet, Dutch subtitle and Xander mark',17:'Andy Weir, Mars; red planetary surface, Karakter mark',23:'Patrick Rothfuss, De naam van de wind; cloaked figure and tree, Mynx mark',30:'N. K. Jemisin, Het Vijfde Seizoen, De Gebroken Aarde 1; green stone motif',1993:'Niccolò Machiavelli, De heerser; Frans van Dooren/Arnon Grunberg credits, Athenaeum mark'};
for(const r of covers){
 r.visualIdentity='manual_exact_source_image_title_author_match';r.visualReviewAt='2026-10-31';r.visualFinding=descriptions[r.workId];r.dimensions=dimensions[r.workId];
 r.localQAFile=r.localQAFile.replace(/^\/([A-Z]:\/)/,'$1');
 if(![23,1993].includes(r.workId))continue;
 const observed=dom[r.workId===23?'wind':'prince'].find(x=>x.href===r.url)?.images[0];
 if(!observed?.loaded||!observed.width||!observed.height)throw Error('No actually loaded same-source card image');
 if(r.card)continue;
 const response=await fetch(observed.src,{signal:AbortSignal.timeout(18000)}),bytes=Buffer.from(await response.arrayBuffer());
 r.card={url:observed.src,status:response.status,type:response.headers.get('content-type'),bytes:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex'),dimensions:[observed.width,observed.height],at:new Date().toISOString(),evidence:'card-dom-proof.json'};
 if(!response.ok||!r.card.type?.startsWith('image/')||bytes.length<1000)throw Error('Card image failed; do not approve');
 console.log(JSON.stringify({workId:r.workId,card:r.card}));
 await new Promise(resolve=>setTimeout(resolve,1500));
}
await fs.writeFile(new URL('cover-proof.json',root),JSON.stringify(covers,null,2)+'\n');
