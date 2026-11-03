// Sequential elapsed research time, including source/tools latency; not staff-hours.
import fs from'node:fs';
import{ROOT}from'./nl-continuation-bootstrap.mjs';
const [command,caseText,outcome]=process.argv.slice(2),caseNumber=Number(caseText);
const file=new URL('timing.json',ROOT),log=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{definition:'Sequential wall-clock research intervals including tool/source latency. Setup, bulk import and later hosted testing are separate. No invented active-time precision.',entries:[]};
if(command==='begin'){
 if(log.entries.some(e=>!e.endedAt))throw Error('Finish current research interval first');
 log.entries.push({caseNumber,startedAt:new Date().toISOString()});
}else if(command==='end'){
 const e=log.entries.find(e=>e.caseNumber===caseNumber&&!e.endedAt);if(!e||!outcome)throw Error('Active interval and outcome required');
 e.endedAt=new Date().toISOString();e.elapsedSeconds=(Date.parse(e.endedAt)-Date.parse(e.startedAt))/1000;e.outcome=outcome;
}else if(command!=='show')throw Error('begin/end/show');
fs.writeFileSync(file,JSON.stringify(log,null,2)+'\n');
const completed=log.entries.filter(e=>e.endedAt),totals=new Map();
for(const e of completed)totals.set(e.caseNumber,(totals.get(e.caseNumber)??0)+e.elapsedSeconds);
const times=[...totals.values()].sort((a,b)=>a-b),middle=Math.floor(times.length/2);
console.log(JSON.stringify({active:log.entries.find(e=>!e.endedAt)??null,completed:totals.size,segments:completed.length,meanSeconds:times.length?times.reduce((a,b)=>a+b,0)/times.length:null,minSeconds:times[0],medianSeconds:times.length?(times.length%2?times[middle]:(times[middle-1]+times[middle])/2):null,maxSeconds:times.at(-1)},null,2));
