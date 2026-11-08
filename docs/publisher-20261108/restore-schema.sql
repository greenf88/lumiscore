begin;set local lock_timeout='3s';do $restore$ begin
if exists(select 1 from catalog_public_revision_events) then raise exception 'Operational revision evidence nonempty; stop';end if;
if exists(select 1 from cron.job where command like '%publish_catalog_public_revisions%') then raise exception 'Stop publisher tasks first';end if;
if md5(pg_get_functiondef('public.enqueue_catalog_public_revision(bigint,text,text,text,timestamptz,text)'::regprocedure))<>'a5e9d19da5361bc54a91d18e9298ed3c' or md5(pg_get_functiondef('public.publish_catalog_public_revisions(integer)'::regprocedure))<>'ff4771a57a55912034912bbec337175e' then raise exception 'Publisher implementation changed';end if;
if (select md5(jsonb_build_object(
'columns',(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,pg_get_expr(d.adbin,d.adrelid)) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid='public.catalog_public_revision_events'::regclass and a.attnum>0 and not a.attisdropped),
'constraints',(select jsonb_agg(jsonb_build_array(conname,pg_get_constraintdef(oid)) order by conname) from pg_constraint where conrelid='public.catalog_public_revision_events'::regclass),
'indexes',(select jsonb_agg(pg_get_indexdef(indexrelid) order by indexrelid::regclass::text) from pg_index where indrelid='public.catalog_public_revision_events'::regclass),
'security',(select jsonb_build_array(relrowsecurity,relforcerowsecurity,relacl::text,pg_get_userbyid(relowner)) from pg_class where oid='public.catalog_public_revision_events'::regclass))::text)) is distinct from '369c7440e29624df96700050679b71bc' then raise exception 'Operational journal schema/rights changed';end if;
end $restore$;drop function public.enqueue_catalog_public_revision(bigint,text,text,text,timestamptz,text);drop function public.publish_catalog_public_revisions(integer);drop table public.catalog_public_revision_events;commit;
-- Existing PR92 public revision ledger, summaries, sources and user records remain. No CASCADE.
