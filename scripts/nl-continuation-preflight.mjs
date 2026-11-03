// Generate bounded read-only catalogue queries; no database or credentials client.
import fs from'node:fs';import{ROOT}from'./nl-continuation-bootstrap.mjs';
const selected=fs.readdirSync(ROOT).filter(f=>/^reviewed-\d+\.json$/.test(f)).map(f=>JSON.parse(fs.readFileSync(new URL(f,ROOT),'utf8'))).filter(r=>r.status.startsWith('approved_'));
const norm=s=>String(s??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^a-z0-9]/g,'');
const lit=s=>"'"+String(s).replaceAll("'","''")+"'",arr=xs=>'array['+[...new Set(xs.filter(x=>x!==null&&x!==undefined))].map(lit).join(',')+']::text[]';
const ids=selected.map(r=>r.workId).filter(Number.isInteger),aids=[...new Set([...selected.map(r=>r.proposedWork?.primaryAuthor?.existingId).filter(Number.isInteger),3285])];
const sourceWorks=selected.map(r=>r.proposedWork?.sourceWorkKey).filter(Boolean),sourceAuthors=selected.map(r=>r.proposedWork?.primaryAuthor?.sourceAuthorKey).filter(Boolean);
const titles=selected.flatMap(r=>[r.edition.title,r.proposedWork?.originalTitle,...(r.caseNumber===52?["The Memory Keeper's Daughter"]:[])]).filter(Boolean);
// Include the investigated retitling without approving or importing it.
titles.push('Ik ben de regen','Kleine stinkerd');
const isbn=selected.map(r=>r.edition.isbn13),editionKeys=selected.map(r=>r.edition.sourceKey),authorNames=selected.map(r=>r.proposedWork?.primaryAuthor?.name).filter(Boolean);authorNames.push('Henk van Straten');
const currentFile=new URL('production-preflight-current.json',ROOT);
if(fs.existsSync(currentFile)){
 const p=JSON.parse(fs.readFileSync(currentFile,'utf8')).data;
 for(const w of p.works.filter(w=>ids.includes(w.id))){if(w.open_library_id)sourceWorks.push(w.open_library_id);titles.push(w.title);}
 for(const a of p.authors){if(a.open_library_id)sourceAuthors.push(a.open_library_id);authorNames.push(a.name);}
}
const matches=`select * from public.works where id=any(array[${ids.join(',')}]::bigint[]) or open_library_id=any(${arr(sourceWorks)}) or regexp_replace(lower(normalize(title,NFD)),'[^a-z0-9]','','g')=any(${arr(titles.map(norm))})`;
for(const env of['production','test']){
const project=env==='test'?'hlvujbrmfdlrfxdjwsmb':'qvplwejffhjvxaypmjut';
const query=`with target as(${matches}), a as(select * from public.authors where id in(select author_id from target) or id=any(array[${aids.join(',')}]::bigint[]) or open_library_id=any(${arr(sourceAuthors)}) or regexp_replace(lower(normalize(name,NFD)),'[^a-z0-9]','','g')=any(${arr(authorNames.map(norm))})), e as(select * from public.editions where work_id in(select id from target) or open_library_edition_id=any(${arr(editionKeys)}) or regexp_replace(coalesce(isbn_13,''),'[-[:space:]]','','g')=any(${arr(isbn)})) select jsonb_build_object('project','${project}','checked_at',clock_timestamp(),'works',coalesce((select jsonb_agg(to_jsonb(t) order by id) from target t),'[]'),'authors',coalesce((select jsonb_agg(to_jsonb(t) order by id) from a t),'[]'),'author_corpora',coalesce((select jsonb_agg(to_jsonb(t) order by id) from public.works t where author_id in(select id from a)),'[]'),'editions',coalesce((select jsonb_agg(to_jsonb(t) order by id) from e t),'[]'),'metadata',coalesce((select jsonb_agg(to_jsonb(t) order by edition_id) from public.catalog_edition_metadata t where edition_id in(select id from e)),'[]'),'descriptions',coalesce((select jsonb_agg(to_jsonb(t) order by work_id,language) from public.catalog_work_descriptions t where work_id in(select id from target)),'[]'),'aliases',coalesce((select jsonb_agg(to_jsonb(t) order by work_id,title) from public.catalog_work_title_aliases t where work_id in(select id from target)),'[]')${env==='test'?",'reserved_works',(select count(*) from public.works where id between 998100001 and 998100999),'reserved_editions',(select count(*) from public.editions where id between 998200001 and 998201999),'reserved_authors',(select count(*) from public.authors where id between 998300001 and 998300999)":''}) as snapshot;`;
fs.writeFileSync(new URL(env+'-preflight-current.sql',ROOT),query+'\n');
}
fs.writeFileSync(new URL('preflight-selection.json',ROOT),JSON.stringify({generatedAt:new Date().toISOString(),cases:selected.map(r=>r.caseNumber),existingIds:ids,sourceWorks,editionKeys,isbn,titles,policy:'Read-only; exact source identities, full author corpora and expected full rows. New proposals remain subject to individual collision review.'},null,2)+'\n');
console.log({selected:selected.length,existingIds:ids.length,possibleNew:selected.filter(r=>!r.workId).length});
