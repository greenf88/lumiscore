-- Synthetic bibliography/evidence ONLY. No Auth rows or real identities/ratings are copied.
begin;
do $$ begin
  if not exists(select 1 from discovery_test_private.marker where identity='lumiscore-pr8-synthetic-v1')
    or exists(select 1 from public.works where native_identity_key is null or native_identity_key not like 'pr8-migration-placeholder-%') then
    raise exception 'Fresh synthetic target required';
  end if;
end $$;
insert into public.authors(id,name)
select 8800000+i,'Synthetic Author '||lpad(i::text,2,'0') from generate_series(1,12) i;
insert into public.works(id,title,author_id,first_publish_year,source_type,work_type,native_identity_key)
select 8800000+i,'Synthetic Book '||lpad(i::text,3,'0'),
  8800000+case when i<=100 then 1 else 2+(i%11) end,
  1930+(i%90),'lumiscore_native','novel','pr8-synthetic-'||i
from generate_series(1,305) i;
insert into public.editions(work_id,title,language,publisher)
select id,title,'en','Synthetic Publisher' from public.works where id between 8800001 and 8800300;
insert into public.editions(work_id,title,language,publisher)
select id,'Synthetisch Boek '||lpad((id-8800000)::text,3,'0'),'nl','Synthetische Uitgever'
from public.works where id between 8800001 and 8800300;
insert into public.editions(work_id,title,language)
select id,title||' duplicate edition','en' from public.works where id between 8800001 and 8800003;
insert into public.editions(work_id,title,language)
select id,title,'fr' from public.works where id>8800300;
-- Exercise author/category/query/language intersection across four pages (100 Works).
insert into public.work_catalog_categories
select id,'fiction_fantasy' from public.works where id between 8800001 and 8800100;
insert into public.work_catalog_categories
select w.id,c.id from public.works w join (
  select id,row_number() over(order by id) as n from public.catalog_categories
  where id<>'nonfiction_cooking_food'
) c on c.n=1+((w.id-8800101)%19) where w.id>8800100;
-- A second category relation and duplicate Editions must not duplicate Work cards.
insert into public.work_catalog_categories values (8800001,'fiction_science_fiction');
insert into public.catalog_work_title_aliases values(8800001,'Synthetic alternate title');
insert into public.work_trait_evidence(work_id,trait,weight,confidence,source,source_key,raw_labels,mapping_version,verified_at)
select id,t.trait,.9,.95,'reviewed_seed','pr8-synthetic-v1',array['SYNTHETIC TEST EVIDENCE'],
  'taste_traits_v1','2026-10-03T00:00:00Z'::timestamptz
from public.works cross join unnest(array['fantasy','worldbuilding','accessible','character_driven']) t(trait) where id>=8800001;
insert into public.collections(slug,name,collection_type,expected_main_series_total)
values('synthetic-series','Synthetic Series','series',3);
insert into public.collection_books(collection_id,work_id,sequence_number)
select c.id,8800000+i,i from public.collections c cross join generate_series(1,3) i where c.slug='synthetic-series';
commit;
