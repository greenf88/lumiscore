// Offline scan of this PUBLIC research/import packet, not a nonexistent client build.
import fs from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';import{createHash}from'node:crypto';
const root=fileURLToPath(new URL('../catalog/nl100-completion-20261031/',import.meta.url));
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const packetRoots=[root,fileURLToPath(new URL('../catalog/nl100-hosted-20261031/',import.meta.url)),fileURLToPath(new URL('../catalog/nl-followup-008-20261031/',import.meta.url))];
const files=[...packetRoots.flatMap(walk).filter(f=>!['packet-scan.json','package-hashes.json'].includes(path.basename(f))),...fs.readdirSync(fileURLToPath(new URL('./',import.meta.url))).filter(n=>/^(?:nl100.*|nl-followup008.*)\.(mjs|ps1)$/.test(n)).map(n=>fileURLToPath(new URL(n,import.meta.url)))];
// Mechanical newline normalization is limited to this new packet/own scripts.
// Scoped .gitattributes keeps these raw byte hashes stable across checkouts.
for(const file of files){const raw=fs.readFileSync(file,'utf8'),lf=raw.replaceAll('\r\n','\n');if(raw!==lf)fs.writeFileSync(file,lf);}
const patterns=[/sb_(?:secret|publishable)_[a-zA-Z0-9_-]{12,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/,/(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY)\s*[:=]\s*["'][A-Za-z0-9_.-]{16,}/];
const matches=files.filter(f=>patterns.some(p=>p.test(fs.readFileSync(f,'utf8')))).map(f=>path.relative(root,f).replaceAll('\\','/'));
const proof={environment:'Offline public catalogue proposal and own research/test scripts',filesScanned:files.length,matches,passed:matches.length===0,productionWrites:0,hostedTestWrites:0};
fs.writeFileSync(path.join(root,'packet-scan.json'),JSON.stringify(proof,null,2)+'\n');if(matches.length)throw Error('Sensitive-looking content found');
fs.writeFileSync(path.join(root,'package-hashes.json'),JSON.stringify(Object.fromEntries(files.map(f=>[path.relative(root,f).replaceAll('\\','/'),createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),null,2)+'\n');console.log(JSON.stringify(proof));
