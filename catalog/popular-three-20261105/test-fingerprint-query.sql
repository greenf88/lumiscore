select 'authors' relation,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) fingerprint from public.authors t
union all
select 'works' relation,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) fingerprint from public.works t
union all
select 'editions' relation,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) fingerprint from public.editions t
union all
select 'catalog_work_descriptions' relation,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) fingerprint from public.catalog_work_descriptions t
union all
select 'catalog_edition_metadata' relation,count(*) n,md5(coalesce(string_agg(to_jsonb(t)::text,E'\n' order by to_jsonb(t)::text),'')) fingerprint from public.catalog_edition_metadata t;
