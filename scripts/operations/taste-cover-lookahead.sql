-- Proposal for isolated test only; apply only after explicit database approval.
-- Advisory cover hint, not another selection authority: save/skip still chooses atomically.
-- Mirrors the existing advance_round_v2 next-Work ORDER BY; changes to that contract
-- must update this optional hint and its parity tests. No existing function replaced.
begin;
create function taste_private.cover_lookahead(p_round_id uuid, p_work_id bigint)
returns jsonb language sql stable security definer set search_path = '' as $$
  with owned as (
    select r.* from public.taste_rating_rounds r
    where auth.uid() is not null and r.user_id = auth.uid() and r.id = p_round_id and r.completed_at is null
      and not exists (select 1 from public.taste_rating_rounds newer where newer.user_id = r.user_id and newer.round_number > r.round_number)
      and exists (select 1 from public.taste_rating_offers o where o.round_id = r.id and o.user_id = r.user_id and o.work_id = p_work_id and o.decision = 'offered')
  ), candidate as (
    select w.id, r.id as round_id, r.language from owned r cross join public.works w
    where not exists (select 1 from public.ratings x where x.user_id = r.user_id and x.work_id = w.id)
      and not exists (select 1 from public.taste_rating_offers x where x.user_id = r.user_id and x.work_id = w.id)
      and exists (select 1 from public.editions e where e.work_id = w.id and
        ((r.language = 'nl' and lower(e.language) in ('nl','nld','dut')) or (r.language = 'en' and lower(e.language) in ('en','eng'))))
    order by
      (select count(*) from public.taste_rating_offers x join public.works prev on prev.id=x.work_id where x.round_id=r.id and prev.author_id=w.author_id),
      (select count(*) from public.taste_rating_offers x join public.work_catalog_categories prev on prev.work_id=x.work_id
        where x.round_id=r.id and exists(select 1 from public.work_catalog_categories c where c.work_id=w.id and c.category_id=prev.category_id)),
      (select count(*) from public.ratings popularity where popularity.work_id=w.id) desc,
      (w.cover_id is not null) desc, w.id
    limit 1
  )
  select (select jsonb_build_object('roundId',round_id,'fromWorkId',p_work_id::text,'locale',language,'workId',id::text) from candidate);
$$;
revoke all on function taste_private.cover_lookahead(uuid,bigint) from public, anon, authenticated, service_role;
grant execute on function taste_private.cover_lookahead(uuid,bigint) to authenticated;
create function public.taste_rating_cover_lookahead(p_round_id uuid, p_work_id bigint)
returns jsonb language sql stable security invoker set search_path = '' as $$
  select taste_private.cover_lookahead(p_round_id,p_work_id);
$$;
revoke all on function public.taste_rating_cover_lookahead(uuid,bigint) from public, anon, authenticated, service_role;
grant execute on function public.taste_rating_cover_lookahead(uuid,bigint) to authenticated;
commit;
-- Recovery (only these new functions, after disabling hints in app):
-- drop function public.taste_rating_cover_lookahead(uuid,bigint);
-- drop function taste_private.cover_lookahead(uuid,bigint);
