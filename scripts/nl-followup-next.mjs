// Deterministic queue from retained evidence. No new network traffic, DB client or research-completion inference.
import fs from 'node:fs';import{createHash}from'node:crypto';
const root=new URL('../catalog/nl-followup-002-20261031/',import.meta.url);
// Paths are explicit sibling worktree references; source packages are read-only.
const base=new URL('../../lumiscore-nl-availability-20261031/catalog/nl-availability-20261031/',import.meta.url);
const integrity=new URL('../../lumiscore-catalog-integrity-20261030/catalog/',import.meta.url);
const inputs={},read=(n,url)=>{const raw=fs.readFileSync(url,'utf8');inputs[n]={sha256:createHash('sha256').update(raw).digest('hex')};return raw;};
const snapshot=JSON.parse(read('frozen-public-snapshot',new URL('production-public-snapshot.json',base)));
const inventory=read('research-register',new URL('repair-register.jsonl',base)).trim().split(/\r?\n/u).map(JSON.parse);
const source=JSON.parse(read('retained-exact-edition-sources',new URL('integrity-repair-20261030/whole-catalog-edition-source-review.json',integrity)));
const pilot=JSON.parse(read('original-pilot100',new URL('nl-expansion-20261029/candidates.json',integrity))).candidates;
const pr62=JSON.parse(read('PR62-reference',new URL('pr62-plan-reference.json',base)));
const pr63=JSON.parse(read('frozen-PR63-plan',new URL('../hebban-priority-20261031/production-plan.json',base)));
const dossiers=JSON.parse(fs.readFileSync(new URL('dossiers.json',root))).dossiers;
const nextReviews=JSON.parse(fs.readFileSync(new URL('next100-reviewed.json',root))).dossiers;
const protectedIds=new Set([...pr62.actions,...pr63.actions].map(a=>Number(a.after.work_id??a.key?.id)).filter(Number.isFinite));
const priorPilotIds=new Set(pilot.flatMap(c=>[c.existingWorkId,...(c.identityCandidates??[]).map(x=>x.id)]).filter(Boolean));
for(const d of dossiers){protectedIds.add(d.workId);if(d.relatedWorkId)protectedIds.add(d.relatedWorkId);}
const byWork=new Map();for(const s of source){const row=byWork.get(s.workId)??[];row.push(s);byWork.set(s.workId,row);}
const campaigns=JSON.parse(fs.readFileSync(new URL('../lib/catalog/editorial-campaigns-20261028.json',import.meta.url)));
const editorial=new Set(campaigns.lists.flatMap(l=>l.workIds.map(Number)));
const collectionsFor=id=>snapshot.collectionLinks.filter(l=>l.work_id===id).map(l=>({slug:snapshot.collections.find(c=>c.id===l.collection_id)?.slug,position:l.sequence_number}));
const candidates=inventory.filter(r=>!protectedIds.has(r.workId)&&!priorPilotIds.has(r.workId)&&r.research?.assessment?.outcome==='insufficient_evidence_further_sources_required').map(r=>{
 const sources=(byWork.get(r.workId)??[]).filter(s=>r.editionIds.includes(s.editionId));
 const repair=sources.filter(s=>s.sourceLanguage==='nld'&&s.sourceState==='exact_identity_consistent'&&s.isbn&&!r.presentations.nl.eligible);
 const collection=collectionsFor(r.workId),listed=editorial.has(r.workId);
 const priority=repair.length?0:collection.length&&!r.presentations.nl.eligible?1:listed&&!r.presentations.nl.eligible?2:!r.presentations.nl.eligible?3:4;
 return {workId:r.workId,title:r.title,authorId:r.authorId,author:r.author,openLibraryWorkId:r.openLibraryWorkId,technicalNlEligible:r.presentations.nl.eligible,priority,
  selectReason:priority===0?'Existing exact edition source says Dutch; stored eligibility missing. Verify primary evidence/format/identity before correction.':priority===1?'Public collection missing a suitable NL presentation.':priority===2?'Public editorial selection missing NL edition; editorial visibility is NOT sales/popularity evidence.':priority===3?'No technically eligible NL edition; requires independent edition research.':'Dutch technical availability needs content/source review.',
  publicCollections:collection,publicEditorialSelection:listed,popularitySignal:'not_established; no private analytics or invented popularity rank',
  inspected:{scope:'Retained identity/source triage, not completed exact-edition/cover/narrative review',at:'2026-10-31',work:r.openLibraryWorkId,editions:r.editions.map(e=>({id:e.id,title:e.title,isbn13:e.isbn_13,isbn10:e.isbn_10,language:e.language,publisher:e.publisher})),sources:sources.map(s=>({url:s.sourceUrl,snapshot:s.sourceSnapshot,state:s.sourceState,isbn:s.isbn,parentIds:s.parentIds,sourceIsbns:s.sourceIsbns,sourceLanguage:s.sourceLanguage,format:s.format,primaryEvidence:s.primaryEvidence}))},
  researchStatus:'selected_not_substantively_completed',noDutchEditionClaim:false,proposedChange:repair.length?'Potential language/format correction only after primary corroboration; no executable change approved.':'Find verified Dutch print edition on existing Work; if none proved, record insufficient evidence, not absent translation.',
  openChecks:['Exact Work/author/ISBN/translation binding','Explicit exact-edition Dutch language and print format','Exact cover identity plus load','Original source-bound Dutch summary','Alias search and local validation'],
  potentialRepairableExistingEditionIds:repair.map(s=>s.editionId)};
}).sort((a,b)=>a.priority-b.priority||b.publicCollections.length-a.publicCollections.length||a.workId-b.workId).slice(0,100);
if(candidates.length!==100||new Set(candidates.map(x=>x.workId)).size!==100)throw Error('Need100unique non-overlapping candidates');
for(const r of nextReviews){const c=candidates.find(c=>c.workId===r.workId);if(!c)throw Error('New review outside frozen next100');c.researchStatus=r.status;c.reviewedDossier='next100-reviewed.json';c.newlyCheckedSources=r.sources;c.proposedChange=r.status==='approved_local_proposal'?'Existing edition NULL→nld plus exact cover/format binding and original NL summary. No new Work/edition.':r.decision;c.openChecks=r.status==='approved_local_proposal'?['Hosted verification and separately approved install/recovery after confirmation repair']:['Resolve novel/adaptation identity and dependencies; no executable change'];}
const summary={inventory:10223,inventoryIsCompletedResearch:false,queueSize:100,queueInvestigatedWithDecision:nextReviews.length,queueApprovedLocal:nextReviews.filter(r=>r.status==='approved_local_proposal').length,queueBlockedIdentity:nextReviews.filter(r=>r.status.startsWith('blocked_')).length,queueStillToInvestigate:candidates.filter(c=>c.researchStatus==='selected_not_substantively_completed').length,alreadyKnownResearchExcluded:true,originalPilotExcluded:true,pr62Overlap:0,pr63Overlap:0,followupFiveOverlap:0,byPriority:Object.fromEntries([0,1,2,3,4].map(p=>[p,candidates.filter(c=>c.priority===p).length])),initialPotentialRepairableExistingDutchEditions:candidates.filter(c=>c.priority===0).length,stillUnconfirmedRepairable:candidates.filter(c=>c.priority===0&&c.researchStatus==='selected_not_substantively_completed').length,productionWrites:0,hostedTestWrites:0};
fs.writeFileSync(new URL('next100-register.jsonl',root),candidates.map(c=>JSON.stringify(c)).join('\n')+'\n');
fs.writeFileSync(new URL('next100-summary.json',root),JSON.stringify({summary,inputs,sourcePolicy:'Retained evidence reused for100-Work triage; only individually listed requests for reviewed dossiers. No new bulk requests. New automated provider access requires separate current terms review. Bibliography alone cannot approve narrative.',selectionIsNotResearchCompletion:true},null,2)+'\n');
console.log(JSON.stringify(summary));console.log(JSON.stringify(candidates.slice(0,12).map(c=>({id:c.workId,title:c.title,priority:c.priority}))));
