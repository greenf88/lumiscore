begin;

-- Keep the reviewed PR86 predicate as the single policy for both entry points.
-- The authenticated function keeps its existing name, permission and session gate.
do $migration$
declare
  definition text;
begin
  select pg_get_functiondef(oid) into strict definition
  from pg_proc where oid = 'taste_private.content_eligible_v1(bigint,text)'::regprocedure
    and encode(sha256(convert_to(prosrc, 'UTF8')), 'hex') =
      '79d4029e99c2af8a84bc66075ce7e09171798fee1c338980298fae1a99dc0388';

  execute replace(
    replace(definition, 'taste_private.content_eligible_v1(', 'taste_private.catalogue_eligible_v1('),
    'if auth.uid() is null then return false;end if;',
    ''
  );
end;
$migration$;

revoke all on function taste_private.catalogue_eligible_v1(bigint,text)
  from public, anon, authenticated, service_role;

create or replace function taste_private.content_eligible_v1(p_work_id bigint, p_language text)
returns boolean language sql stable security definer set search_path = '' as $policy$
  select case when auth.uid() is null then false
    else taste_private.catalogue_eligible_v1(p_work_id, p_language) end;
$policy$;

create function public.guest_taste_inventory(p_language text)
returns table(work_id bigint, series_ids bigint[])
language sql stable security definer set search_path = '' as $inventory$
  with eligible as materialized (
    select w.id from public.works w
    where p_language in ('nl','en')
      and taste_private.catalogue_eligible_v1(w.id, p_language)
    order by w.id
    limit 120
  )
  select w.id, array(
    select c.id from public.collection_books b join public.collections c on c.id = b.collection_id
    where b.work_id = w.id and c.collection_type = 'series'
    order by c.id
  )
  from eligible w order by w.id;
$inventory$;

revoke all on function public.guest_taste_inventory(text) from public, authenticated, service_role;
grant execute on function public.guest_taste_inventory(text) to anon;

commit;
