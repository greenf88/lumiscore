import fs from'node:fs';import{ROOT,CACHE,hash}from'./nl-continuation-bootstrap.mjs';
const rows=JSON.parse(fs.readFileSync(new URL('cover-large-bulk-readback-001.json',ROOT),'utf8'));
for(const r of rows){if(!r.sha256)continue;const src=new URL('archive-covers/'+r.coverId+'-large.jpg',CACHE),dest=new URL('covers/'+r.coverId+'-L.jpg',CACHE);const raw=fs.readFileSync(src);if(hash(raw)!==r.sha256)throw Error('Drift');
 const file=new URL('cover-'+r.coverId+'.json',ROOT),old=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):null;
 if(old?.sha256&&old.sha256!==r.sha256)throw Error('Already successful image differs; separate review required');
 fs.mkdirSync(new URL('covers/',CACHE),{recursive:true});fs.copyFileSync(src,dest);
 fs.writeFileSync(file,JSON.stringify({...r,sourceRoute:'Documented large TAR dataset, original archive unavailable; no access-denial workaround',priorTransport:old&&!old.sha256?old:undefined,decodeAndIdentityPending:true},null,2)+'\n');
}
const targets=JSON.parse(fs.readFileSync(new URL('cover-large-bulk-request-001.json',ROOT),'utf8')).targets;
fs.writeFileSync(new URL('cover-archive-request-tar-snapshot.json',ROOT),JSON.stringify({targets},null,2)+'\n');
// Sheet utility accepts a named explicit manifest, default remains regular batch.
console.log({normalized:rows.filter(r=>r.sha256).length});
