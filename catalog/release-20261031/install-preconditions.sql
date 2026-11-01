-- READ ONLY. Run on the explicitly selected production project before approval.
-- Fresh31Oct state expects ABSENT new objects. If already installed, stop and
-- compare complete definitions/rights with approved files; do not reinstall blind.
begin transaction read only;
select now() as checked_at;
do $pre$ begin
 if to_regclass('public.catalog_work_descriptions') is not null
 or to_regclass('public.catalog_edition_metadata') is not null
 or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('catalog_browse_page_v3','catalog_search_selection_v2','catalog_guard_reviewed_identity'))
 then raise exception 'New catalogue objects already present: snapshot and review before installation';end if;
end;$pre$;
select p.oid::regprocedure signature,pg_get_functiondef(p.oid) definition,p.proacl,p.proconfig,p.prosecdef
from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public'
and p.proname in ('catalog_browse_page_v2','catalog_search_selection_v1');
rollback;
