// Expectations derived from exact committed rows, not alternate edition fixtures.
import fs from 'node:fs';
import{ROOT,readJson}from'./nl-scale-snapshot.mjs';
const targets=[];
for(const batch of fs.readdirSync(new URL('subbatches/',ROOT)).filter(n=>/^\d{3}$/.test(n)&&fs.existsSync(new URL('subbatches/'+n+'/test-first-committed-receipt.json',ROOT))).sort()){
 const raw=readJson(new URL('subbatches/'+batch+'/test-first-committed-receipt.json',ROOT)),r=raw.receipt??raw,plan=readJson(new URL('subbatches/'+batch+'/test-plan.json',ROOT));
 const fixturePath=new URL('subbatches/'+batch+'/test-fixture-first-committed-receipt.json',ROOT),fixture=fs.existsSync(fixturePath)?readJson(fixturePath):null,rows=[...(fixture?.receipt?.rows??fixture?.rows??[]),...r.rows];
 for(const m of r.rows.filter(x=>x.relation==='catalog_edition_metadata')){
  const e=rows.findLast(x=>x.relation==='editions'&&x.after_row.id===m.after_row.edition_id)?.after_row,d=r.rows.find(x=>x.relation==='catalog_work_descriptions'&&x.after_row.work_id===e?.work_id)?.after_row;
  const w=rows.findLast(x=>x.relation==='works'&&x.after_row.id===e?.work_id)?.after_row??plan.bindings.find(x=>x.work.id===e?.work_id)?.work;
  if(!e||!d)throw Error('Missing exact edition/summary receipt binding');
  if(!w)throw Error('Missing exact committed Work binding');
  targets.push({batch,testWorkId:e.work_id,expectedEditionId:e.id,isbn:e.isbn_13,title:e.title,originalTitle:w.title,authorId:d.bound_author_id,summary:d.text,sourceUrl:d.source_url,coverUrl:m.after_row.cover_url,publicRatingExpected:'Own new/mirror test Works have no ratings; empty-score parity only, not proof of populated production scores.'});
 }
}
const body={deployment:'dpl_9ruvyD65bjhJtzNvP4UuWbrxyXvg',host:'https://lumiscore-9ue18tr1w-rgkgroeneveld-9102.vercel.app',testedCommit:'96c3efc5ebea86e286c72786db87aecc9138f5f3',applicationBase:'9c74ecaa48f7a35830f713eed3528d46ba0466ad',targets};
fs.writeFileSync(new URL('hosted-acceptance-targets.json',ROOT),JSON.stringify(body,null,2)+'\n');console.log({exactTargets:targets.length});
