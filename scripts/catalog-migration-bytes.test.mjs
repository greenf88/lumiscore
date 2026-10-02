import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const migration='supabase/migrations/20260930185834_catalog_selection_v1.sql';
const reviewed='1e8817f8bf74a77505356dd28ff92f6259ea17f6';
const expected='efb525fc352ff2e5d1fd4224b95e9268dd19a952028fc4f36ba1680982836b71';
const sha=b=>createHash('sha256').update(b).digest('hex');
const git=(cwd,...args)=>{
  const r=spawnSync('git',['--no-optional-locks','-c','safe.directory='+cwd,'-C',cwd,...args],{windowsHide:true});
  assert.equal(r.status,0,'Git byte-test operation failed');
  return r.stdout;
};
const assertBytes=b=>{
  assert.equal(b.includes(13),false,'CR bytes are forbidden');
  assert.equal(b.subarray(0,3).equals(Buffer.from([239,187,191])),false,'BOM is forbidden');
  assert.doesNotThrow(()=>new TextDecoder('utf-8',{fatal:true}).decode(b));
  assert.equal(sha(b),expected,'Migration must retain the exact reviewed bytes');
};

test('working migration is strict UTF-8 without CR/BOM and has the reviewed byte hash',async()=>{
  assertBytes(await fs.readFile(path.join(root,migration)));
});
test('raw approved Git blob is read as binary and remains byte-identical',async()=>{
  const blob=git(root,'show',reviewed+':'+migration);
  assertBytes(blob);assert.deepEqual(blob,await fs.readFile(path.join(root,migration)));
});
test('Git attributes explicitly pin migration text and LF checkout',()=>{
  const attrs=git(root,'check-attr','text','eol','--',migration).toString('utf8');
  assert.match(attrs,/: text: set\r?\n/);assert.match(attrs,/: eol: lf\r?\n/);
});
test('fresh Git checkouts with autocrlf true and false materialize identical migration bytes',async()=>{
  const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'lumiscore-byte-checkout-'));
  try{
    const source=path.join(temporary,'fixture');
    await fs.mkdir(path.join(source,'supabase','migrations'),{recursive:true});
    await fs.writeFile(path.join(source,'.gitattributes'),await fs.readFile(path.join(root,'.gitattributes')));
    await fs.writeFile(path.join(source,migration),git(root,'show',reviewed+':'+migration));
    git(source,'init','--quiet');
    git(source,'-c','core.autocrlf=false','add','--','.gitattributes',migration);
    git(source,'-c','user.name=Byte Regression Fixture','-c','user.email=byte-fixture@example.invalid',
      'commit','--quiet','--no-gpg-sign','-m','Synthetic local byte fixture');
    for(const value of ['true','false']){
      const checkout=path.join(temporary,'checkout-'+value);
      git(temporary,'-c','core.autocrlf='+value,'clone','--quiet','--local','--no-hardlinks',source,checkout);
      assertBytes(await fs.readFile(path.join(checkout,migration)));
    }
  }finally{
    const resolved=path.resolve(temporary),parent=path.resolve(os.tmpdir());
    assert.equal(path.dirname(resolved),parent);assert.ok(path.basename(resolved).startsWith('lumiscore-byte-checkout-'));
    await fs.rm(resolved,{recursive:true,force:true});
  }
});
