// Narrow, write-once review artifact generator. No database or network access.
import fs from 'node:fs/promises';
import { buildPlan, digest } from './catalog-selection-core.mjs';
import { sha256, revision } from './catalog-selection-inputs.mjs';
const directory=new URL('../catalog/selection-v1/',import.meta.url);
const read=async file=>fs.readFile(new URL(file,directory));
const json=async file=>JSON.parse(await read(file));
const previous=await json('identity-20261001.manifest.json');
for(const [file,hash] of Object.entries(previous.files))if(sha256(await read(file))!==hash)throw new Error('Previous frozen version changed');
const pins=await json('identity-pins.json');
if(sha256(await read('identity-pins.json'))!==previous.pins_sha256)throw new Error('Previous pins changed');
const bytes=await read(previous.records_file),records=JSON.parse(bytes);
const candidate=records.find(r=>r.candidate_id==='LS1000-0728');
pins[candidate.candidate_id]={work_id:1078,title:'Rendez-vous',author:'Esther Verhoef',olid:'OL19335865W',
  candidate_hash:digest(candidate),edition_identity:{isbn_13:'9789041410252',open_library_edition_id:'OL26793552M'},
  reason:'Reviewed original Dutch edition: ISBN 9789041410252 → OL26793552M → OL19335865W → Work 1078; English large-print Work 1739 remains untouched (decision C).'};
const snapshot=await json('database-matches.json'),translation=await json('translation-match.json');
const original=snapshot.matches.find(w=>w.id===1078);
const fixture=[original,{id:1739,title:'Rendezvous',author:'Esther Verhoef',open_library_id:'OL20923709W',first_publish_year:2011,
  editions:[{id:1888,title:'Rendezvous',isbn_10:'1407470612',isbn_13:'9781407470610',language:'eng',open_library_edition_id:'OL28347895M'}]}];
const works=[...new Map([...snapshot.matches,translation,...fixture].map(w=>[w.id,w])).values()];
const plan=buildPlan(records,works,pins),unresolved=buildPlan(records,works,await json('identity-pins.json'));
if(JSON.stringify(plan.counts)!==JSON.stringify({link:875,insert:99,skip:26})||unresolved.actions[727].kind!=='skip')throw new Error('Unexpected scope/count drift');
if(plan.actions.some((a,i)=>i!==727&&JSON.stringify(a)!==JSON.stringify(unresolved.actions[i])))throw new Error('Unrelated identity changed');
const review={candidate_id:candidate.candidate_id,decision:'C',selection_canonical_work_id:1078,other_work_id:1739,
  checked_at:'2026-10-01',production_write:false,production_merge_or_delete:false,
  source_facts:[
    {url:'https://www.estherverhoef.nl/boek/Rendez-vous-T506.html',facts:{author:'Esther Verhoef',title:'Rendez-vous',original_year:2006,form:'psychological thriller / novel',listed_later_isbns:['9789049801021','9789041421654'],exact_2006_isbn_listed:false}},
    {url:'https://www.amboanthos.nl/boek/rendez-vous-hardback/',facts:{author:'Esther Verhoef',title:'Rendez-vous',language:'Dutch',isbn_13:'9789026335501',exact_selected_edition:false}},
    {url:'https://www.bibliotheek.nl/catalogus/titel.391981137.html/rendez-vous/',method:'direct HTTPS 200; bibliographic facts only',facts:{author:'Esther Verhoef',original_edition:{isbn_13:'9789041410252',isbn_10:'9041410252',publisher:'Anthos',year:2006,pages:334,language:'Dutch',form:'printed fiction'}}},
    {url:'https://openlibrary.org/isbn/9789041410252.json',resolved_url:'https://openlibrary.org/books/OL26793552M.json',facts:{isbn_13:'9789041410252',isbn_10:'9041410252',edition_id:'OL26793552M',work_id:'OL19335865W',author_id:'OL7482830A',publisher:'Anthos',publication:'Mar 19, 2006',pages:334,language:null}},
    {url:'https://openlibrary.org/authors/OL7482830A.json',facts:{name:'Esther verhoef',id:'OL7482830A'}},
    {url:'https://openlibrary.org/authors/OL3087562A.json',facts:{name:'Esther Verhoef',id:'OL3087562A'}},
    {url:'https://openlibrary.org/isbn/9781407470610.json',resolved_url:'https://openlibrary.org/books/OL28347895M.json',facts:{isbn_13:'9781407470610',isbn_10:'1407470612',edition_id:'OL28347895M',work_id:'OL20923709W',author_id:'OL3087562A',publisher:'W.F. Howes',year:2011,language:'eng',form:'large print edition',pages:442,oclc:'711007975',bibliographic_note:'Originally published in the United Kingdom in 2010 by Quercus.'}},
    {url:'https://www.quercusbooks.co.uk/titles/esther-verhoef/rendezvous/9780857383617/',facts:{title:'Rendezvous',author:'Esther Verhoef',isbn_13:'9780857383617',date:'2010-09-30',form:'ebook',genre:'Fiction In Translation',exact_large_print_edition:false}},
    {url:'https://www.estherverhoef.nl/post/Vertaling-Lieve-Mama-N349.html',facts:{author_confirmed_english_translation_of:'Rendez-vous',territories:['United Kingdom','United States'],date:'2019-07-09'}}
  ],limitations:['Exact historical publisher page for ISBN 9789041410252 unavailable; KB and ISBN→Edition→Work chain supply exact-edition evidence.',
    'Source hierarchy, edition reprint note and author translation confirmation jointly support same original work; no normalized-title-only inference.',
    'Selection canonical is not a claim that production has an existing global canonical flag. No production duplicates repaired.'],
  before_full_catalog_counts:unresolved.counts,after_counts:plan.counts,members:974,skips:26};
const files={};
const write=async(suffix,value)=>{const file=revision+'.'+suffix;const data=Buffer.isBuffer(value)?value:Buffer.from(JSON.stringify(value,null,2)+'\n');await fs.writeFile(new URL(file,directory),data,{flag:'wx'});files[file]=sha256(data);return file;};
// Records deliberately byte-identical: existing imported record hashes remain valid.
const records_file=await write('records.json',bytes),pins_file=await write('pins.json',pins);
const identity_fixture_file=await write('fixture.json',fixture);
await write('review.json',review);await write('plan.json',plan);
const manifest={version:revision,records_file,pins_file,identity_fixture_file,files,pins_sha256:files[pins_file],
  previous_version:previous.version,previous_manifest_sha256:sha256(await read('identity-20261001.manifest.json')),
  previous_records_sha256:sha256(bytes),records_semantic_sha256:digest(records),
  counts:plan.counts,members:974,category_links:1022,pilot_sources:previous.pilot_sources};
await fs.writeFile(new URL(revision+'.manifest.json',directory),JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({version:revision,counts:plan.counts,manifest_sha256:sha256(await read(revision+'.manifest.json'))}));
