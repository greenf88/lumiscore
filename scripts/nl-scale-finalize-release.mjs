// Freeze the already reviewed/hosted subset. Never executes SQL or changes research decisions.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ROOT,readJson} from './nl-scale-snapshot.mjs';
import {renderImport,renderRollback} from './nl-scale-release-sql.mjs';

const input=readJson(new URL('combined-draft/production-plan.json',ROOT));
const matrix=readJson(new URL('hosted-acceptance-matrix.json',ROOT));
const decisions=readJson(new URL('final-research-decisions.json',ROOT)).decisions;
const exclusions=[
 {candidateId:'work:5028',workId:5028,editionId:5187,title:'Ooit waren er wolven',reason:'Decoded detail cover, but card placeholder; exact card/detail acceptance incomplete.'},
 {candidateId:'work:1628',workId:1628,editionId:1761,title:'Wil',reason:'Decoded detail cover, but card placeholder; exact card/detail acceptance incomplete.'},
 {candidateId:'work:6044',workId:6044,editionId:6203,title:'Nacht Van de Witte Maan',reason:'Both observed source fronts read Nacht van de NIEUWE maan; exact cover identity unresolved.'},
];
const omitted=new Set(exclusions.map(x=>x.candidateId));
const approved=decisions.filter(d=>d.importApproved&&!omitted.has(d.candidateId));
const accepted=new Map(matrix.rows.filter(r=>r.accepted).map(r=>[r.candidateId,r]));
if(approved.length!==498||accepted.size!==498||approved.some(d=>!accepted.has(d.candidateId)))throw Error('Exact hosted subset drift');
const workIds=new Set(exclusions.map(x=>x.workId)),editionIds=new Set(exclusions.map(x=>x.editionId));
const excludedActions=input.actions.filter(a=>
 a.relation==='catalog_work_descriptions'&&workIds.has(a.key.work_id)
 ||a.relation==='catalog_edition_metadata'&&editionIds.has(a.key.edition_id));
if(excludedActions.length!==6||excludedActions.some(a=>a.before!==null))throw Error('Exclusion no longer matches six owned presentation insert proposals');
const removedRefs=new Set(excludedActions.map(a=>a.ref));
const actions=input.actions.filter(a=>!removedRefs.has(a.ref));
const usedRefs=new Set(actions.map(a=>a.ref));
for(const a of actions){
 for(const value of Object.values({...a.key,...a.after}))if(typeof value==='string'&&value.startsWith('@')&&!usedRefs.has(value.slice(1)))throw Error('Dangling action reference');
 if([a.key.id,a.key.work_id,a.after.work_id].some(id=>workIds.has(id))||editionIds.has(a.key.edition_id))throw Error('Excluded identity remains in release');
}
const summary={...input.summary,batch:'nl-scale-20261102-release-498',scope:'FINAL REVIEW PROPOSAL; separate production release approval required',actions:actions.length,rawSubproposalActions:input.summary.rawSubproposalActions-6,newDutchSummaries:498,missingVerifiedCovers:278,exactHostedPresentations:498,decodedReviewedCovers:414,documentedNeutralPlaceholders:84};
const plan={summary,bindings:input.bindings.filter(b=>!workIds.has(b.work.id)),authorCorpora:input.authorCorpora,actions};
if(actions.length!==1492||summary.netDutchAvailability!==235)throw Error('Reviewed release totals drift');
const output=new URL('release/',ROOT);fs.mkdirSync(output,{recursive:true});
const put=(name,value)=>fs.writeFileSync(new URL(name,output),typeof value==='string'?value:JSON.stringify(value,null,2)+'\n');
put('production-plan.json',plan);
put('production-import.sql',renderImport(plan));
put('production-dry-run.sql',renderImport(plan,{dryRun:true}));
put('production-rollback.sql',renderRollback(plan));
put('exclusions.json',{reason:'User requested completion of the current controlled package on 2026-11-03; no new dossiers added. Original research and negative evidence retained.',excludedActions:excludedActions.map(a=>({ref:a.ref,relation:a.relation,key:a.key})),exclusions});
put('hosted-acceptance.json',{...matrix,total:498,accepted:498,remaining:0,scope:'Frozen exact release subset; broader research matrix retained separately. Placeholders explicitly remain placeholders.',rows:matrix.rows.filter(r=>accepted.has(r.candidateId))});
put('dossiers.json',{decisions:approved.map(d=>({...d,testApplied:true,hostedAccepted:true,releaseOffered:true,remaining:[],validation:{browser:'hosted-acceptance.json#'+d.candidateId,committedTestRecovery:'../test-execution-evidence-index.json',productionExecuted:false}})),streams:approved.reduce((o,d)=>(o[d.stream]=(o[d.stream]??0)+1,o),{}),netDutchAvailability:235,notPublished:true});

// SELECT-only production preflight: full-row comparisons, all author corpora and global natural identifiers.
const lit=v=>"'"+JSON.stringify(v).replaceAll("'","''")+"'::jsonb";
const safe=name=>{if(!['authors','works','editions','catalog_work_descriptions','catalog_edition_metadata'].includes(name))throw Error('Unexpected relation');return name;};
const expected={authors:new Map(),works:new Map(),editions:new Map()};
const add=(relation,row)=>{safe(relation);const old=expected[relation].get(row.id);if(old&&JSON.stringify(old)!==JSON.stringify(row))throw Error('Conflicting full old row');expected[relation].set(row.id,row);};
for(const b of plan.bindings){add('works',b.work);add('authors',b.author);}
for(const a of actions.filter(a=>a.before!==null))add(a.relation,a.before);
const datasets=Object.fromEntries(Object.entries(expected).map(([rel,rows])=>[rel,[...rows.values()].map(row=>({id:row.id,expected:row}))]));
const corpora=plan.authorCorpora.map(c=>({author_id:c.author_id,expected:c.rows}));
const inserted=relation=>actions.filter(a=>a.relation===relation&&a.before===null).map(a=>({ref:a.ref,...a.after}));
const newAuthors=inserted('authors'),newWorks=inserted('works'),newEditions=inserted('editions');
const emptyDescriptions=inserted('catalog_work_descriptions').filter(a=>typeof a.work_id==='number').map(a=>({work_id:a.work_id,language:a.language,ref:a.ref}));
const emptyMetadata=inserted('catalog_edition_metadata').filter(a=>typeof a.edition_id==='number').map(a=>({edition_id:a.edition_id,ref:a.ref}));
const issues=Object.entries(datasets).map(([rel,rows])=>`select '${rel} full row '||x.id as issue from jsonb_to_recordset(${lit(rows)}) x(id bigint,expected jsonb) left join public.${rel} t on t.id=x.id where to_jsonb(t) is distinct from x.expected`);
issues.push(`select 'author corpus '||x.author_id from jsonb_to_recordset(${lit(corpora)}) x(author_id bigint,expected jsonb) cross join lateral (select coalesce(jsonb_agg(to_jsonb(w) order by id),'[]'::jsonb) actual from public.works w where w.author_id=x.author_id) c where c.actual is distinct from x.expected`);
issues.push(`select x.ref||' author already exists' from jsonb_to_recordset(${lit(newAuthors)}) x(ref text,open_library_id text) join public.authors t on t.open_library_id=x.open_library_id`);
issues.push(`select x.ref||' Work identity already exists' from jsonb_to_recordset(${lit(newWorks.map(({ref,native_identity_key,open_library_id})=>({ref,native_identity_key,open_library_id})))}) x(ref text,native_identity_key text,open_library_id text) join public.works t on t.native_identity_key=x.native_identity_key or t.open_library_id=x.open_library_id`);
issues.push(`select x.ref||' global edition identity already exists' from jsonb_to_recordset(${lit(newEditions.map(({ref,isbn_10,isbn_13,open_library_edition_id})=>({ref,isbn_10,isbn_13,open_library_edition_id})))}) x(ref text,isbn_10 text,isbn_13 text,open_library_edition_id text) join public.editions t on upper(regexp_replace(coalesce(t.isbn_10,''),'[-[:space:]]','','g'))=x.isbn_10 or regexp_replace(coalesce(t.isbn_13,''),'[-[:space:]]','','g')=x.isbn_13 or t.open_library_edition_id=x.open_library_edition_id`);
issues.push(`select x.ref||' description already exists' from jsonb_to_recordset(${lit(emptyDescriptions)}) x(ref text,work_id bigint,language text) join public.catalog_work_descriptions t using(work_id,language)`);
issues.push(`select x.ref||' metadata already exists' from jsonb_to_recordset(${lit(emptyMetadata)}) x(ref text,edition_id bigint) join public.catalog_edition_metadata t using(edition_id)`);
const checkCount=Object.values(datasets).reduce((n,rows)=>n+rows.length,0)+corpora.length+newAuthors.length+newWorks.length+newEditions.length+emptyDescriptions.length+emptyMetadata.length;
put('preflight-contract.json',{checks:checkCount,fullOldRows:Object.fromEntries(Object.entries(datasets).map(([rel,rows])=>[rel,rows.length])),authorCorpora:corpora.length,newAuthors:newAuthors.length,newWorks:newWorks.length,newEditions:newEditions.length,expectedAbsentDescriptions:emptyDescriptions.length,expectedAbsentMetadata:emptyMetadata.length});
put('production-preflight.sql',`-- SELECT ONLY; exact project qvplwejffhjvxaypmjut, no writes or sequence changes.\n-- Set-based full-row and global identity checks; no per-action catalogue scans.\nwith issues as (${issues.join('\nunion all\n')}) select clock_timestamp() as checked_at,${checkCount} as checks,count(*)::integer as failures,coalesce(jsonb_agg(issue order by issue),'[]'::jsonb) as issues from issues;\n`);
const manifestFiles=['production-plan.json','production-import.sql','production-dry-run.sql','production-rollback.sql','production-preflight.sql','preflight-contract.json','dossiers.json','exclusions.json','hosted-acceptance.json','FINAL-REVIEW.txt','current-readonly-validation.json','search-function-readback.json','performance-and-cover-limitations.json'];
for(const optional of ['net-availability.json','deferred-research.json'])if(fs.existsSync(new URL(optional,output)))manifestFiles.push(optional);
const files=Object.fromEntries(manifestFiles.map(n=>[n,createHash('sha256').update(fs.readFileSync(new URL(n,output))).digest('hex')]));
for(const name of ['install.sql','rollback.sql'])files['../search-normalization/'+name]=createHash('sha256').update(fs.readFileSync(new URL('search-normalization/'+name,ROOT))).digest('hex');
for(const name of ['test-execution-evidence-index.json','hosted-responsive-proof.json','hosted-personal-preference-proof.json','hosted-own-profile-cleanup-proof.json'])files['../'+name]=createHash('sha256').update(fs.readFileSync(new URL(name,ROOT))).digest('hex');
files['../../../supabase/migrations/20261102185143_nl_scale_search_unicode.sql']=createHash('sha256').update(fs.readFileSync(new URL('../../../supabase/migrations/20261102185143_nl_scale_search_unicode.sql',output))).digest('hex');
put('release-hashes.json',{status:'REVIEW_READY_NOT_AUTHORISED',applicationBase:matrix.applicationBase,testedPreviewCommit:matrix.testedCommit,testedDeployment:matrix.deployment,productionProject:'qvplwejffhjvxaypmjut',files,summary,productionWrites:0});
console.log(JSON.stringify({summary,excluded:exclusions.length,preflightChecks:checkCount,manifestSHA256:createHash('sha256').update(fs.readFileSync(new URL('release-hashes.json',output))).digest('hex')}));
