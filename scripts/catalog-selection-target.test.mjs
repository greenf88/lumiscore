import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {connectionConfig,validateTarget,verifyTarget,verifyTransport,probeTarget,reviewedDryRun,main} from './catalog-selection-postgres.mjs';
import {digest} from './catalog-selection-core.mjs';

// Synthetic endpoint/password only. Unit tests never connect to a remote database.
const host='aws-9-eu-test-9.pooler.supabase.com';
const project='qvplwejffhjvxaypmjut';
const target={schema:'lumiscore-catalog-target-2',environment:'production',dry_run:true,tls:true,
  connection:{form:'session-pooler',host,port:5432,database:'postgres',login_username:`postgres.${project}`,project_ref:project},
  session:{database:'postgres',current_user:'postgres',session_user:'postgres',database_oid:'5',system_identifier:'123'}};
const url=(patch={})=>{
  const u=new URL(`postgresql://postgres.${project}:synthetic-password@${host}:5432/postgres`);
  for(const [key,value] of Object.entries(patch))u[key]=value;
  return u.toString();
};
const changed=(section,key,value)=>{
  const result=structuredClone(target);
  if(section)result[section][key]=value;else result[key]=value;
  return result;
};
const mock=(session=target.session)=>{
  const calls=[],ssl=connectionConfig(url(),target).ssl;
  return {calls,connectionParameters:{ssl},connection:{stream:{encrypted:true,authorized:true,
    getPeerCertificate:()=>({subjectaltname:`DNS:${host}`})}},query:async(sql,params)=>{
    calls.push({sql,params});
    return {rows:sql.includes('transaction_read_only')?[{read_only:'on'}]:[session]};
  }};
};

test('valid production Session Pooler separates login, current role and session role',async()=>{
  const config=connectionConfig(url(),target);
  assert.equal(config.user,target.connection.login_username);
  assert.notEqual(config.user,target.session.current_user);
  assert.equal(config.ssl.rejectUnauthorized,true);
  const client=mock();
  const report=await probeTarget(client,target);
  assert.equal(report.status,'TARGET VERIFIED');
  assert.deepEqual(report.checks,{connectionIdentity:true,projectIdentity:true,databaseSessionIdentity:true,tlsVerified:true,readOnly:true});
  assert.match(client.calls[0].sql,/^begin.*read only$/);
  assert.ok(client.calls.some(c=>c.sql.includes('session_user')));
  assert.equal(client.calls.at(-1).sql,'rollback');
});

for(const [name,patch] of [
  ['wrong Pooler project ref',{username:'postgres.abcdefghijklmnopqrst'}],
  ['correct project substring with wrong full username',{username:`prefix-postgres.${project}`}],
  ['correct project suffix with custom login role',{username:`custom.${project}`}],
  ['extra project suffix',{username:`postgres.${project}.extra`}],
  ['wrong shared Pooler host',{hostname:'aws-8-eu-test-9.pooler.supabase.com'}],
  ['Transaction Pooler port',{port:'6543'}],
  ['alternate database',{pathname:'/other'}],
  ['fragment override',{hash:'#synthetic-token'}],
  ['missing explicit port',{port:''}],
  ['missing password',{password:''}],
  ['malformed credential encoding',{password:'%ZZ'}],
])test('connection rejects '+name,()=>assert.throws(()=>connectionConfig(url(patch),target)));

for(const [name,section,key,value] of [
  ['non-production environment',null,'environment','preview'],
  ['missing dry-run default',null,'dry_run',undefined],
  ['disabled initial dry-run',null,'dry_run',false],
  ['missing TLS',null,'tls',undefined],
  ['disabled TLS',null,'tls',false],
  ['changed approved project','connection','project_ref','abcdefghijklmnopqrst'],
  ['custom approved login','connection','login_username',`custom.${project}`],
  ['custom current role','session','current_user','custom'],
  ['custom session role','session','session_user','custom'],
  ['unknown connection form','connection','form','transaction-pooler'],
  ['production direct connection','connection','form','direct'],
  ['alternate approved port','connection','port',6543],
  ['alternate approved database','connection','database','other'],
  ['string port','connection','port','5432'],
  ['missing server fingerprint','session','system_identifier',null],
])test('target rejects '+name,()=>assert.throws(()=>validateTarget(changed(section,key,value))));

test('all missing or unknown target fields and the legacy generic user model fail closed',()=>{
  for(const section of [null,'connection','session']){
    const fields=Object.keys(section?target[section]:target);
    for(const field of fields){const t=structuredClone(target);delete (section?t[section]:t)[field];assert.throws(()=>validateTarget(t));}
    const t=structuredClone(target);(section?t[section]:t).unknown='synthetic-private-value';assert.throws(()=>validateTarget(t));
  }
  assert.throws(()=>validateTarget({host,port:5432,database:'postgres',user:`postgres.${project}`,tls:true}));
  assert.throws(()=>validateTarget(null));assert.throws(()=>validateTarget([]));
});

for(const field of Object.keys(target.session))test('live session rejects missing or mismatched '+field,async()=>{
  const actual={...target.session,[field]:'wrong'};
  await assert.rejects(()=>verifyTarget(mock(actual),target),/fingerprint mismatch/);
  delete actual[field];await assert.rejects(()=>verifyTarget(mock(actual),target),/fingerprint mismatch/);
  actual[field]=null;await assert.rejects(()=>verifyTarget(mock(actual),target),/fingerprint mismatch/);
});

test('read-only identity failure rolls back and never calls catalog or write operations',async()=>{
  const client=mock({...target.session,session_user:'wrong'});
  await assert.rejects(()=>probeTarget(client,target),/session_user/);
  assert.equal(client.calls.at(-1).sql,'rollback');
  assert.ok(client.calls.every(c=>/^(begin|set local|select|rollback)/.test(c.sql)));
  const missing=mock();missing.query=async()=>({rows:[]});
  await assert.rejects(()=>verifyTarget(missing,target),/Missing live/);
});

test('TLS transport requires verification, encryption and exact certificate hostname',()=>{
  const good=mock();verifyTransport(good,target);
  for(const field of ['encrypted','authorized']){const bad=mock();delete bad.connection.stream[field];assert.throws(()=>verifyTransport(bad,target),/TLS/);}
  for(const field of ['rejectUnauthorized','checkServerIdentity','servername']){
    const bad=mock();delete bad.connectionParameters.ssl[field];assert.throws(()=>verifyTransport(bad,target),/TLS/);
  }
  const bad=mock();bad.connection.stream.getPeerCertificate=()=>({subjectaltname:'DNS:wrong.example'});
  assert.throws(()=>verifyTransport(bad,target),/hostname/);
});

test('TLS query parameters never replace verified pg options; other or duplicate parameters rejected',()=>{
  for(const value of ['require','verify-ca','verify-full']){
    const config=connectionConfig(url({search:'?sslmode='+value}),target);
    assert.equal(config.ssl.rejectUnauthorized,true);assert.equal(config.ssl.servername,host);
    assert.ok(!Object.hasOwn(config,'connectionString'));
  }
  for(const search of ['?sslmode=no-verify','?sslmode=disable','?sslmode=require&sslmode=verify-full',
    '?sslrootcert=synthetic-private-value','?options=synthetic-private-value','?sslmode=require&token=synthetic-private-value'])
    assert.throws(()=>connectionConfig(url({search}),target));
});

test('only explicit loopback direct test connections are supported; remote Direct and Pooler rules cannot mix',async()=>{
  const local=structuredClone(target);local.environment='local-test';local.tls=false;
  Object.assign(local.connection,{form:'direct',host:'127.0.0.1',port:54322,login_username:'postgres',project_ref:null});
  assert.equal(connectionConfig('postgresql://postgres:synthetic-password@127.0.0.1:54322/postgres',local).ssl,false);
  await verifyTarget(mock(local.session),local);
  assert.throws(()=>connectionConfig(url(),local));
  assert.throws(()=>connectionConfig('postgresql://postgres:synthetic-password@127.0.0.1:54322/postgres',target));
  const remote=structuredClone(local);remote.connection.host=`db.${project}.supabase.co`;remote.connection.port=5432;
  assert.throws(()=>validateTarget(remote));
  const mislabeled=structuredClone(target);mislabeled.environment='local-test';assert.throws(()=>validateTarget(mislabeled));
});

test('apply requires a prior read-only artifact and binds every connection/session identity field',()=>{
  const input={records:[],manifestSha256:'synthetic-manifest'};
  const approved={schema:'lumiscore-catalog-run-2',mode:'dry-run',result:{applied:false},target_sha256:digest(target),
    manifest_sha256:input.manifestSha256,plan:{schema:'lumiscore-selection-plan-1',source_hash:digest(input.records),actions:[],counts:{}}};
  reviewedDryRun(approved,target,input);
  for(const patch of [{mode:'apply'},{mode:undefined},{result:{applied:true}},{result:{}},
    {target_sha256:'wrong'},{manifest_sha256:'wrong'},{schema:'legacy'},{plan:{...approved.plan,source_hash:'wrong'}}])
    assert.throws(()=>reviewedDryRun({...approved,...patch},target,input));
  for(const section of ['connection','session'])for(const field of Object.keys(target[section])){
    const changedTarget=structuredClone(target);changedTarget[section][field]='changed';
    assert.throws(()=>reviewedDryRun(approved,changedTarget,input),/target\/input/);
  }
});

test('first apply without reviewed dry-run is blocked before opening any connection',async()=>{
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'lumiscore-target-test-'));
  try{
    const file=path.join(directory,'target.json');await fs.writeFile(file,JSON.stringify(target));
    await assert.rejects(()=>main(['--target='+file,'--apply'],{CATALOG_DATABASE_URL:url()}),/reviewed dry-run/);
  }finally{await fs.rm(directory,{recursive:true,force:true});}
});

test('validation errors and CLI diagnostics never include supplied credentials, URL, token or parameter values',async()=>{
  const secret='synthetic-private-marker',badUrl=url({username:secret,password:secret,search:'?token='+secret});
  for(const run of [()=>connectionConfig(badUrl,target),()=>validateTarget({...target,unknown:secret})]){
    let error;try{run();}catch(e){error=e;}assert.ok(error);
    assert.ok(!String(error).includes(secret));assert.ok(!String(error).includes(badUrl));
  }
  const directory=await fs.mkdtemp(path.join(os.tmpdir(),'lumiscore-target-cli-test-'));
  try{
    const file=path.join(directory,'target.json');await fs.writeFile(file,JSON.stringify(target));
    const env={...process.env,CATALOG_DATABASE_URL:badUrl};
    for(const key of ['NODE_OPTIONS','NODE_DEBUG','NODE_DEBUG_NATIVE','NODE_V8_COVERAGE','NODE_REDIRECT_WARNINGS'])delete env[key];
    const output=spawnSync(process.execPath,[fileURLToPath(new URL('./catalog-selection-postgres.mjs',import.meta.url)),'--inspect','--target='+file],
      {env,encoding:'utf8',timeout:10000});
    assert.equal(output.status,1);
    for(const text of [output.stdout,output.stderr]){
      assert.ok(!text.includes(secret));assert.ok(!text.includes(badUrl));assert.ok(!text.includes(target.connection.login_username));
    }
    const report=await probeTarget(mock(),target);
    assert.ok(!JSON.stringify(report).includes(target.connection.login_username));assert.ok(!JSON.stringify(report).includes(host));
  }finally{await fs.rm(directory,{recursive:true,force:true});}
});
