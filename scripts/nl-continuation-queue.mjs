import fs from 'node:fs';
import{ROOT,CACHE,PRIOR,hash}from'./nl-continuation-bootstrap.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const rows=fs.readFileSync(new URL('open-cases.jsonl',CACHE),'utf8').trim().split('\n').map(JSON.parse);
const pool=fs.readFileSync(new URL('catalog/nl-scale-20261102/candidate-pool.jsonl',PRIOR),'utf8').trim().split('\n').map(JSON.parse);
const byId=new Map(pool.map(r=>[r.candidateId,r]));
const seo=read(new URL('catalog/nl-scale-20261102/seo-content-dependencies.json',PRIOR));
const ranked=rows.map(r=>({...r,queuePriority:byId.get(r.candidateId)?.priority??null,contentDependencies:byId.get(r.candidateId)?.contentDependencies??null})).sort((a,b)=>{
 const pa=a.queuePriority??{},pb=b.queuePriority??{};
 return Number(Boolean(pb.seoContent))-Number(Boolean(pa.seoContent))||Number(Boolean(pb.dutchSalesOrLoans))-Number(Boolean(pa.dutchSalesOrLoans))||Number(b.currentNlAvailable)-Number(a.currentNlAvailable)||(pb.globalRatingRows??0)-(pa.globalRatingRows??0)||a.caseNumber-b.caseNumber;
});
const oldQueue=new URL('queue.json',ROOT),archive=new URL('queue-initial.json',ROOT);if(fs.existsSync(oldQueue)&&!fs.existsSync(archive))fs.copyFileSync(oldQueue,archive);
fs.writeFileSync(oldQueue,JSON.stringify({createdAt:new Date().toISOString(),rule:'Existing selection only. Lexicographic priorities: existing SEO dependency, separate Dutch sales/loan signal, already-Dutch repair, then global rating rows only as a tie-break and immutable case order. Signals are not added to one popularity score; global rows are not Dutch readers. Completed intervals remain recorded, never reset by queue ordering.',caseSourceSha256:hash(fs.readFileSync(new URL('open-cases.jsonl',CACHE))),cases:ranked.map(r=>({case:r.caseNumber,id:r.candidateId,title:r.title,author:r.author,currentNl:r.currentNlAvailable,priorContentStatus:r.priorContentReview?.contentStatus,signals:r.popularitySignals,priority:r.queuePriority}))},null,2)+'\n');
// Raw source prose remains in ignored research cache; never republish flap texts.
fs.mkdirSync(new URL('packets/',CACHE),{recursive:true});
for(let i=0;i<ranked.length;i+=20)fs.writeFileSync(new URL('packets/'+String(i/20+1).padStart(3,'0')+'.json',CACHE),JSON.stringify(ranked.slice(i,i+20),null,2)+'\n');
console.log(JSON.stringify({remaining:rows.length,currentNl:rows.filter(r=>r.currentNlAvailable).length,priorContentStates:Object.fromEntries([...new Set(rows.map(r=>r.priorContentReview?.contentStatus))].map(s=>[s,rows.filter(r=>r.priorContentReview?.contentStatus===s).length])),first25:ranked.slice(0,25).map(r=>({case:r.caseNumber,id:r.candidateId,title:r.title,author:r.author,priority:r.queuePriority,priorStatus:r.priorContentReview?.contentStatus})),seoKeys:Object.keys(seo)},null,2));
