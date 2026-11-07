import test from'node:test';import assert from'node:assert/strict';import{spawn}from'node:child_process';
test('two isolated workers each bound their own burst; no distributed quota claim',async()=>{
 const moduleUrl=new URL('../lib/books/description-provider-gate.ts',import.meta.url).href;
 const source=`import{DescriptionProviderGate}from${JSON.stringify(moduleUrl)};const g=new DescriptionProviderGate(['books']);let calls=0;const results=await Promise.all(Array.from({length:40},()=>g.run('books',async()=>{calls++;await new Promise(r=>setTimeout(r,20));g.pause('books',Date.now()+60000);return 'temporary';})));console.log(JSON.stringify({calls,skipped:results.filter(r=>r===null).length}));`;
 const env=Object.fromEntries(['PATH','SystemRoot','WINDIR','TEMP','TMP'].flatMap(k=>process.env[k]?[[k,process.env[k]]]:[]));
 const run=()=>new Promise((resolve,reject)=>{const c=spawn(process.execPath,['--experimental-strip-types','--input-type=module','-e',source],{env,windowsHide:true,stdio:['ignore','pipe','pipe']});let out='',err='';c.stdout.on('data',b=>out+=b);c.stderr.on('data',b=>err+=b);const t=setTimeout(()=>{c.kill();reject(Error('Bounded worker deadline'));},10000);c.on('error',reject);c.on('exit',code=>{clearTimeout(t);code?reject(Error(err)):resolve(JSON.parse(out));});});
 const results=await Promise.all([run(),run()]);assert.deepEqual(results,[{calls:2,skipped:38},{calls:2,skipped:38}]);
});
