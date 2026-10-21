// Offline preparation only. Test seed and production proposal remain separate.
import {readFile,writeFile} from 'node:fs/promises';
const dir=new URL('../../catalog/editorial-parity-20261021/',import.meta.url);
const baseline=JSON.parse(await readFile(new URL('production-public-baseline.json',dir),'utf8')).rows;
const proposal=JSON.parse(await readFile(new URL('correction-proposal.json',dir),'utf8'));
const ids=[102,2718,208,2600,100,2717,179,2724,2846,199,4316];
const plan=baseline.filter(w=>ids.includes(w.id)).flatMap(w=>{
 const editions=w.id===2600?[{id:2600,title:'Oryx and Crake',isbn_10:'0385721676',isbn_13:'9780385721677',language:'eng',publisher:'Anchor Books',open_library_edition_id:'OL39470791M'}]:w.editions;
 return editions.map(e=>({productionWorkId:w.id,testWorkId:921100000+w.id,testEditionId:921200000+e.id,authorId:921300000+w.author_id,author:w.author,title:w.title,year:w.first_publish_year,olid:w.open_library_id,editionTitle:e.title,editionOlid:e.open_library_edition_id,isbn10:e.isbn_10,isbn13:e.isbn_13,publisher:e.publisher,language:e.language,correctLanguage:[100,179,199].includes(w.id)}));
});
if(plan.length!==13||new Set(plan.map(p=>p.testWorkId)).size!==11)throw Error('Unexpected fixture scope');
const template=await readFile(new URL('fantasy-test-dry-run.sql',dir),'utf8');
let sql=template.replace(/-- ONLY[\s\S]*?begin;/,'-- ONLY hlvujbrmfdlrfxdjwsmb. Eleven approved bibliographic identities; no user/rating data.\nbegin;')
 .replace(/\$plan\$[\s\S]*?\$plan\$/,'$plan$'+JSON.stringify(plan)+'$plan$')
 .replace('publisher text,language text,source text','publisher text,language text,"correctLanguage" boolean')
 .replace(/<>20 then/, '<>13 then')
 .replace(/ if not exists\(select 1 from public.authors where id=8800016[^\n]+\n/,'')
 .replaceAll('where "authorId"<>8800016','')
 .replace("(e.language is not null and e.language<>'eng')","(e.language is distinct from p.language and not(p.\"correctLanguage\" and e.language='eng'))")
 .replace('p."editionTitle",null,p."editionOlid"','p."editionTitle",p.language,p."editionOlid"')
 .replace('and e.language is null returning e.id','and p."correctLanguage" and e.language is null returning e.id')
 .replace("where e.language is distinct from 'eng' or", "where e.language is distinct from (case when p.\"correctLanguage\" then 'eng' else p.language end) or");
// Works occur more than once when both language editions exist. Insert once.
sql=sql.replace('select p."testWorkId",p.title,p."authorId",p.year,p.olid,\'open_library\'', 'select distinct p."testWorkId",p.title,p."authorId",p.year,p.olid,\'open_library\'');
await writeFile(new URL('campaign-test-dry-run.sql',dir),sql);
await writeFile(new URL('campaign-test-plan.json',dir),JSON.stringify({target:'hlvujbrmfdlrfxdjwsmb',plan},null,2));
const necessary=proposal.languageCorrections.filter(p=>[100,179,199].includes(p.workId));
await writeFile(new URL('campaign-production-proposal.json',dir),JSON.stringify({status:'PROPOSAL_ONLY_NOT_APPLIED',productionProject:'qvplwejffhjvxaypmjut',necessaryLanguageCorrections:necessary,necessaryEditionAdditions:proposal.editionAdditions,notRequiredForCampaign:proposal.languageCorrections.filter(p=>![100,179,199].includes(p.workId)),explanation:'24 = three necessary dystopia corrections +20 fantasy/SF corrections +one redundant Hunger Games edition. Only3 languages +1 Oryx edition belong in the minimal campaign import. Giver cover remains unresolved.'},null,2));
const full=await readFile(new URL('proposed-dry-run.sql',dir),'utf8');
const values=necessary.map(p=>`(${p.editionId},${p.workId},'${p.title.replaceAll("'","''")}','${p.isbn13}','${p.openLibraryEditionId}','eng')`).join(',\n')+';';
const prod=full.replace(/insert into editorial_language_plan values[\s\S]*?;\r?\n/, 'insert into editorial_language_plan values\n'+values+'\n')
 .replace("title<>'Oryx and Crake'", "title is distinct from 'Oryx and Crake' or isbn_13 is distinct from '9780385721677' or open_library_edition_id is distinct from 'OL39470791M'");
await writeFile(new URL('campaign-production-dry-run.sql',dir),prod);
// Giver's existing correction alone cannot produce its missing cover. The user
// separately approved a second exact edition ON TEST ONLY. Keep production pending.
const giver={workId:100,editionId:null,currentValue:'No matching edition',title:'The Giver',language:'eng',isbn13:'9780385732550',isbn10:'0385732554',openLibraryEditionId:'OL7441983M',publisher:'Delacorte Books for Young Readers',coverId:244186,source:'https://openlibrary.org/books/OL7441983M',checkedAt:'2026-10-21',productionStatus:'PENDING_SEPARATE_PRODUCTION_APPROVAL'};
const minimal=necessary.filter(p=>p.workId!==100);
const minimalValues=minimal.map(p=>`(${p.editionId},${p.workId},'${p.title}','${p.isbn13}','${p.openLibraryEditionId}','eng')`).join(',\n')+';';
let recommended=prod.replace(/insert into editorial_language_plan values[\s\S]*?;\r?\n/,'insert into editorial_language_plan values\n'+minimalValues+'\n');
recommended=recommended.replace('end $$;',` if not exists(select 1 from public.works where id=100 and title='The Giver' and open_library_id='OL1846076W') then raise exception 'Giver Work mismatch'; end if;
 if exists(select 1 from public.editions where (isbn_13='9780385732550' or open_library_edition_id='OL7441983M') and (work_id<>100 or title is distinct from 'The Giver' or language is distinct from 'eng')) then raise exception 'Giver edition collision'; end if;
end $$;`);
recommended=recommended.replace('rollback;',`insert into public.editions(work_id,title,isbn_10,isbn_13,language,publisher,open_library_edition_id) select 100,'The Giver','0385732554','9780385732550','eng','Delacorte Books for Young Readers','OL7441983M' where not exists(select 1 from public.editions where isbn_13='9780385732550' or open_library_edition_id='OL7441983M') returning id,work_id;
rollback;`);
await writeFile(new URL('campaign-production-recommended-dry-run.sql',dir),'-- PENDING PRODUCTION APPROVAL: two language corrections +two exact edition additions.\n'+recommended);
await writeFile(new URL('campaign-production-recommended.json',dir),JSON.stringify({status:'PROPOSAL_ONLY_NOT_APPLIED',productionProject:'qvplwejffhjvxaypmjut',languageCorrections:minimal,editionAdditions:[...proposal.editionAdditions,giver],supersedes:'The original3-language+Oryx proposal still leaves Giver without a cover. When this Giver edition is approved for production, changing existing Giver language is unnecessary. The other22 of the original24 language corrections remain separate.',rollback:'Use only RETURNING receipts: revert exactly2 eng values to NULL after identity/current-value checks; remove only receipt-created editions after checking dependencies. Never change Works, ratings, statuses, collection membership or rounds.'},null,2));
console.log(JSON.stringify({testWorks:11,testEditions:13,newAuthors:new Set(plan.map(p=>p.authorId)).size,testLanguageCorrections:3,productionProposal:{languages:3,editions:1},additionalLanguages:21}));
