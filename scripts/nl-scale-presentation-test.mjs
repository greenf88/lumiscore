// Owned exact-edition mirrors for reviewed existing-presentation subbatches.
// Local preparation only: separate fixture/release receipts, no database client.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ROOT,readJson} from './nl-scale-snapshot.mjs';
import {renderImport,renderRollback} from './nl-scale-release-sql.mjs';
import{mirrorReviewedEditionPatch}from'./nl-scale-edition-patch.mjs';
import{reviewedExistingMirrors}from'./nl-scale-mirror-reuse.mjs';
const number=process.argv[2],mode=process.argv[3];
if(!/^\d{3}$/.test(number??'')||Number(number)<3)throw Error('Reviewed subbatch number required');
const dir=new URL('subbatches/'+number+'/',ROOT),prod=readJson(new URL('production-preflight.json',dir)).readback,plan=readJson(new URL('production-plan.json',dir));
const offset=(Number(number)-1)*1000,base={works:987100000+offset,editions:987200000+offset,authors:987300000+offset};
const lit=s=>"'"+s.replaceAll("'","''")+"'";
const arr=v=>'array['+[...new Set(v)].map(lit).join(',')+']::text[]';
if(mode==='preflight'){
 const identities=[...prod.editions,...plan.actions.filter(a=>a.relation==='editions').map(a=>a.after)];
 const q=`with a as(select * from public.authors where open_library_id=any(${arr(prod.authors.map(a=>a.open_library_id))})),w as(select * from public.works where open_library_id=any(${arr(prod.works.map(w=>w.open_library_id))})) select jsonb_build_object('checked_at',clock_timestamp(),'project','hlvujbrmfdlrfxdjwsmb','authors',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from a t),'author_corpora',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.works t where author_id in(select id from a)),'works',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from w t),'editions',(select coalesce(jsonb_agg(to_jsonb(t) order by id),'[]') from public.editions t where work_id in(select id from w) or isbn_13=any(${arr(identities.map(e=>e.isbn_13).filter(Boolean))}) or open_library_edition_id=any(${arr(identities.map(e=>e.open_library_edition_id).filter(Boolean))})),'reserved_range',jsonb_build_object('works',(select count(*) from public.works where id between ${base.works+1} and ${base.works+999}),'editions',(select count(*) from public.editions where id between ${base.editions+1} and ${base.editions+999}),'authors',(select count(*) from public.authors where id between ${base.authors+1} and ${base.authors+999}))) as preflight;`;
 fs.writeFileSync(new URL('test-author-preflight.sql',dir),q+'\n');console.log(q);process.exit(0);
}
function write(name,p){const files={[name+'-plan.json']:JSON.stringify(p,null,2)+'\n',[name+'-import.sql']:renderImport(p,{canary:true}),[name+'-dry-run.sql']:renderImport(p,{dryRun:true,canary:true}),[name+'-rollback.sql']:renderRollback(p)};for(const[n,b]of Object.entries(files))fs.writeFileSync(new URL(n,dir),b);fs.writeFileSync(new URL(name+'-hashes.json',dir),JSON.stringify(Object.fromEntries(Object.entries(files).map(([n,b])=>[n,createHash('sha256').update(b).digest('hex')])),null,2)+'\n');console.log(JSON.stringify({name,...p.summary}));}
const pre=readJson(new URL('test-author-preflight.json',dir)).readback;
if(pre.project!=='hlvujbrmfdlrfxdjwsmb'||Object.values(pre.reserved_range).some(Boolean))throw Error('Exact test identity/range is not empty; revise, never overwrite');
const reuseFile=new URL('test-existing-mirror-review.json',dir),presentationFile=new URL('test-existing-presentation-readback.json',dir);
const reused=reviewedExistingMirrors(prod,pre,fs.existsSync(reuseFile)?readJson(reuseFile):null,fs.existsSync(presentationFile)?readJson(presentationFile):null);
if(mode==='fixture'){
 const actions=[],authors=new Map();let nextAuthor=0;
 for(const a of prod.authors){const old=pre.authors.find(x=>x.open_library_id===a.open_library_id);if(old){authors.set(a.id,old.id);continue;}const ref='a'+(++nextAuthor);actions.push({ref,relation:'authors',key:{open_library_id:a.open_library_id},before:null,after:{id:base.authors+nextAuthor,name:a.name,open_library_id:a.open_library_id}});authors.set(a.id,'@'+ref);}
 const works=new Map();for(const[i,w]of prod.works.entries()){if(reused.works.has(w.id)){works.set(w.id,reused.works.get(w.id).id);continue;}const ref='w'+(i+1);works.set(w.id,'@'+ref);actions.push({ref,relation:'works',key:{native_identity_key:'nlscale:fixture'+number+':'+w.id},before:null,after:{id:base.works+i+1,title:w.title,author_id:authors.get(w.author_id),first_publish_year:w.first_publish_year,open_library_id:w.open_library_id,cover_id:w.cover_id,source_type:w.source_type,work_type:w.work_type,native_identity_key:'nlscale:fixture'+number+':'+w.id}});}
 for(const[i,e]of prod.editions.entries()){if(reused.editions.has(e.id))continue;actions.push({ref:'e'+(i+1),relation:'editions',key:{open_library_edition_id:e.open_library_edition_id},before:null,after:{id:base.editions+i+1,work_id:works.get(e.work_id),title:e.title,language:e.language,open_library_edition_id:e.open_library_edition_id,isbn_10:e.isbn_10,isbn_13:e.isbn_13,publisher:e.publisher,publish_date:null,cover_id:null}});}
 write('test-fixture',{summary:{batch:plan.summary.batch+'-fixture',target:'hlvujbrmfdlrfxdjwsmb',scope:'Owned mirrors only; no production additions',actions:actions.length,newWorks:prod.works.length-reused.works.size,...(reused.works.size?{existingTestWorksReused:reused.works.size,existingTestEditionsReused:reused.editions.size}:{}),newAuthors:nextAuthor,netDutchAvailability:0},bindings:pre.author_corpora.map(w=>({work:w,author:pre.authors.find(a=>a.id===w.author_id)})),authorCorpora:pre.authors.map(a=>({author_id:a.id,rows:pre.author_corpora.filter(w=>w.author_id===a.id)})),actions});
}else if(mode==='release'){
 const full=readJson(new URL('test-fixture-full-readback.json',dir)).readback,wm=new Map(prod.works.map(w=>[w.id,full.works.find(t=>t.open_library_id===w.open_library_id)])),em=new Map(prod.editions.map(e=>[e.id,full.editions.find(t=>t.open_library_edition_id===e.open_library_edition_id)]));
 if([...wm.values(),...em.values()].some(x=>!x))throw Error('Incomplete full test mirror readback');
 const bindings=plan.bindings.map(b=>({work:wm.get(b.work.id),author:full.authors.find(a=>a.id===wm.get(b.work.id).author_id)}));
 let addedEditionCount=0;
 const actions=plan.actions.map(a=>{
  const wid=a.relation==='works'?a.key.id:a.after.work_id,w=wm.get(wid),key={...a.key};let before=a.before,after={...a.after};
  if(a.relation==='works'){key.id=w.id;before=w;after={...w,first_publish_year:a.after.first_publish_year};}
  else if(a.relation==='editions'&&a.before===null){after={...a.after,id:base.editions+full.editions.length+(++addedEditionCount),work_id:w.id,publish_date:null,cover_id:null};}
  else if(a.relation==='editions'){const e=em.get(a.key.id);key.id=e.id;before=e;after=mirrorReviewedEditionPatch(e,a.before,a.after,a.reviewedEditionFieldKeys);}
  else{after.work_id=w.id;after.bound_author_id=w.author_id;if(key.work_id)key.work_id=w.id;if(a.relation==='catalog_edition_metadata'&&!String(a.key.edition_id).startsWith('@')){const e=em.get(a.key.edition_id);key.edition_id=e.id;after.edition_id=e.id;}}
  return{...a,key,before,after};
 });
 write('test',{summary:{...plan.summary,target:'hlvujbrmfdlrfxdjwsmb',scope:'Exact mirrored editions; fixture has separate receipt'},bindings,authorCorpora:[],actions});
}else throw Error('Mode preflight, fixture or release required');
