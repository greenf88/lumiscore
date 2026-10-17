import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {resolve} from 'node:path';
import {buildFindings,compareSnapshots,reconcileFindings,renderReport,validateSnapshot} from './operations/core.mjs';

const args=process.argv.slice(2);
if(!args[0] || args.some((x)=>x.startsWith('--'))) throw new Error('Usage: node scripts/operations-report.mjs SNAPSHOT.json [PRIVATE_OUTPUT_DIRECTORY]');
const snapshot=validateSnapshot(JSON.parse(await readFile(resolve(args[0]),'utf8')));
const dest=resolve(args[1] ?? 'work/operations');
async function optional(name, fallback) {
  try {return JSON.parse(await readFile(resolve(dest,name),'utf8'));}
  catch(error) {if(error.code==='ENOENT')return fallback;throw error;}
}
const previous=await optional('snapshot.json',null);
const oldState=await optional('state.json',{schemaVersion:1,items:[]});
const comparison=compareSnapshots(snapshot,previous);
const result=reconcileFindings(buildFindings(snapshot),oldState,snapshot.capturedAt);
await mkdir(dest,{recursive:true,mode:0o700});
for(const [name,value] of Object.entries({
  'snapshot.json':JSON.stringify(snapshot,null,2)+'\n',
  'state.json':JSON.stringify(result.state,null,2)+'\n',
  'changes.json':JSON.stringify(result.changes,null,2)+'\n',
  'report.md':renderReport(snapshot,result,comparison),
})) {const target=resolve(dest,name);await writeFile(target+'.tmp',value,{mode:0o600});await rename(target+'.tmp',target);}
console.log(JSON.stringify({output:dest,changes:result.changes.length,open:result.state.items.filter(x=>x.status==='open').length}));
