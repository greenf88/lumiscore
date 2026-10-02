// Explicit target-bound PostgreSQL runner. No dotenv, Supabase project link or migrations.
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import tls from 'node:tls';
import { importSelection } from './catalog-selection-db.mjs';
import { reviewedInput, sha256 } from './catalog-selection-inputs.mjs';
import { digest } from './catalog-selection-core.mjs';

export function safeInteger(value) {
  const result=Number(value);
  if(!Number.isSafeInteger(result))throw new Error('Database integer outside safe range');
  return result;
}
/**
 * @typedef {Object} ImportTarget
 * @property {'lumiscore-catalog-target-2'} schema
 * @property {'production'|'local-test'} environment
 * @property {true} dry_run Require a read-only first execution; apply also needs a bound dry-run artifact.
 * @property {boolean} tls
 * @property {{form:'session-pooler'|'direct',host:string,port:number,database:string,login_username:string,project_ref:string|null}} connection
 * @property {{database:string,current_user:string,session_user:string,database_oid:string,system_identifier:string}} session
 */
const productionProject='qvplwejffhjvxaypmjut';
const connectionFields=['form','host','port','database','login_username','project_ref'];
const sessionFields=['database','current_user','session_user','database_oid','system_identifier'];
function exactFields(object,fields) {
  if(!object||Array.isArray(object)||typeof object!=='object'
    ||Object.keys(object).length!==fields.length||fields.some(k=>!Object.hasOwn(object,k)))
    throw new Error('Missing or unknown target identity fields');
}
/** No legacy/fuzzy fallback: production Pooler and local direct are separate rule sets. */
export function validateTarget(target) {
  exactFields(target,['schema','environment','dry_run','tls','connection','session']);
  if(target.schema!=='lumiscore-catalog-target-2')throw new Error('Unsupported target schema');
  if(target.dry_run!==true)throw new Error('Target requires explicit initial dry-run');
  if(!['production','local-test'].includes(target.environment))throw new Error('Explicit target environment required');
  exactFields(target.connection,connectionFields);exactFields(target.session,sessionFields);
  const c=target.connection,s=target.session;
  if(typeof c.host!=='string'||!c.host||!Number.isInteger(c.port))throw new Error('Invalid connection identity types');
  if(c.database!=='postgres'||s.database!=='postgres')throw new Error('Unexpected database identity');
  if(s.current_user!=='postgres')throw new Error('Unexpected approved current_user role');
  if(s.session_user!=='postgres')throw new Error('Unexpected approved session_user role');
  for(const k of ['database_oid','system_identifier'])
    if(typeof s[k]!=='string'||!/^[1-9]\d*$/.test(s[k]))throw new Error('Invalid database fingerprint field');
  if(process.env.NODE_TLS_REJECT_UNAUTHORIZED==='0')throw new Error('Unsafe TLS process configuration');
  if(target.environment==='production') {
    if(target.tls!==true)throw new Error('Production requires verified TLS');
    if(c.form!=='session-pooler')throw new Error('Unsupported production connection form');
    if(!/^aws-\d+-[a-z0-9-]+\.pooler\.supabase\.com$/.test(c.host))throw new Error('Invalid approved Session Pooler host');
    if(c.port!==5432)throw new Error('Unexpected Session Pooler port');
    if(c.project_ref!==productionProject)throw new Error('Unexpected approved project_ref');
    if(c.login_username!==`postgres.${productionProject}`)throw new Error('Unexpected approved Pooler login_username');
  } else {
    if(c.form!=='direct'||c.host!=='127.0.0.1'||c.port!==54322||c.login_username!=='postgres'
      ||c.project_ref!==null||target.tls!==false)throw new Error('Invalid local-test direct connection identity');
  }
  return target;
}
function verifiedHostname(host,certificate) {
  if(tls.checkServerIdentity(host,certificate))return new Error('TLS hostname verification failed');
}
export function connectionConfig(raw,target) {
  validateTarget(target);
  let url,loginUsername,password,database;
  try {
    url=new URL(raw);loginUsername=decodeURIComponent(url.username);
    password=decodeURIComponent(url.password);database=decodeURIComponent(url.pathname.slice(1));
  }catch{throw new Error('Invalid database connection encoding');}
  if(!['postgres:','postgresql:'].includes(url.protocol)||url.hash||!password||!url.port)
    throw new Error('Invalid database connection options');
  // Never pass connectionString to pg: libpq options cannot replace verified TLS.
  const parameters=[...url.searchParams];
  if(parameters.length && (target.environment!=='production'||parameters.length!==1
    ||parameters[0][0]!=='sslmode'||!['require','verify-ca','verify-full'].includes(parameters[0][1])))
    throw new Error('Unsupported database query parameters');
  const actual={host:url.hostname,port:Number(url.port),database,login_username:loginUsername};
  for(const key of ['host','port','database','login_username'])
    if(actual[key]!==target.connection[key])throw new Error('Connection identity mismatch: '+key);
  if(target.environment==='production') {
    const match=/^postgres\.([a-z]{20})$/.exec(loginUsername);
    if(!match||match[1]!==target.connection.project_ref)throw new Error('Connection project_ref mismatch');
  }
  return {host:actual.host,port:actual.port,database:actual.database,user:loginUsername,password,
    ssl:target.tls?{rejectUnauthorized:true,checkServerIdentity:verifiedHostname,servername:actual.host}:false,
    connectionTimeoutMillis:10000,statement_timeout:30000,application_name:'lumiscore-catalog-selection',
    types:{getTypeParser:(oid,format)=>oid===20?safeInteger:pg.types.getTypeParser(oid,format)}};
}
export async function fingerprint(client) {
  const {rows}=await client.query(`select current_database() as database, current_user as "current_user",
    session_user as "session_user",
    (select oid::text from pg_database where datname=current_database()) as database_oid,
    (select system_identifier::text from pg_control_system()) as system_identifier`);
  if(rows.length!==1)throw new Error('Missing live database session identity');
  return rows[0];
}
export async function verifyTarget(client,target) {
  validateTarget(target);
  const actual=await fingerprint(client);
  for(const key of sessionFields)
    if(typeof actual[key]!=='string'||target.session[key]!==actual[key])
      throw new Error('Live database session fingerprint mismatch: '+key);
  return actual;
}
export function verifyTransport(client,target) {
  validateTarget(target);
  if(!target.tls)return;
  const ssl=client.connectionParameters?.ssl,stream=client.connection?.stream;
  if(ssl?.rejectUnauthorized!==true||ssl.checkServerIdentity!==verifiedHostname
    ||ssl.servername!==target.connection.host||stream?.encrypted!==true||stream.authorized!==true)
    throw new Error('Verified TLS transport required');
  if(verifiedHostname(target.connection.host,stream.getPeerCertificate(true)))
    throw new Error('TLS hostname verification failed');
}
export function postgresAdapter(client,target,{apply=false}={}) {
  validateTarget(target);
  if(typeof apply!=='boolean')throw new Error('Explicit boolean execution mode required');
  const query=(sql,params)=>client.query(sql,params);
  return {query,exec:query,transaction:async callback=>{
    verifyTransport(client,target);
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
export async function probeTarget(client,target) {
  return postgresAdapter(client,target).transaction(async tx=>{
    const state=(await tx.query("select current_setting('transaction_read_only') as read_only")).rows[0];
    if(state?.read_only!=='on')throw new Error('Read-only target probe required');
    return {status:'TARGET VERIFIED',mode:'inspect',environment:target.environment,
      connectionForm:target.connection.form,port:target.connection.port,
      checks:{connectionIdentity:true,projectIdentity:true,databaseSessionIdentity:true,
        tlsVerified:target.tls,readOnly:true}};
  });
}
export function reviewedDryRun(approved,target,input) {
  if(approved?.schema!=='lumiscore-catalog-run-2'||approved.mode!=='dry-run'||approved.result?.applied!==false)
    throw new Error('Apply requires a prior reviewed dry-run artifact');
  if(!approved.plan||approved.plan.schema!=='lumiscore-selection-plan-1'||!Array.isArray(approved.plan.actions)
    ||approved.plan.source_hash!==digest(input.records)||approved.target_sha256!==digest(target)
    ||approved.manifest_sha256!==input.manifestSha256)throw new Error('Reviewed plan target/input mismatch');
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
    reviewedDryRun(approved,target,input);
  }
  const client=new pg.Client(config);
  try {
    await client.connect();
    if(inspect)return await probeTarget(client,target);
    const result=await importSelection(postgresAdapter(client,target,{apply}),input.records,input.pins,approved?.plan,{apply});
    const {schema,source_hash,actions,counts}=result;
    const report={schema:'lumiscore-catalog-run-2',mode:apply?'apply':'dry-run',target_sha256:digest(target),
      version:input.manifest.version,manifest_sha256:input.manifestSha256,
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
  try{
    const report=await main(process.argv.slice(2));
    // Whitelist stdout; never print connection/session identities or untrusted fields.
    console.log(JSON.stringify(report.mode==='inspect'?report:{schema:report.schema,mode:report.mode,
      version:report.version,manifest_sha256:report.manifest_sha256,counts:report.plan.counts,result:report.result},null,2));
  }
  catch(error){
    // PostgreSQL details, error.message and connection URLs may contain credentials/data.
    console.error(JSON.stringify({status:'FAILED',sqlstate:/^[0-9A-Z]{5}$/.test(error.code??'')?error.code:null,
      message:'Import stopped. Verify target, frozen inputs and reviewed plan; no automatic retry. Check transaction outcome before resuming.'}));
    process.exitCode=1;
  }
}
