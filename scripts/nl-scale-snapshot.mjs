import fs from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
export const ROOT=new URL('../catalog/nl-scale-20261102/',import.meta.url);
export const OUTPUT=new URL('../outputs/nl-scale-20261102/',import.meta.url);
export const readJson=p=>JSON.parse(fs.readFileSync(p,'utf8'));
export function snapshotRows(name){
 const dir=new URL('production-snapshot/',ROOT);
 return fs.readdirSync(dir).filter(f=>f.startsWith(name+'-')&&f.endsWith('.json')).sort().flatMap(f=>readJson(new URL(f,dir)));
}
export function loadSnapshot(){
 const works=snapshotRows('works'),editions=snapshotRows('editions');
 const baseline=readJson(new URL('baseline-current.json',ROOT));
 if(works.length!==baseline.works||editions.length!==baseline.editions||new Set(works.map(w=>w.id)).size!==works.length||new Set(editions.map(e=>e.id)).size!==editions.length)throw Error('Incomplete/duplicate local snapshot');
 return {works,editions,authors:readJson(new URL('production-snapshot/authors.json',ROOT)),metadata:snapshotRows('catalog_edition_metadata'),descriptions:snapshotRows('catalog_work_descriptions'),aliases:snapshotRows('catalog_work_title_aliases'),baseline};
}
export function priorRegister(){
 const base=readJson(new URL('../nl-research-007-20261101/cumulative-register.json',ROOT));
 const raw=fs.readFileSync(new URL('../nl-research-006-20261101/cumulative-register.jsonl',ROOT),'utf8');
 if(createHash('sha256').update(raw).digest('hex')!==base.base.sha256)throw Error('Historical register changed');
 const rows=raw.trim().split('\n').map(JSON.parse);
 const map=new Map(rows.map(r=>[r.workId,r]));
 for(const row of base.updates)map.set(row.workId,row);
 return {rows:[...map.values()],pending:base.pendingIdentities,base};
}
export const localPath=url=>fileURLToPath(url);
