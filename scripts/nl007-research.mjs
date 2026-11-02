// Read-only source research/control. Never connects to a database or writes older cohorts.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const root=new URL('../catalog/nl-research-007-20261101/',import.meta.url);
const read=(n,base=root)=>JSON.parse(fs.readFileSync(new URL(n,base)));
const save=(n,v)=>fs.writeFileSync(new URL(n,root),JSON.stringify(v,null,2)+'\n');
fs.mkdirSync(root,{recursive:true});
const hash=b=>createHash('sha256').update(b).digest('hex');
if(process.argv[2]==='prepare'){
 const previous=fs.readFileSync(new URL('../nl-research-006-20261101/cumulative-register.jsonl',root),'utf8').trim().split(/\r?\n/u).map(JSON.parse);
 const inventory=read('../../../lumiscore-nl-availability-20261031/catalog/nl-availability-20261031/production-public-snapshot.json');
 const closed=new Set(previous.filter(r=>r.closedInBoundedSourceReview).map(r=>r.workId));
 const existing=[1009,1010,1012,1022,1023,1026,1030,1032,1036,1056,1065,1068,1069,1107,1110,1142,1143,1146,1174,1175,1176,1194,1197,1199,1206,1207,1208,1209,1254,1256,82,83,84,85,86,87,88,89,91,92,94,95,96,97,98,99,101,103,104,106,108,109,110,111,112,115,116,118,119,120,122,123,124,127,129,130,133,136,140,142];
 assert.equal(existing.length,70);assert(existing.every(id=>!closed.has(id)));
 const pending=existing.map(id=>{const w=inventory.works.find(w=>w.id===id);assert(w);return{candidateId:String(id),workId:id,title:w.title,author:inventory.authors.find(a=>a.id===w.author_id)?.name,work:w,collections:inventory.collectionLinks.filter(l=>l.work_id===id).map(l=>inventory.collections.find(c=>c.id===l.collection_id)?.slug),status:'not_yet_researched',priorityKind:'public_collection_or_recognisable_backlist_not_claimed_bestseller'};});
 save('existing70-selection.json',{at:new Date().toISOString(),baseSha:'a9d717878b3fb8c9cfe7367f09d1941b0c1ecfe2',rows:pending});
 const ids=existing.join(',');
 fs.writeFileSync(new URL('existing70-readonly.sql',root),`BEGIN TRANSACTION READ ONLY; select jsonb_build_object('project','qvplwejffhjvxaypmjut','at',now(),'works',(select jsonb_agg(to_jsonb(w)order by id)from public.works w where id in(${ids})),'authors',(select jsonb_agg(to_jsonb(a)order by id)from public.authors a where id in(select author_id from public.works where id in(${ids}))),'editions',(select jsonb_agg(to_jsonb(e)order by id)from public.editions e where work_id in(${ids})),'metadata',(select coalesce(jsonb_agg(to_jsonb(m)order by edition_id),'[]')from public.catalog_edition_metadata m where work_id in(${ids})),'descriptions',(select coalesce(jsonb_agg(to_jsonb(d)order by work_id,language),'[]')from public.catalog_work_descriptions d where work_id in(${ids})),'aliases',(select coalesce(jsonb_agg(to_jsonb(t)order by work_id,title),'[]')from public.catalog_work_title_aliases t where work_id in(${ids}))) snapshot; COMMIT;\n`);
 console.log(pending.map(r=>[r.workId,r.title,r.author,r.collections.join('|')].join('\t')).join('\n'));
}else if(process.argv[2]==='seo'){
 const dir='C:/Users/rickg/.codex/.chatgpt-projects/g-p-6a88a9eeda5c819181702eb71c430b4d/social-media/seo-content/20261030/';
 const old=read('../nl-research-006-20261101/seo-priority-reference-check.json');
 const files=old.files.map(f=>({name:f.name,sha256:hash(fs.readFileSync(dir+f.name)),unchanged:hash(fs.readFileSync(dir+f.name))===f.sha256}));
 save('seo-reference-check.json',{at:new Date().toISOString(),rootReadOnly:dir,files,unchanged:files.every(f=>f.unchanged),previousMapping:'../nl-research-004-20261101/seo-catalog-readiness.json',contentState:'Concept is priority signal, not bibliographic evidence or authorisation to publish.'});console.log(files);
}else if(process.argv[2]==='pool'){
 const inventory=read('../../../lumiscore-nl-availability-20261031/catalog/nl-availability-20261031/production-public-snapshot.json');
 const previous=fs.readFileSync(new URL('../nl-research-006-20261101/cumulative-register.jsonl',root),'utf8').trim().split(/\r?\n/u).map(JSON.parse);
 const norm=s=>s.normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]+/gu,'').toLowerCase();
 const pool=read('popular-priority-pool.json');
 const mapped=pool.candidates.map(q=>{const matches=inventory.works.filter(w=>[q.title,q.originalTitle].filter(Boolean).some(t=>norm(w.title)===norm(t)));return{...q,matches:matches.map(w=>({id:w.id,title:w.title,authorId:w.author_id,author:inventory.authors.find(a=>a.id===w.author_id)?.name,previousReviewed:!!previous.find(d=>d.workId===w.id)?.closedInBoundedSourceReview}))};});
 save('priority-pool-inventory-match.json',{at:new Date().toISOString(),rows:mapped,notAbsenceProof:true});
 const rows=mapped.filter(q=>!q.matches.some(m=>m.previousReviewed)).slice(0,30);assert.equal(rows.length,30);
 save('popular30-selection.json',{at:new Date().toISOString(),rows,status:'Selection only; live identity reconciliation and research pending'});
 const quoted=JSON.stringify(rows.map(({title,originalTitle,author})=>({title,originalTitle,author}))).replaceAll("'","''");
 fs.writeFileSync(new URL('popular30-readonly.sql',root),`BEGIN TRANSACTION READ ONLY;with q as(select value->>'title' title,value->>'originalTitle' original,value->>'author' author from jsonb_array_elements('${quoted}'::jsonb)), matched as(select distinct w.id from public.works w join public.authors a on a.id=w.author_id where exists(select 1 from q where lower(w.title)=lower(q.title)or lower(w.title)=lower(q.original)or lower(a.name)=lower(q.author)) or exists(select 1 from public.catalog_work_title_aliases t join q on lower(t.title)=lower(q.title) where t.work_id=w.id))select jsonb_build_object('project','qvplwejffhjvxaypmjut','at',now(),'works',(select coalesce(jsonb_agg(to_jsonb(w)order by id),'[]')from public.works w where id in(select id from matched)),'authors',(select coalesce(jsonb_agg(to_jsonb(a)order by id),'[]')from public.authors a where id in(select author_id from public.works where id in(select id from matched))),'editions',(select coalesce(jsonb_agg(to_jsonb(e)order by id),'[]')from public.editions e where work_id in(select id from matched)),'aliases',(select coalesce(jsonb_agg(to_jsonb(t)order by work_id,title),'[]')from public.catalog_work_title_aliases t where work_id in(select id from matched))) snapshot;COMMIT;\n`);
 console.log(rows.map((r,i)=>[i+1,r.title,r.author,r.matches.map(m=>m.id).join('|')].join('\t')).join('\n'));
}else if(process.argv[2]==='conditions'){
 for(const u of ['https://metadata.isbn.nl/robots.txt','https://metadata.isbn.nl/']){
  const response=await fetch(u,{signal:AbortSignal.timeout(15000)}),html=await response.text();
  if([401,403,429].includes(response.status))throw Error('Provider refusal; no alternate access');
  const facts=u.endsWith('robots.txt')?html.slice(0,4000):[...html.matchAll(/href="([^"]+)"[^>]*>([^<]*(?:voorwaarden|copyright|privacy|contact)[^<]*)/giu)].map(m=>({url:m[1],label:m[2]}));
  const result={url:u,at:new Date().toISOString(),status:response.status,sha256:hash(html),facts,bulkStorageLicenceProven:false};save(u.endsWith('robots.txt')?'metadata-robots.json':'metadata-conditions-links.json',result);console.log(result);
 }
}else if(process.argv[2]==='freeze'){
 if(fs.existsSync(new URL('frozen100.json',root)))throw Error('Already frozen; resume only');
 const existing=read('existing70-selection.json').rows,popular=read('popular30-selection.json').rows,match=read('priority-pool-production-match.json');
 const norm=s=>s.normalize('NFKD').replace(/\p{M}/gu,'').replace(/[^\p{L}\p{N}]+/gu,'').toLowerCase();
 const rows=[...existing.map(r=>({...r,originalTitle:r.title})),...popular.map(q=>{const matches=match.works.filter(w=>[q.title,q.originalTitle].filter(Boolean).some(t=>norm(w.title)===norm(t)));assert(matches.length<2,'Ambiguous exact title must be held: '+q.title);const w=matches[0];return{candidateId:w?String(w.id):'new-'+norm(q.title),workId:w?.id??null,title:q.title,originalTitle:w?.title??q.originalTitle??null,author:q.author,work:w??null,signals:q.signals,status:'not_yet_researched',newWorkNotYetProven:!w};})];
 assert.equal(rows.length,100);assert.equal(new Set(rows.map(r=>r.candidateId)).size,100);
 const aliases={82:'Leerschool Tara Westover',83:'Mijn verhaal Michelle Obama',84:'Lange weg naar de vrijheid Mandela',85:'De wildernis in Krakauer',86:'Het heelal Hawking',87:'Dodelijke lente Rachel Carson',88:'Zelfzuchtige genen Dawkins',89:'Zwaarden paarden ziektekiemen Diamond',91:'Het glazen kasteel Walls',92:'Dilemma omnivoor Pollan',94:'Kleine prins Saint-Exupery',95:'Alice Wonderland Carroll',96:'Geheime tuin Burnett',97:'Anne groene huis Montgomery',98:'Wind wilgen Grahame',99:'Charlotte White',101:'Vouw tijd L Engle',103:'De weg McCarthy',104:'Zeven echtgenoten Evelyn Hugo',106:'Het Stephen King',108:'Edele kunst Manson',109:'Kleurenblind Trevor Noah',110:'Matilda Roald Dahl',111:'Sjakie chocoladefabriek',112:'Rupsje nooitgenoeg',115:'Lied Achilles Miller',116:'Circe Madeline Miller',118:'Onder moeders vleugels Alcott',119:'Oorlog vrede Tolstoj',120:'Spion kou Carre',122:'Tijdmachine Wells',123:'Scherpschutter King',124:'Voordat koffie koud wordt',127:'Dracula Stoker',129:'Drakenvlucht McCaffrey',130:'Bijzondere kinderen Peregrine',133:'Twilight Meyer',136:'Jekyll Hyde Stevenson',140:'Ontheemde Guin',142:'Slachthuis vijf Vonnegut'};
 save('frozen100.json',{at:new Date().toISOString(),baseSha:'a9d717878b3fb8c9cfe7367f09d1941b0c1ecfe2',state:'Selection only, no completed research implied',rows});
 const requests=rows.map(r=>({workId:r.candidateId,name:'discovery-'+r.candidateId,url:'https://metadata.isbn.nl/search.html?search='+encodeURIComponent(aliases[r.workId]??r.title),purpose:'Individual named bibliographic discovery; no language/identity/absence inferred from query',notAnApproval:true}));
 for(let i=0;i<10;i++)save('requests-'+String(i+1).padStart(2,'0')+'.json',requests.slice(i*10,i*10+10));
 console.log({selected:rows.length,existing:rows.filter(r=>r.workId).length,absenceStillRequiresGlobalChecks:rows.filter(r=>!r.workId).length});
}else if(process.argv[2]==='exact-requests'){
 const rows=read('frozen100.json').rows;
 const footer=new Set(['2095315','2110438','1998854','2127115','2127119','2148501','2188555','2160697']);
 const chosen={1199:1,1142:1,1175:1,1207:1,83:1,97:2,108:2,110:2,123:1,127:2,133:1,136:2,1541:1,'new-hetgeschenk':2};
 const rejectedFirst=new Set([86,87,88,92,94,98,99,101,106,1209,1256,120,129,130,140]);
 const requests=[];
 for(const r of rows){
  const d=read('sources/discovery-'+r.candidateId+'.json');
  if(rejectedFirst.has(r.workId)){console.log('TARGETED SEARCH REQUIRED',r.candidateId);continue;}
  const links=d.links.filter(l=>!footer.has(new URL(l.url).pathname.split('/')[1]));
  const first=d.links[chosen[r.workId??r.candidateId]??0];
  if(first&&!footer.has(new URL(first.url).pathname.split('/')[1]))requests.push({workId:r.candidateId,name:'exact-'+r.candidateId,url:first.url,purpose:'Observed candidate edition page only; title/author/format/language/content require explicit review before approval.'});
  else console.log('NO MEANINGFUL HIT',r.candidateId,r.title,links);
 }
 for(let i=0;i<requests.length;i+=10)save('exact-requests-'+String(i/10+1).padStart(2,'0')+'.json',requests.slice(i,i+10));
 console.log({requests:requests.length,notApprovals:true});
}else throw Error('prepare/seo/pool/conditions/freeze/exact-requests');
