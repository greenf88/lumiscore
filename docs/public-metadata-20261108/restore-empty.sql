-- Stop the optional publisher first. Only empty, dependency-free package objects.
-- Never CAS-delete rows that changed since an import receipt. Preserve/export first.
begin;
do $$begin
 if exists(select 1 from public.catalog_description_snapshots) or exists(select 1 from public.catalog_public_page_revisions) then
 raise exception 'Refuse uninstall of nonempty public metadata tables';end if;
end$$;
drop function public.withdraw_catalog_description_snapshot(bigint,bigint,text,text,timestamptz);
drop function public.record_catalog_public_revision(bigint,text,text,text,timestamptz,text);
drop table public.catalog_description_snapshots;
drop function public.guard_description_snapshot();
drop function if exists public.catalog_snapshot_language(text);
drop table public.catalog_public_page_revisions;
commit;
