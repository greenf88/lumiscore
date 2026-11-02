with chosen as (
 select * from public.works where id=any(array[5005,3285,1044,3299,3268,3325,1346,3433,2644,2391,2175,2665,3415,2972,3281,2651,2386,6346]::bigint[])
)
select jsonb_build_object(
 'checked_at',clock_timestamp(),
 'works',(select jsonb_agg(to_jsonb(w) order by id) from chosen w),
 'authors',(select jsonb_agg(to_jsonb(a) order by id) from public.authors a where id in(select author_id from chosen)),
 'editions',(select jsonb_agg(to_jsonb(e) order by id) from public.editions e where work_id in(select id from chosen)),
 'descriptions',(select coalesce(jsonb_agg(to_jsonb(d) order by work_id,language),'[]') from public.catalog_work_descriptions d where work_id in(select id from chosen)),
 'metadata',(select coalesce(jsonb_agg(to_jsonb(m) order by edition_id),'[]') from public.catalog_edition_metadata m where work_id in(select id from chosen))
) as preflight;
