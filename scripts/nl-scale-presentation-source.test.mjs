import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {safePublicSource,applyStoredPresentation} from '../lib/books/stored-presentation.ts';
const root=new URL('../catalog/nl-scale-20261102/',import.meta.url);
test('every proposed new-Work description source passes the actual public loader',()=>{
 for(const batch of fs.readdirSync(new URL('subbatches/',root))){
  const file=new URL('subbatches/'+batch+'/production-plan.json',root);if(!fs.existsSync(file))continue;
  const plan=JSON.parse(fs.readFileSync(file,'utf8'));
  for(const a of plan.actions.filter(a=>a.relation==='catalog_work_descriptions'))assert.ok(safePublicSource(a.after.source_url),batch+': '+a.after.source_url);
 }
});
test('Een kat op recept uses its reviewed stable bibliography, retaining the query-based primary source in evidence',()=>{
 const p=JSON.parse(fs.readFileSync(new URL('subbatches/036/production-plan.json',root),'utf8'));
 const d=p.actions.find(a=>a.relation==='catalog_work_descriptions'&&a.after.evidence[0].reference.endsWith('#100')).after;
 assert.equal(d.source_url,'https://data.bibliotheken.nl/id/nbt/p443106975');
 assert.ok(d.evidence[1].sources.includes('https://www.php.co.jp/books/detail.php?isbn=978-4-569-90288-3'));
 const book={workId:'123',authorId:'456',editionAvailable:true};
 const actual=applyStoredPresentation([book],'nl',[{...d,work_id:123,bound_author_id:456}],[])[0];
 assert.equal(actual.storedDescription?.text,d.text);
 assert.equal(actual.storedDescription?.sourceUrl,d.source_url);
});
