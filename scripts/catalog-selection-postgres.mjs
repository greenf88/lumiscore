// Explicit target-bound PostgreSQL runner. No dotenv, Supabase project link or migrations.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { importSelection } from './catalog-selection-db.mjs';
import { reviewedInput, sha256 } from './catalog-selection-inputs.mjs';
import { digest } from './catalog-selection-core.mjs';

export function safeInteger(value) {
  const result=Number(value);
  if(!Number.isSafeInteger(result))throw new Error('Database integer outside safe range');
  return result;
}
export function connectionConfig(raw,target) {
  if(Object.keys(target).some(k=>!['host','port','database','user','database_oid','system_identifier','tls'].includes(k)))throw new Error('Unknown target field');
  let url;try{url=new URL(raw);}catch{throw new Error('Invalid database connection');}
  if(!['postgres:','postgresql:'].includes(url.protocol)||url.search||url.hash)throw new Error('Invalid database connection options');
  const actual={host:url.hostname,port:Number(url.port||5432),database:decodeURIComponent(url.pathname.slice(1)),user:decodeURIComponent(url.username)};
  for(const key of Object.keys(actual))if(actual[key]!==target[key])throw new Error('Database target mismatch');
  const local=['127.0.0.1','localhost','[::1]'].includes(actual.host);
  if(!local && target.tls!==true)throw new Error('Remote database requires verified TLS');
  return {...actual,password:decodeURIComponent(url.password),ssl:local?false:{rejectUnauthorized:true},
    connectionTimeoutMillis:10000,statement_timeout:30000,application_name:'lumiscore-catalog-selection',
    types:{getTypeParser:(oid,format)=>oid===20?safeInteger:pg.types.getTypeParser(oid,format)}};
}
export async function fingerprint(client) {
  const {rows}=await client.query(`select current_database() as database, current_user as "user",
    (select oid::text from pg_database where datname=current_database()) as database_oid,
    (select system_identifier::text from pg_control_system()) as system_identifier`);
  return rows[0];
}
export async function verifyTarget(client,target) {
  const actual=await fingerprint(client);
  for(const key of ['database','user','database_oid','system_identifier'])
    if(typeof target[key]!=='string'||target[key]!==actual[key])throw new Error('Live database fingerprint mismatch');
  return actual;
}
export function postgresAdapter(client,target,{apply=false}={}) {
  const query=(sql,params)=>client.query(sql,params);
  return {query,exec:query,transaction:async callback=>{
    await query(apply?'begin isolation level serializable':'begin isolation level repeatable read read only');
    try {
      await query("set local lock_timeout = '5s'");
      await query("set local idle_in_transaction_session_timeout = '30s'");
      await verifyTarget(client,target);
      const result=await callback({query,exec:query});
      await query(apply?'commit':'rollback');
      return result;
    } catch(error){await query('rollback').catch(()=>{});throw error;}
  }};
}
export async function main(args,env=process.env) {
  const allowed=['--apply','--inspect'];
  const values=['--target=','--plan=','--plan-sha256=','--out='];
  if(args.some(a=>!allowed.includes(a)&&!values.some(p=>a.startsWith(p))))throw new Error('Unknown option');
  for(const p of [...allowed,...values])if(args.filter(a=>values.includes(p)?a.startsWith(p):a===p).length>1)throw new Error('Duplicate option');
  const value=p=>args.find(a=>a.startsWith(p))?.slice(p.length);
  if(!value('--target='))throw new Error('Explicit target file required');
  const apply=args.includes('--apply'),inspect=args.includes('--inspect');
  if(inspect&&apply)throw new Error('Inspect cannot apply');
  if(apply&&value('--out='))throw new Error('Apply report goes to stdout, not a dry-run file');
  const target=JSON.parse(await fs.readFile(value('--target='),'utf8'));
  const config=connectionConfig(env.CATALOG_DATABASE_URL,target);
  const input=await reviewedInput();
  let approved;
  if(apply){
    if(!value('--plan=')||!/^[a-f0-9]{64}$/.test(value('--plan-sha256=')??''))throw new Error('Apply requires reviewed dry-run file and SHA-256');
    const bytes=await fs.readFile(value('--plan='));
    if(sha256(bytes)!==value('--plan-sha256='))throw new Error('Reviewed plan checksum mismatch');
    approved=JSON.parse(bytes);
    if(!approved.plan||approved.plan.schema!=='lumiscore-selection-plan-1'||!Array.isArray(approved.plan.actions)
      ||approved.plan.source_hash!==digest(input.records)||digest(approved.target)!==digest(target)
      ||approved.manifest_sha256!==input.manifestSha256)throw new Error('Reviewed plan target/input mismatch');
  }
  const client=new pg.Client(config);
  try {
    await client.connect();
    if(inspect)return {fingerprint:await fingerprint(client),notice:'Read-only inspection; independently verify before authorizing this target'};
    await verifyTarget(client,target);
    const result=await importSelection(postgresAdapter(client,target,{apply}),input.records,input.pins,approved?.plan,{apply});
    const {schema,source_hash,actions,counts}=result;
    const report={target,version:input.manifest.version,manifest_sha256:input.manifestSha256,
      plan:{schema,source_hash,actions,counts},result:{applied:result.applied,pending:result.pending,created:result.created,linked:result.linked,unchanged:result.unchanged}};
    if(value('--out=')&&!apply){
      const output=path.resolve(value('--out='));
      const allowedRoot=fileURLToPath(new URL('../outputs/',import.meta.url));
      if(!output.startsWith(allowedRoot))throw new Error('Report must be inside worktree outputs');
      await fs.mkdir(path.dirname(output),{recursive:true});
      await fs.writeFile(output,JSON.stringify(report,null,2)+'\n',{flag:'wx'});
    }
    return report;
  } finally {await client.end().catch(()=>{});}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try{console.log(JSON.stringify(await main(process.argv.slice(2)),null,2));}
  catch(error){
    // PostgreSQL details, error.message and connection URLs may contain credentials/data.
    console.error(JSON.stringify({status:'FAILED',sqlstate:/^[0-9A-Z]{5}$/.test(error.code??'')?error.code:null,
      message:'Import stopped. Verify target, frozen inputs and reviewed plan; no automatic retry. Check transaction outcome before resuming.'}));
    process.exitCode=1;
  }
}
