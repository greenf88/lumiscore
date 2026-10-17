-- Read-only capture reference. Run pages with a strictly increasing Work-ID
-- cursor; persist each complete payload externally and reconcile counts/digest.
-- No user IDs, individual ratings, emails or session data are exported.
begin read only;
select jsonb_build_object('captured_at',now(),'project','qvplwejffhjvxaypmjut','works_count',(select count(*) from public.works),'max_work_id',(select max(id) from public.works),'rows',coalesce(jsonb_agg(row order by id),'[]'::jsonb)) as payload from (
select w.id,jsonb_build_object(
'work',to_jsonb(w),'author',jsonb_build_object('id',a.id,'name',a.name,'open_library_id',a.open_library_id),
'editions',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.editions e where e.work_id=w.id),'[]'::jsonb),
'categories',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'nl',c.label_nl,'en',c.label_en) order by c.id) from public.work_catalog_categories wc join public.catalog_categories c on c.id=wc.category_id where wc.work_id=w.id),'[]'::jsonb),
'evidence',coalesce((select jsonb_agg(to_jsonb(t) order by t.trait,t.source,t.source_key) from public.work_trait_evidence t where t.work_id=w.id),'[]'::jsonb),
'collections',coalesce((select jsonb_agg(jsonb_build_object('collection',to_jsonb(c),'membership',to_jsonb(cb)) order by c.id) from public.collection_books cb join public.collections c on c.id=cb.collection_id where cb.work_id=w.id),'[]'::jsonb),
'stored_covers',coalesce((select jsonb_agg(to_jsonb(c) order by c.source,c.source_key) from public.work_cover_resolutions c where c.work_id=w.id),'[]'::jsonb),
'has_ratings',exists(select 1 from public.ratings r where r.work_id=w.id)
) as row from public.works w left join public.authors a on a.id=w.author_id where w.id>0 /* replace with previous page max Work ID */ order by w.id limit 500
) page; commit;
