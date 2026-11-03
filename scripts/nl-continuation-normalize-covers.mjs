import fs from'node:fs';import{ROOT,CACHE,hash}from'./nl-continuation-bootstrap.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL(n,ROOT),'utf8'));
const ts=read('cover-archive-request.json').targets,rs=read('cover-archive-v2-readback.json');
for(const t of ts){const r=rs.find(r=>r.coverId===t.coverId);if(!r)continue;const src=new URL('archive-covers/'+t.coverId+'.jpg',CACHE),dest=new URL('covers/'+t.coverId+'-L.jpg',CACHE),receipt=new URL('cover-'+t.coverId+'.json',ROOT);if(fs.existsSync(receipt))continue;
 if(r.sha256&&fs.existsSync(src)){const b=fs.readFileSync(src);if(hash(b)!==r.sha256)throw Error('Cached image drift');fs.mkdirSync(new URL('covers/',CACHE),{recursive:true});fs.copyFileSync(src,dest);}
 fs.writeFileSync(receipt,JSON.stringify({...t,...r,inheritedOrArchiveTransportOnly:true,decodeAndIdentityPending:true},null,2)+'\n');
}
console.log(JSON.stringify(ts.map(t=>({case:t.caseNumber,cover:t.coverId,receipt:fs.existsSync(new URL('cover-'+t.coverId+'.json',ROOT)),image:fs.existsSync(new URL('covers/'+t.coverId+'-L.jpg',CACHE))}))));
