// Offline artifacts only. No credentials, network, database connection or hosted writes.
import { mkdir, copyFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { reviewedFixtureInputs, fixturePrerequisites } from './discovery-test-fixture.mjs';
const root=new URL('../outputs/discovery-test-plan/',import.meta.url);
const inputs=await reviewedFixtureInputs(), prerequisite=fixturePrerequisites(inputs);
const artifacts={
  '00-bootstrap.sql':inputs.bootstrap,
  '02-placeholder-works.sql':prerequisite.placeholders,
  '04-collection-prerequisites.sql':prerequisite.collections,
  '06-categories-and-seed.sql':prerequisite.categories+'\n'+inputs.seed,
};
await mkdir(root,{recursive:true});
const hashes={};
for(const [name,sql] of Object.entries(artifacts)) {
  await writeFile(new URL(name,root),sql,'utf8');
  hashes[name]=createHash('sha256').update(sql).digest('hex');
}
for(const [phase,count] of [['01-native',1],['03-through-collections',8],['05-full',14]]) {
  const dir=new URL(phase+'/supabase/',root);await mkdir(new URL('migrations/',dir),{recursive:true});
  const expected=inputs.files.slice(0,count).map(file=>file.name);
  if((await readdir(new URL('migrations/',dir))).some(name=>!expected.includes(name))) throw new Error('Unexpected generated migration file; inspect isolated output before retrying.');
  await writeFile(new URL('config.toml',dir),'project_id = "lumiscore-pr8-test-plan"\n[db.seed]\nenabled = false\n','utf8');
  for(const file of inputs.files.slice(0,count)) await copyFile(new URL('../supabase/migrations/'+file.name,import.meta.url),new URL('migrations/'+file.name,dir));
}
await writeFile(new URL('artifact-hashes.json',root),JSON.stringify(hashes,null,2)+'\n','utf8');
console.log(JSON.stringify({offlinePlanPrepared:true,phases:3,migrationFiles:14,fixtureArtifacts:4,credentialsRead:false,remoteWrites:false}));
