// Frozen, additive catalogue review. Generates SQL only; never connects or applies.
import {readFile,writeFile} from 'node:fs/promises';
import {validIsbn} from './catalog-selection-core.mjs';
const dir=new URL('../catalog/mirror-heretics-20261021/',import.meta.url);
const plan=JSON.parse(await readFile(new URL('reviewed.json',dir),'utf8'));
for(const isbn of [plan.heretics.isbn13,...plan.mirror.editions.map(e=>e.isbn13)])if(!validIsbn(isbn))throw Error('Invalid ISBN');
const tables=['authors','works','editions','collections','collection_books','ratings','user_book_status','taste_rating_offers','taste_rating_rounds','taste_test_responses','work_catalog_categories','catalog_work_title_aliases','work_trait_evidence'];
function fingerprint(mode){
 return 'jsonb_build_object('+tables.map(t=>{
  const where=mode==='test'?({authors:' where id<>735',works:' where id<>10138',editions:' where id not in(91021201,91021202,91021203)',collection_books:' where not(collection_id=32 and work_id=10138)',work_catalog_categories:" where not(work_id=10138 and category_id='fiction_fantasy')"}[t]||''):'';
  return `'${t}',(select jsonb_build_object('count',count(*),'hash',md5(coalesce(string_agg(md5(to_jsonb(t)::text),'' order by md5(to_jsonb(t)::text)),''))) from public.${t} t${where})`;
 }).join(',')+')';
}
function editionSQL(e,{production=false,workId,id}){
 const title=e.title??plan.mirror.title,publisher=e.publisher,olid=e.editionOlid?`'${e.editionOlid}'`:'null';
 const columns=production?'work_id,title,isbn_13,language,publisher,open_library_edition_id':'id,work_id,title,isbn_13,language,publisher,open_library_edition_id,publish_date';
 const values=(production?'':id+',')+`${workId},'${title}','${e.isbn13}','eng','${publisher}',${olid}`+(production?'':`,'${e.publicationDate}'`);
 return `
 select count(*) into matches from public.editions where isbn_13='${e.isbn13}'${e.editionOlid?` or open_library_edition_id='${e.editionOlid}'`:''};
 if matches>1 then raise exception 'Duplicate edition requires review';end if;
 if matches=1 then
  if not exists(select 1 from public.editions where work_id=${workId} and isbn_13='${e.isbn13}' and title='${title}' and language='eng' and publisher='${publisher}' and open_library_edition_id is not distinct from ${olid}) then raise exception 'Conflicting edition identity; no overwrite';end if;
 else
  ${production?'':`if exists(select 1 from public.editions where id=${id}) then raise exception 'Test edition ID occupied';end if;`}
  insert into public.editions(${columns}) values(${values});
 end if;`;
}
function mirrorSQL(production=false){
 const collection=production?30:32;
 return `
 if not exists(select 1 from public.collections where id=${collection} and slug='once-upon-a-broken-heart' and collection_type='series' and expected_main_series_total=3) then raise exception 'Trilogy identity/denominator changed';end if;
 ${production?`if not exists(select 1 from public.authors where id=735 and name='Stephanie Garber' and open_library_id='OL7387659A') or not exists(select 1 from public.works where id=10138 and author_id=735 and title='The Mirror of Infinite Endings' and open_library_id='OL45033863W' and first_publish_year=2026) then raise exception 'Production Work/author identity changed';end if;`:`
 if exists(select 1 from public.authors where (id=735 or name ilike 'Stephanie Garber' or open_library_id='OL7387659A') and not(id=735 and name='Stephanie Garber' and open_library_id='OL7387659A')) then raise exception 'Author collision';end if;
 if not exists(select 1 from public.authors where id=735) then insert into public.authors(id,name,open_library_id) values(735,'Stephanie Garber','OL7387659A');end if;
 if exists(select 1 from public.works where (id=10138 or title ilike '%mirror%infinite%' or open_library_id='OL45033863W') and not(id=10138 and title='The Mirror of Infinite Endings' and author_id=735 and open_library_id='OL45033863W' and first_publish_year=2026)) then raise exception 'Work duplicate/collision';end if;
 if not exists(select 1 from public.works where id=10138) then insert into public.works(id,title,author_id,open_library_id,first_publish_year,source_type) values(10138,'The Mirror of Infinite Endings',735,'OL45033863W',2026,'open_library');end if;`}
 ${production ? "if not exists(select 1 from public.editions where id=10298 and work_id=10138 and isbn_13='9781250462039' and language='eng' and open_library_edition_id='OL61433279M') then raise exception 'Existing US edition changed; do not replace or duplicate';end if;" : ''}
 ${plan.mirror.editions.map(e=>editionSQL(e,{production,workId:10138,id:e.testEditionId})).join('\n')}
 if exists(select 1 from public.collection_books where collection_id=${collection} and work_id=10138 and row(sequence_number,publication_order,subgroup) is distinct from row(4,4,'companion'::text)) then raise exception 'Companion membership conflict';end if;
 if exists(select 1 from public.collection_books where collection_id=${collection} and sequence_number=4 and work_id<>10138) then raise exception 'Publisher position occupied';end if;
 insert into public.collection_books(collection_id,work_id,sequence_number,publication_order,subgroup) select ${collection},10138,4,4,'companion' where not exists(select 1 from public.collection_books where collection_id=${collection} and work_id=10138);
 insert into public.work_catalog_categories(work_id,category_id) select 10138,'fiction_fantasy' where not exists(select 1 from public.work_catalog_categories where work_id=10138 and category_id='fiction_fantasy');`;
}
function wrap(body,mode){
 const production=mode==='production';
 return `-- ${production?'PROPOSAL ONLY. DO NOT APPLY BEFORE CODE RELEASE AND SEPARATE PRODUCTION APPROVAL.':'APPROVED TEST ONLY hlvujbrmfdlrfxdjwsmb.'}
-- Additive/idempotent; no existing record update/delete or schema change. Full dates remain in reviewed.json for production (no date column).
begin isolation level repeatable read;set local lock_timeout='3s';set local statement_timeout='20s';
do $catalog$
declare matches integer;before_users jsonb;after_users jsonb;
begin
 select jsonb_build_object('ratings',(select md5(coalesce(string_agg(md5(to_jsonb(r)::text),'' order by md5(to_jsonb(r)::text)),'')) from public.ratings r),'statuses',(select md5(coalesce(string_agg(md5(to_jsonb(s)::text),'' order by md5(to_jsonb(s)::text)),'')) from public.user_book_status s)) into before_users;
 ${body}
 select jsonb_build_object('ratings',(select md5(coalesce(string_agg(md5(to_jsonb(r)::text),'' order by md5(to_jsonb(r)::text)),'')) from public.ratings r),'statuses',(select md5(coalesce(string_agg(md5(to_jsonb(s)::text),'' order by md5(to_jsonb(s)::text)),'')) from public.user_book_status s)) into after_users;
 if before_users is distinct from after_users then raise exception 'User state changed; rollback';end if;
end;$catalog$;
select jsonb_build_object('project','${production?'qvplwejffhjvxaypmjut':'hlvujbrmfdlrfxdjwsmb'}','preserved',${fingerprint(production?'production':'test')},'editions',(select jsonb_agg(to_jsonb(e) order by isbn_13) from public.editions e where isbn_13 in('9780593201763','9781250462039','9781399641777')),'membership',(select to_jsonb(c) from public.collection_books c where collection_id=${production?30:32} and work_id=10138)) as receipt;commit;`.replace(/[ \t]+$/gm, '');
}
const h=plan.heretics;
const heretics=`if not exists(select 1 from public.works where id=${h.testWorkId} and open_library_id='OL893502W') then raise exception 'Heretics Work mismatch';end if;`+editionSQL(h,{workId:h.testWorkId,id:h.testEditionId});
await writeFile(new URL('heretics.test.sql',dir),wrap(heretics,'test'));
await writeFile(new URL('mirror.test.sql',dir),wrap(mirrorSQL(false),'test'));
await writeFile(new URL('mirror.production.proposed.sql',dir),wrap(mirrorSQL(true),'production'));
await writeFile(new URL('heretics.production.proposed.sql',dir),wrap(`if not exists(select 1 from public.works where id=311 and open_library_id='OL893502W') then raise exception 'Heretics identity changed';end if;`+editionSQL(h,{production:true,workId:311}),'production'));
await writeFile(new URL('test-preservation.sql',dir),`begin read only;select ${fingerprint('test')} as preserved;commit;`);
console.log(JSON.stringify({generated:true,networkWrites:0,mode:'dry-run files only',mirrorWork:'reuse production10138',trilogyTotal:3,companionPosition:4,productionReleaseDependency:'companion-aware code first'}));
