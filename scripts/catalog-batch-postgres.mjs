// Separate versioned runner; the frozen Selection V1 contract is not modified.
import fs from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import pg from 'pg';
import {connectionConfig,postgresAdapter,validateTarget} from './catalog-selection-postgres.mjs';
import {validateBatch,digest} from './catalog-batch-core.mjs';
import {executeBatch} from './catalog-batch-db.mjs';
const bytesHash=bytes=>createHash('sha256').update(bytes).digest('hex');
export async function loadBatch(manifestFile,expectedHash){
 if(manifestFile instanceof URL)manifestFile=fileURLToPath(manifestFile);
 if(!/^[a-f0-9]{64}$/.test(expectedHash??''))throw Error('EXPLICIT_MANIFEST_HASH_REQUIRED');
 const bytes=await fs.readFile(manifestFile);if(bytesHash(bytes)!==expectedHash)throw Error('MANIFEST_BYTES_DRIFT');
 const manifest=JSON.parse(bytes);
 if(manifest.schema!=='lumiscore-additive-manifest-1'||!/^candidates-v\d+\.json$/.test(manifest.records_file))throw Error('MANIFEST_CONTRACT_INVALID');
 const recordsBytes=await fs.readFile(path.join(path.dirname(manifestFile),manifest.records_file));
 if(bytesHash(recordsBytes)!==manifest.records_sha256)throw Error('RECORDS_BYTES_DRIFT');
 const input={schema:manifest.batch_schema,slug:manifest.slug,required_new_works:500,records:JSON.parse(recordsBytes)};
 validateBatch(input);if(digest(input)!==manifest.batch_hash)throw Error('BATCH_CONTENT_DRIFT');
 return {input,manifest_sha256:expectedHash};
}
export async function runBatch(client,target,input,manifestHash,{apply=false,approved,confirmation}={}){
 validateTarget(target);validateBatch(input,{local:target.environment==='local-test'});
 if(apply&&(!approved||approved.schema!=='lumiscore-additive-run-1'||approved.mode!=='dry-run'||approved.target_hash!==digest(target)||approved.manifest_hash!==manifestHash||approved.plan_hash!==digest(approved.plan)||approved.plan.batch_hash!==digest(input)))throw Error('REVIEWED_TARGET_BOUND_DRY_RUN_REQUIRED');
 const result=await executeBatch(postgresAdapter(client,target,{apply}),input,{apply,expected:approved?.plan,confirmation,local:target.environment==='local-test'});
 const {schema,batch_hash,actions,counts}=result,plan={schema,batch_hash,actions,counts};
 return {schema:'lumiscore-additive-run-1',mode:apply?'apply':'dry-run',target_hash:digest(target),manifest_hash:manifestHash,plan_hash:digest(plan),plan,result:{applied:result.applied,writes:result.writes},sql_intent:{insert:['public.authors (only new identities)','public.works','public.editions','public.catalog_selections','public.catalog_selection_members','catalog_private.editorial_records'],update:[],delete:[],categories:0,collections:0}};
}
export async function main(args,env=process.env){
 const flags=['--apply'],prefixes=['--target=','--manifest=','--manifest-sha256=','--ca-file=','--plan=','--plan-sha256=','--confirm='];
 if(args.some(a=>!flags.includes(a)&&!prefixes.some(p=>a.startsWith(p)))||[...flags,...prefixes].some(p=>args.filter(a=>a===p||a.startsWith(p)&&p.endsWith('=')).length>1))throw Error('UNKNOWN_OR_DUPLICATE_OPTION');
 const value=p=>args.find(a=>a.startsWith(p))?.slice(p.length);
 const target=JSON.parse(await fs.readFile(value('--target='),'utf8'));
 const loaded=await loadBatch(value('--manifest='),value('--manifest-sha256='));
 let config,client;
 try{config=connectionConfig(env.CATALOG_DATABASE_URL,target);}finally{delete env.CATALOG_DATABASE_URL;}
 try{
 if(target.tls){if(!value('--ca-file='))throw Error('EXPLICIT_APPROVED_CA_REQUIRED');config.ssl.ca=await fs.readFile(value('--ca-file='),'utf8');}
 const apply=args.includes('--apply');let approved;
 if(apply){const bytes=await fs.readFile(value('--plan='));if(bytesHash(bytes)!==value('--plan-sha256='))throw Error('APPROVED_PLAN_BYTES_DRIFT');approved=JSON.parse(bytes);}
 client=new pg.Client({...config,application_name:'lumiscore-additive-batch'});
 let connectionFailed=false;client.on('error',()=>{connectionFailed=true;});
 await client.connect();const result=await runBatch(client,target,loaded.input,loaded.manifest_sha256,{apply,approved,confirmation:value('--confirm=')});if(connectionFailed)throw Error('DATABASE_CONNECTION_TERMINATED');return result;
 }finally{if(client){await client.end().catch(()=>{});client.password='';if(client.connectionParameters)client.connectionParameters.password='';}config.password='';}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{const report=await main(process.argv.slice(2));console.log(JSON.stringify({schema:report.schema,mode:report.mode,manifest_hash:report.manifest_hash,plan_hash:report.plan_hash,counts:report.plan.counts,result:report.result}));}
 catch(error){console.error(JSON.stringify({status:'BLOCKED',code:/^[A-Z_0-9]+$/.test(error.message??'')?error.message:'SAFE_BATCH_STOPPED',sqlstate:/^[0-9A-Z]{5}$/.test(error.code??'')?error.code:null}));process.exitCode=1;}
}
