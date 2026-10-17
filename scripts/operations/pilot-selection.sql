-- Public bibliography only. Fixed deterministic pilot, no ratings/user data.
with base as (
  select w.id,w.title,w.open_library_id,w.first_publish_year,w.subjects,a.name as author,
    (select min(category_id) from public.work_catalog_categories wc where wc.work_id=w.id) as category,
    exists(select 1 from public.work_trait_evidence e where e.work_id=w.id
      and e.trait not in ('classic','contemporary')) as has_content_traits,
    (select e.isbn_13 from public.editions e where e.work_id=w.id and e.isbn_13 is not null order by e.id limit 1) as isbn13
  from public.works w join public.authors a on a.id=w.author_id
), ranked as (
  select *,row_number() over(partition by has_content_traits,coalesce(category,'unclassified')
    order by md5(id::text||':lumiscore-pilot-v1'),id) as group_rank from base
), selected as (
  (select * from ranked where not has_content_traits order by group_rank,category nulls last,id limit 80)
  union all
  (select * from ranked where has_content_traits and id<>276 order by group_rank,category nulls last,id limit 19)
  union all
  (select * from ranked where id=276)
)
select jsonb_agg(to_jsonb(s) order by has_content_traits,id) as pilot from selected s;
