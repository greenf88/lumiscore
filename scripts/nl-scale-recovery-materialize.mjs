// Bind the immutable FIRST nonempty committed receipt; no database execution.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ROOT,readJson} from './nl-scale-snapshot.mjs';
const [batch,...names]=process.argv.slice(2);
if(!/^\d{3}$/.test(batch??'')||!names.length||names.some(n=>!/^test(?:-fixture)?$/.test(n)))throw Error('Usage: batch test [test-fixture]');
const dir=new URL('subbatches/'+batch+'/',ROOT);
for(const name of names){
 const receipt=readJson(new URL(name+'-first-committed-receipt.json',dir));
 const plan=readJson(new URL(name+'-plan.json',dir));
 if(receipt.project!=='hlvujbrmfdlrfxdjwsmb'||receipt.batch!==plan.summary.batch||receipt.rows.length!==plan.actions.length)throw Error('Exact nonempty first test commit required');
 const original=fs.readFileSync(new URL(name+'-rollback.sql',dir),'utf8');
 const sql="select set_config('lumiscore.catalog_release_receipt','"+JSON.stringify(receipt).replaceAll("'","''")+"',false);\n"+original;
 const path=new URL(name+'-recovery-executable.sql',dir);
 if(fs.existsSync(path)&&fs.readFileSync(path,'utf8')!==sql)throw Error('Refuse to replace existing receipt-bound executable');
 fs.writeFileSync(path,sql);
 const proof={project:receipt.project,batch:receipt.batch,rows:receipt.rows.length,sha256:createHash('sha256').update(sql).digest('hex'),rollbackSha256:createHash('sha256').update(original).digest('hex'),receiptSha256:createHash('sha256').update(JSON.stringify(receipt)).digest('hex')};
 fs.writeFileSync(new URL(name+'-recovery-executable-hash.json',dir),JSON.stringify(proof,null,2)+'\n');console.log(JSON.stringify(proof));
}
