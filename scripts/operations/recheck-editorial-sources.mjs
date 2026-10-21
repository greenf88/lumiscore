// Public GET-only revalidation, no database connection.
import {readFile,writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const dir=new URL('../../catalog/editorial-parity-20261021/',import.meta.url);
const baseline=JSON.parse(await readFile(new URL('production-public-baseline.json',dir),'utf8')).rows;
const p=JSON.parse(await readFile(new URL('correction-proposal.json',dir),'utf8'));
const keys=[...new Set(baseline.flatMap(w=>w.editions.map(e=>'/books/'+e.open_library_edition_id)).filter(k=>!k.endsWith('null')).concat('/books/OL39470791M'))];
assert.ok(keys.length<=40);
const url=new URL('https://openlibrary.org/api/get_many');url.searchParams.set('keys',JSON.stringify(keys));
const response=await fetch(url,{signal:AbortSignal.timeout(20000)});assert.equal(response.status,200);
const body=await response.json();assert.equal(body.status,'ok');
const fields=['key','title','languages','works','isbn_13','isbn_10','covers','physical_format','publishers','publish_date'];
const sources=Object.fromEntries(Object.entries(body.result).map(([k,v])=>[k,Object.fromEntries(fields.filter(f=>v[f]!==undefined).map(f=>[f,v[f]]))]));
const changes=p.languageCorrections.map(c=>{
 const source=sources['/books/'+c.openLibraryEditionId],work=baseline.find(w=>w.id===c.workId);
 assert.equal(source.title,c.title);assert.deepEqual(source.languages,[{key:'/languages/eng'}]);assert.ok(source.isbn_13.includes(c.isbn13));assert.ok(source.works.some(w=>w.key==='/works/'+work.open_library_id));
 return {...c,currentValue:null,proposedValue:'eng',sourceLanguageVerified:true,sourceWorkId:work.open_library_id,checkedAt:new Date().toISOString()};
});
const oryx=sources['/books/OL39470791M'];assert.deepEqual(oryx.languages,[{key:'/languages/eng'}]);assert.ok(oryx.isbn_13.includes('9780385721677'));assert.ok(oryx.works.some(w=>w.key==='/works/OL675722W'));
await writeFile(new URL('campaign-source-recheck.json',dir),JSON.stringify({checkedAt:new Date().toISOString(),sources,changes,oryx:{...p.editionAdditions[0],currentValue:'No matching stored edition at last read-only production check',proposedValue:oryx,sourceLanguageVerified:true}},null,2));
console.log(JSON.stringify({exactSources:keys.length,verifiedLanguageCorrections:changes.length,oryxIdentityVerified:true}));
