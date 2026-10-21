// Offline, bounded preparation. Never connects to a database. Default ROLLBACK.
import {readFile,writeFile} from 'node:fs/promises';
const dir=new URL('../../catalog/editorial-parity-20261021/',import.meta.url);
const baseline=JSON.parse(await readFile(new URL('production-public-baseline.json',dir),'utf8')).rows;
const proposal=JSON.parse(await readFile(new URL('correction-proposal.json',dir),'utf8'));
const ids=[6,17,18,19,21,23,24,25,26,27,30,32,117,140,146,171,185,218,288,304];
const plan=proposal.languageCorrections.filter(p=>ids.includes(p.workId)).map(p=>{
 const w=baseline.find(w=>w.id===p.workId),e=w.editions.find(e=>e.id===p.editionId);
 if(!w||!e||e.language!==null||e.isbn_13!==p.isbn13)throw Error('Preimage mismatch');
 return {productionWorkId:w.id,testWorkId:921100000+w.id,testEditionId:921200000+e.id,
  authorId:w.author_id===19?8800016:921300000+w.author_id,author:w.author,
  title:w.title,year:w.first_publish_year,olid:w.open_library_id,editionTitle:e.title,
  editionOlid:e.open_library_edition_id,isbn10:e.isbn_10,isbn13:e.isbn_13,publisher:e.publisher,language:'eng',source:p.source};
});
if(plan.length!==20||plan.some(p=>[14,22].includes(p.productionWorkId)))throw Error('Wrong scope');
const json=JSON.stringify(plan);
const sql=`-- ONLY hlvujbrmfdlrfxdjwsmb. Authorised minimal test fixture, not production import.
-- 20 exact Works/editions; reuse Sanderson 8800016. No ratings/status/round writes.
begin;
create temporary table fantasy_plan as select * from jsonb_to_recordset($plan$${json}$plan$::jsonb) as p("productionWorkId" bigint,"testWorkId" bigint,"testEditionId" bigint,"authorId" bigint,author text,title text,year integer,olid text,"editionTitle" text,"editionOlid" text,isbn10 text,isbn13 text,publisher text,language text,source text);
create temporary table fantasy_before as select 'authors' as kind,count(*) as n,md5(coalesce(string_agg(to_jsonb(a)::text,'|' order by id),'')) as digest from public.authors a where id not in(select "authorId" from fantasy_plan where "authorId"<>8800016)
union all select 'works',count(*),md5(coalesce(string_agg(to_jsonb(w)::text,'|' order by id),'')) from public.works w where id not in(select "testWorkId" from fantasy_plan)
union all select 'editions',count(*),md5(coalesce(string_agg(to_jsonb(e)::text,'|' order by id),'')) from public.editions e where id not in(select "testEditionId" from fantasy_plan);
do $$ begin
 if (select count(*) from fantasy_plan)<>20 then raise exception 'Wrong scope'; end if;
 if not exists(select 1 from public.authors where id=8800016 and name='Brandon Sanderson' and open_library_id='OL1394865A') then raise exception 'Existing author mismatch'; end if;
 if exists(select 1 from fantasy_plan p join public.authors a on a.id=p."authorId" where a.name is distinct from p.author) then raise exception 'Author ID collision'; end if;
 if exists(select 1 from fantasy_plan p join public.authors a on lower(a.name)=lower(p.author) where a.id<>p."authorId") then raise exception 'Reuse author instead of duplicating'; end if;
 if exists(select 1 from fantasy_plan p join public.works w on w.id=p."testWorkId" or w.open_library_id=p.olid where w.id<>p."testWorkId" or w.title is distinct from p.title or w.open_library_id is distinct from p.olid or w.author_id is distinct from p."authorId") then raise exception 'Work identity collision'; end if;
 if exists(select 1 from fantasy_plan p join public.editions e on e.id=p."testEditionId" or e.isbn_13=p.isbn13 or e.open_library_edition_id=p."editionOlid" where e.id<>p."testEditionId" or e.work_id<>p."testWorkId" or e.title is distinct from p."editionTitle" or e.isbn_13 is distinct from p.isbn13 or e.open_library_edition_id is distinct from p."editionOlid" or (e.language is not null and e.language<>'eng')) then raise exception 'Edition identity collision'; end if;
end $$;
create temporary table fantasy_receipt(kind text,id bigint);
with added as (insert into public.authors(id,name) select distinct p."authorId",p.author from fantasy_plan p where not exists(select 1 from public.authors a where a.id=p."authorId") returning id) insert into fantasy_receipt select 'author_created',id from added;
with added as (insert into public.works(id,title,author_id,first_publish_year,open_library_id,source_type) select p."testWorkId",p.title,p."authorId",p.year,p.olid,'open_library' from fantasy_plan p where not exists(select 1 from public.works w where w.id=p."testWorkId") returning id) insert into fantasy_receipt select 'work_created',id from added;
with added as (insert into public.editions(id,work_id,title,language,open_library_edition_id,isbn_10,isbn_13,publisher) select p."testEditionId",p."testWorkId",p."editionTitle",null,p."editionOlid",p.isbn10,p.isbn13,p.publisher from fantasy_plan p where not exists(select 1 from public.editions e where e.id=p."testEditionId") returning id) insert into fantasy_receipt select 'edition_created',id from added;
with changed as (update public.editions e set language='eng' from fantasy_plan p where e.id=p."testEditionId" and e.language is null returning e.id) insert into fantasy_receipt select 'language_null_to_eng',id from changed;
do $$ begin
 if exists(select 1 from fantasy_plan p left join public.editions e on e.id=p."testEditionId" where e.language is distinct from 'eng' or e.work_id is distinct from p."testWorkId") then raise exception 'Postcondition failed'; end if;
 if exists(select * from fantasy_before except (select 'authors',count(*),md5(coalesce(string_agg(to_jsonb(a)::text,'|' order by id),'')) from public.authors a where id not in(select "authorId" from fantasy_plan where "authorId"<>8800016)
 union all select 'works',count(*),md5(coalesce(string_agg(to_jsonb(w)::text,'|' order by id),'')) from public.works w where id not in(select "testWorkId" from fantasy_plan)
 union all select 'editions',count(*),md5(coalesce(string_agg(to_jsonb(e)::text,'|' order by id),'')) from public.editions e where id not in(select "testEditionId" from fantasy_plan))) then raise exception 'Existing catalogue changed'; end if;
end $$;
select jsonb_build_object('target','hlvujbrmfdlrfxdjwsmb','counts',(select jsonb_object_agg(kind,n) from(select kind,count(*) n from fantasy_receipt group by kind)t),'existing_catalogue_unchanged',true,'editions',(select jsonb_agg(jsonb_build_object('productionWorkId',p."productionWorkId",'workId',e.work_id,'editionId',e.id,'title',e.title,'isbn13',e.isbn_13,'language',e.language,'olid',e.open_library_edition_id) order by p."productionWorkId") from fantasy_plan p join public.editions e on e.id=p."testEditionId"),'receipt',(select jsonb_agg(to_jsonb(r)) from fantasy_receipt r)) as verification;
rollback;
`;
await writeFile(new URL('fantasy-test-plan.json',dir),JSON.stringify({target:'hlvujbrmfdlrfxdjwsmb',status:'PREPARED_NOT_APPLIED',plan},null,2));
await writeFile(new URL('fantasy-test-dry-run.sql',dir),sql);
console.log(JSON.stringify({works:plan.length,editions:plan.length,newAuthors:new Set(plan.filter(p=>p.authorId!==8800016).map(p=>p.authorId)).size,excluded:[14,22],default:'ROLLBACK'}));
