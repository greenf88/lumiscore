import fs from 'node:fs';import{ROOT,CACHE}from'./nl-continuation-bootstrap.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL(n,ROOT))),snapshot=read('followup-preflight-readback-012.json').data,cases=fs.readFileSync(new URL('open-cases.jsonl',CACHE),'utf8').trim().split('\n').map(JSON.parse);
if(snapshot.project!=='qvplwejffhjvxaypmjut'||snapshot.works.length||snapshot.editions.length)throw Error('Absence preflight differs');
for(const[n,authorId,title,year]of[[229,3212,'The Way Some People Die',1951],[230,3212,'The Ivory Grin',1952],[231,3212,'The Far Side of the Dollar',null],[233,3321,'Norse Tales: Stories from Across the Rainbow Bridge',2020],[251,3241,'Pen Pals',2002],[263,370,'One Door Away from Heaven',2001],[275,968,'The Red Room',2001],[276,3175,'The Story Sisters',2009]]){
 const file='reviewed-'+n+'.json',r=read(file),c=cases.find(c=>c.caseNumber===n),a=snapshot.authors.find(a=>a.id===authorId);
 if(!a)throw Error('Existing author notverified');r.proposedWork={originalTitle:title,originalYear:year,sourceWorkKey:c.identityChecks[0].sourceWorkKey.replace('/works/',''),primaryAuthor:{id:a.id,name:a.name,sourceKey:a.open_library_id},type:n===233?'story_collection':'novel'};
 r.status='substantive_review_complete_cover_pending';r.currentReadback='followup-preflight-readback-012.json';r.identityDecision+=' Freshproduction012title/ISBN/parentfindsnoWorksoredtions; fullmatchedauthorcorpora read. Reuseauthor'+a.id+', noauthorinsert. Source-approvedidentityonly, nohostedimport.';
 if(n===263)r.identityDecision=r.identityDecision.replace('sameexistingauthor50ifcorpusconfirms','sameexistingauthor370confirmedbycurrentcorpus');
 r.remaining=['Exactfrontdeliveryandvisualreview; group14/15sourceavailabilitynotabsenceofcover',...(n===231?['Original1964/1965conflict requires exactcolophon beforeassigningyear']:[]),'Separate executable manifest/local and hosted acceptance, notfrozenbatch001'];fs.writeFileSync(new URL(file,ROOT),JSON.stringify(r,null,2)+'\n');
}
