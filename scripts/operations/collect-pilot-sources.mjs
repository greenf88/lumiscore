// Exact Open Library Work reads only. No new identities, labels or database writes.
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const [input,destination]=process.argv.slice(2);
if(!input||!destination)throw new Error('Usage: collect-pilot-sources.mjs PRIVATE_PILOT.json PRIVATE_OUTPUT_DIRECTORY');
const pilot=JSON.parse(await readFile(input,'utf8'));
if(!Array.isArray(pilot)||pilot.length!==100||new Set(pilot.map(x=>x.id)).size!==100)throw new Error('Expected 100 distinct Works.');
await mkdir(destination,{recursive:true,mode:0o700});
const records=[];let consecutiveFailures=0;
for(const work of pilot){
  const olid=work.open_library_id?.split('/').at(-1);
  const row={workId:work.id,title:work.title,author:work.author,existingContentEvidence:work.has_content_traits,
    identityReview:'not-independently-reviewed',humanReview:'pending',proposedTraits:[],
    sourceStatus:'unavailable',sourceUrl:null,description:'',subjects:[]};
  if(/^OL\d+W$/i.test(olid??'')&&consecutiveFailures<5){
    row.sourceUrl=`https://openlibrary.org/works/${olid}.json`;
    try{
      const response=await fetch(row.sourceUrl,{signal:AbortSignal.timeout(12_000),
        headers:{'Accept':'application/json','User-Agent':'LumiScore-Automation/1.0 (metadata research; https://lumisco.re)'}});
      if(response.ok){
        const body=await response.json();
        if(body.key!==`/works/${olid}`)throw new Error('Exact source identity mismatch');
        row.sourceTitle=typeof body.title==='string'?body.title:'';
        row.description=(typeof body.description==='string'?body.description:body.description?.value??'').slice(0,8000);
        row.subjects=Array.isArray(body.subjects)?body.subjects.filter(x=>typeof x==='string').slice(0,100):[];
        row.sourceStatus='fetched-exact-work-key';row.fetchedAt=new Date().toISOString();
        row.sourceHash=createHash('sha256').update(JSON.stringify({title:row.sourceTitle,description:row.description,subjects:row.subjects})).digest('hex');
        consecutiveFailures=0;
      }else{row.sourceStatus=`http-${response.status}`;consecutiveFailures++;}
    }catch(error){row.sourceStatus=`fetch-failed:${error.name}`;consecutiveFailures++;}
    await new Promise(resolve=>setTimeout(resolve,800));
  }else if(!/^OL\d+W$/i.test(olid??'')){row.sourceStatus='no-open-library-work-id';}
  else{row.sourceStatus='stopped-after-five-consecutive-failures';}
  records.push(row);
  await writeFile(`${destination}/sources.json`,JSON.stringify(records,null,2)+'\n',{mode:0o600});
  if(records.length%10===0)console.log(JSON.stringify({processed:records.length,fetched:records.filter(x=>x.sourceStatus==='fetched-exact-work-key').length}));
}
console.log(JSON.stringify({total:records.length,fetched:records.filter(x=>x.sourceStatus==='fetched-exact-work-key').length,
  descriptions:records.filter(x=>x.description).length,note:'Source collection only; no model inference or validation claimed.'}));
