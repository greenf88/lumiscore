-- Exact committed Even simpel test recovery only: hlvujbrmfdlrfxdjwsmb.
begin;set local lock_timeout='3s';set local statement_timeout='30s';
lock table public.works,public.editions,public.catalog_work_descriptions,public.catalog_edition_metadata,public.catalog_work_title_aliases,public.work_catalog_categories in share row exclusive mode;
do $restore$ declare rows jsonb:='[{"seq":1,"relation":"works","key":{"id":990710001},"after_sha256":"aebe055c7fd427678977f4f714bf47e75d972b8daa65fe1afd4d0ae5024515f0"},{"seq":2,"relation":"editions","key":{"id":990720001},"after_sha256":"7834ab067955cc5bbdf19aefedf90390407d13d1bf7514f7427517e8f58d5b1d"},{"seq":3,"relation":"catalog_edition_metadata","key":{"edition_id":990720001},"after_sha256":"975960864ea37ab268c7ed460c93478bd705db208184ae9a7e3008c7d3014052"},{"seq":4,"relation":"catalog_work_descriptions","key":{"work_id":990710001,"language":"nl"},"after_sha256":"4042b47117537297030ae9313446a704f7f8e5d9381f7d8b9764ace90dbebe4f"},{"seq":5,"relation":"catalog_work_title_aliases","key":{"title":"Even simpel","work_id":990710001},"after_sha256":"1838e45aca9c0ea7147031285091283909ac44d4bfb9f689c2cfccdd4852c2b7"},{"seq":6,"relation":"catalog_work_title_aliases","key":{"title":"Ottolenghi even simpel","work_id":990710001},"after_sha256":"8372935805128c2cd19dc66569e4a9777151da3daa2b6bd3cab1f534a5b6266e"},{"seq":7,"relation":"catalog_work_title_aliases","key":{"title":"Simple Too","work_id":990710001},"after_sha256":"49d0f32c7f37deda3af47fb80f779b8a47e2664ca68091d77aeefa304133293e"},{"seq":8,"relation":"catalog_work_title_aliases","key":{"title":"Ottolenghi Simple Too","work_id":990710001},"after_sha256":"ba75ec6d7912f6c6449285e5f3b9faed1d58c8b14191f42e407bc3718b2d1bba"},{"seq":9,"relation":"work_catalog_categories","key":{"work_id":990710001,"category_id":"nonfiction_cooking_food"},"after_sha256":"44bd45bf57a7235ec89aa45568f16acf45e6c673eedf2cff3d072419857a33be"}]'::jsonb;r jsonb;actual jsonb;dep record;n bigint;begin
if jsonb_array_length(rows)<>9 then raise exception 'Exact nine owned rows required';end if;
for r in select value from jsonb_array_elements(rows) order by (value->>'seq')::int desc loop
if r->>'relation' not in ('works','editions','catalog_work_descriptions','catalog_edition_metadata','catalog_work_title_aliases','work_catalog_categories') then raise exception 'Outside scope';end if;
execute format('select to_jsonb(t) from public.%I t where to_jsonb(t) @> $1 for update',r->>'relation') into actual using r->'key';
if actual is null then continue;end if;
if encode(sha256(convert_to(actual::text,'UTF8')),'hex') is distinct from r->>'after_sha256' then raise exception 'Later modification; stop';end if;
for dep in select ns.nspname,c.relname,string_agg(format('(to_jsonb(child)->%L)=($1->%L)',ca.attname,pa.attname),' and ' order by k.ord) predicate
from pg_constraint f join pg_class c on c.oid=f.conrelid join pg_namespace ns on ns.oid=c.relnamespace
cross join lateral unnest(f.conkey,f.confkey) with ordinality k(childkey,parentkey,ord)
join pg_attribute ca on ca.attrelid=f.conrelid and ca.attnum=k.childkey join pg_attribute pa on pa.attrelid=f.confrelid and pa.attnum=k.parentkey
where f.contype='f' and f.confrelid=to_regclass('public.'||(r->>'relation')) group by f.oid,ns.nspname,c.relname
loop execute format('select count(*) from %I.%I child where %s',dep.nspname,dep.relname,dep.predicate) into n using actual;if n>0 then raise exception 'Dependency %.%; stop',dep.nspname,dep.relname;end if;end loop;
execute format('delete from public.%I t where to_jsonb(t) @> $1',r->>'relation') using r->'key';
end loop;end;$restore$;commit;
select 'Committed own-nine-row recovery completed' result;
