-- Only after restoring the previous application caller. Default: refuse + rollback.
-- The installation is fresh-only: if a baseline function existed, DO NOT drop it.
-- Keep its saved pg_get_functiondef, owner and ACL; restore only after separate review.
begin;
set local lock_timeout='3s';
do $rollback$
declare baseline_confirmed_absent boolean := false; target oid;
begin
  if not baseline_confirmed_absent then
    raise exception 'Confirm retained pre-install snapshot has NO function before removal';
  end if;
  target:=to_regprocedure('public.catalog_browse_page_v2(text,text,text[],text,text[],text,integer,integer,bigint[],bigint)');
  if target is null then return; end if;
  if not exists(select 1 from pg_proc where oid=target
    and md5(prosrc)='a8d63c0f16b97bd40e02e1ad0a150a5f' and not prosecdef
    and pg_get_userbyid(proowner)='postgres'
    and provolatile='s' and proconfig=array['search_path=""']::text[])
    or not has_function_privilege('anon',target,'EXECUTE')
    or not has_function_privilege('authenticated',target,'EXECUTE')
    or exists(select 1 from pg_proc p
      cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
      where p.oid=target and a.grantee<>p.proowner
        and (a.grantee not in ('anon'::regrole,'authenticated'::regrole) or a.is_grantable)) then
    raise exception 'Function definition/rights changed after installation: preserve it and review';
  end if;
  -- No CASCADE: later dependants cause a stop, never their deletion.
  drop function public.catalog_browse_page_v2(text,text,text[],text,text[],text,integer,integer,bigint[],bigint);
end $rollback$;
rollback;
