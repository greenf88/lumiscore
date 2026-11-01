// This is an offline PUBLIC packet scan, not a claim to have scanned non-existent client bundles.
import fs from'node:fs';import path from'node:path';import{createHash}from'node:crypto';import{fileURLToPath}from'node:url';
const root=fileURLToPath(new URL('../catalog/nl-followup-002-20261031/',import.meta.url));
const walk=d=>fs.readdirSync(d,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(path.join(d,e.name)):[path.join(d,e.name)]);
const scripts=fs.readdirSync(fileURLToPath(new URL('./',import.meta.url))).filter(n=>/^nl-(?:followup|next100)[.-].*\.mjs$/.test(n)).map(n=>fileURLToPath(new URL(n,import.meta.url)));
const files=[...walk(root).filter(f=>!f.endsWith('packet-scan.json')&&!f.endsWith('package-hashes.json')),...scripts];
const patterns=[/sb_(?:secret|publishable)_[a-zA-Z0-9_-]{12,}/,/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/,/eyJ[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}\.[a-zA-Z0-9_-]{20,}/,/(?:SUPABASE_SERVICE_ROLE_KEY|SUPABASE_SECRET_KEY)\s*[:=]\s*["'][A-Za-z0-9_.-]{16,}/];
const matches=files.filter(f=>patterns.some(p=>p.test(fs.readFileSync(f,'utf8')))).map(f=>path.relative(root,f).replaceAll('\\','/'));
const proof={environment:'Local offline public-proposal packet only',filesScanned:files.length,matches,passed:matches.length===0,productionWrites:0,hostedTestWrites:0};
fs.writeFileSync(path.join(root,'packet-scan.json'),JSON.stringify(proof,null,2)+'\n');
if(matches.length)throw Error('Sensitive-looking content in '+matches.join(', '));
fs.writeFileSync(path.join(root,'package-hashes.json'),JSON.stringify(Object.fromEntries(files.map(f=>[path.relative(root,f).replaceAll('\\','/'),createHash('sha256').update(fs.readFileSync(f)).digest('hex')])),null,2)+'\n');console.log(JSON.stringify(proof));
