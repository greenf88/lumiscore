-- LOCAL PROPOSAL ONLY. Not in migrations; no automatic deployment/application.
-- Run only in disposable fixtures until a separate database rollout is approved.
begin;
set local lock_timeout = '5s';
-- All original rows, decisions, scores, timestamps, rounds and FK/RLS survive.
alter table public.taste_rating_offers drop constraint taste_rating_offers_pkey;
alter table public.taste_rating_offers add primary key(user_id,round_id,work_id);
create index taste_rating_offers_owner_work_history on public.taste_rating_offers(user_id,work_id,decision);
alter table public.taste_rating_rounds add column revisit_prior_skips boolean not null default false;

-- Atomic selection must not trust an arbitrary client-supplied eligible-ID array.
-- This private, initially EMPTY inventory is populated only by an independently
-- approved review/import of the SAME TS tasteEligibility policy. No seeds here.
-- Proposals/SOURCE_SUPPORTED records are not approval and cannot populate it.
create table taste_private.eligible_inventory_v1 (
  work_id bigint not null references public.works(id),
  language text not null check(language in ('nl','en')),
  edition_id bigint not null references public.editions(id),
  policy_version text not null check(policy_version='taste_eligibility_v1'),
  source_snapshot jsonb not null check(jsonb_typeof(source_snapshot)='object'),
  review_id text not null check(length(trim(review_id))>0),
  approved_at timestamptz not null,
  primary key(language,work_id)
);
alter table taste_private.eligible_inventory_v1 enable row level security;
alter table taste_private.eligible_inventory_v1 force row level security;
revoke all on taste_private.eligible_inventory_v1 from public,anon,authenticated;

-- Fail closed when ANY relevant catalog/evidence/membership/edition row changes.
-- No taste calculation in SQL: this is exact freshness checking, not a new gate.
create function taste_private.inventory_snapshot_v1(p_work_id bigint) returns jsonb
language sql stable security invoker set search_path='' as $$
  select jsonb_build_object('work',to_jsonb(w),'author',to_jsonb(a),
    'editions',coalesce((select jsonb_agg(to_jsonb(e) order by e.id) from public.editions e where e.work_id=w.id),'[]'::jsonb),
    'categories',coalesce((select jsonb_agg(to_jsonb(c) order by c.category_id) from public.work_catalog_categories c where c.work_id=w.id),'[]'::jsonb),
    'memberships',coalesce((select jsonb_agg(jsonb_build_object('membership',to_jsonb(m),'collection',to_jsonb(c)) order by m.collection_id)
      from public.collection_books m join public.collections c on c.id=m.collection_id where m.work_id=w.id),'[]'::jsonb),
    'traits',coalesce((select jsonb_agg(to_jsonb(t) order by t.trait,t.source,t.source_key)
      from public.work_trait_evidence t where t.work_id=w.id),'[]'::jsonb))
  from public.works w left join public.authors a on a.id=w.author_id where w.id=p_work_id;
$$;
revoke all on function taste_private.inventory_snapshot_v1(bigint) from public,anon,authenticated;

create function taste_private.inventory_current_v1(p_work_id bigint,p_language text) returns boolean
language sql stable security invoker set search_path='' as $$
  select exists(select 1 from taste_private.eligible_inventory_v1 i
    join public.editions e on e.id=i.edition_id and e.work_id=i.work_id
    where i.work_id=p_work_id and i.language=p_language and i.policy_version='taste_eligibility_v1'
      and length(trim(coalesce(e.title,'')))>0
      and lower(regexp_replace(trim(e.language),'^.*/',''))=any(case p_language
        when 'nl' then array['nl','nld','dut','dutch'] when 'en' then array['en','eng','english'] else array[]::text[] end)
      and i.source_snapshot=taste_private.inventory_snapshot_v1(i.work_id));
$$;
revoke all on function taste_private.inventory_current_v1(bigint,text) from public,anon,authenticated;

-- Read-only capability handshake: the UI must not offer revisit on old storage.
create function public.taste_rating_state_v3() returns jsonb
language sql stable security invoker set search_path='' as $$
  select public.taste_rating_state() || jsonb_build_object('storageVersion',3,
    'revisitEarlierSkips',coalesce((select r.revisit_prior_skips from public.taste_rating_rounds r where r.user_id=auth.uid() order by r.round_number desc limit 1),false),
    'canRevisit',coalesce((
    select r.completed_at is null and not r.revisit_prior_skips
      and not exists(select 1 from public.taste_rating_offers o where o.user_id=auth.uid() and o.round_id=r.id and o.decision='offered')
      and exists(select 1 from public.taste_rating_offers o where o.user_id=auth.uid() and o.round_id<>r.id and o.decision='skipped'
        and not exists(select 1 from public.ratings x where x.user_id=auth.uid() and x.work_id=o.work_id)
        and not exists(select 1 from public.user_book_status x where x.user_id=auth.uid() and x.work_id=o.work_id and x.status='read')
        and not exists(select 1 from public.taste_rating_offers x where x.user_id=auth.uid() and x.round_id=r.id and x.work_id=o.work_id))
    from public.taste_rating_rounds r where r.user_id=auth.uid() order by r.round_number desc limit 1),false));
$$;
revoke all on function public.taste_rating_state_v3() from public,anon;
grant execute on function public.taste_rating_state_v3() to authenticated;

create function taste_private.advance_round_v3(p_action text,p_round_id uuid,p_work_id bigint,p_score integer,p_language text,p_goal integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  uid uuid := auth.uid(); r public.taste_rating_rounds; o public.taste_rating_offers;
  next_work bigint; inserted integer;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_action is null or p_action not in ('start','resume','skip','rate','choose','extend','revisit') then
    raise exception 'Invalid action' using errcode='22023'; end if;
  -- Same reader lock as v1/v2; transaction scoped, no global table lock per action.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('lumiscore-taste:'||uid::text,0));
  select * into r from public.taste_rating_rounds where user_id=uid order by round_number desc limit 1 for update;
  if p_action='start' then
    if p_goal is null or p_goal not in (10,15,20,30) or p_language is null or p_language not in ('nl','en') then
      raise exception 'Invalid round choice' using errcode='22023'; end if;
    -- Stale/double starts cannot erase an open round or advance a completed one.
    if r.id is not null and r.completed_at is not null and p_round_id is distinct from r.id then
      raise exception 'Refresh before another round' using errcode='22023'; end if;
    if r.id is null or r.completed_at is not null then
      insert into public.taste_rating_rounds(user_id,round_number,language,goal)
        values(uid,coalesce(r.round_number,0)+1,p_language,p_goal) returning * into r;
    end if;
  elsif r.id is null or p_round_id is distinct from r.id then
    raise exception 'Round not current' using errcode='22023';
  end if;
  if p_action='extend' then
    if r.goal=20 or p_goal is null or p_goal not in (15,30) or p_goal<r.goal then
      raise exception 'Invalid extension' using errcode='22023'; end if;
    if p_goal>r.goal then update public.taste_rating_rounds set goal=p_goal,completed_at=null
      where id=r.id and user_id=uid returning * into r; end if;
  end if;
  if p_action in ('rate','skip') then
    select * into o from public.taste_rating_offers where user_id=uid and round_id=r.id and work_id=p_work_id for update;
    if o.work_id is null then raise exception 'Book not offered' using errcode='22023'; end if;
    if o.decision<>'offered' then
      if (p_action='rate' and o.decision='rated' and o.score=p_score) or (p_action='skip' and o.decision='skipped') then
        return public.taste_rating_state_v3(); end if;
      raise exception 'Book already decided' using errcode='22023';
    end if;
    if r.completed_at is not null then raise exception 'Round complete' using errcode='22023'; end if;
    if p_action='rate' then
      if p_score is null or p_score<1 or p_score>10 then raise exception 'Invalid rating' using errcode='22023'; end if;
      if not taste_private.inventory_current_v1(p_work_id,r.language) then
        raise exception 'Verified inventory unavailable' using errcode='22023'; end if;
      insert into public.ratings(user_id,work_id,rating) values(uid,p_work_id,p_score)
        on conflict(user_id,work_id) do nothing;
      get diagnostics inserted=row_count;
      if inserted<>1 then raise exception 'Existing rating preserved' using errcode='23505'; end if;
      -- Keep the existing rating-implies-read trigger; never write a parallel status.
      update public.taste_rating_offers set decision='rated',score=p_score,decided_at=now()
        where user_id=uid and round_id=r.id and work_id=p_work_id;
    else
      update public.taste_rating_offers set decision='skipped',decided_at=now()
        where user_id=uid and round_id=r.id and work_id=p_work_id;
    end if;
  elsif p_action='choose' then
    if r.completed_at is not null or p_work_id is null
      or not taste_private.inventory_current_v1(p_work_id,r.language)
      or exists(select 1 from public.ratings where user_id=uid and work_id=p_work_id)
      or exists(select 1 from public.user_book_status where user_id=uid and work_id=p_work_id and status='read')
      or exists(select 1 from public.taste_rating_offers where user_id=uid and work_id=p_work_id and
        (round_id=r.id or decision<>'skipped' or not r.revisit_prior_skips)) then
      raise exception 'Choose another eligible unrated book' using errcode='22023'; end if;
    -- Explicit choosing abandons only the current offer, not old round history.
    update public.taste_rating_offers set decision='skipped',decided_at=now()
      where user_id=uid and round_id=r.id and decision='offered';
    insert into public.taste_rating_offers(round_id,user_id,work_id) values(r.id,uid,p_work_id);
  elsif p_action='revisit' then
    if r.completed_at is not null or exists(select 1 from public.taste_rating_offers where user_id=uid and round_id=r.id and decision='offered') then
      raise exception 'Revisit only after exhaustion' using errcode='22023'; end if;
    update public.taste_rating_rounds set revisit_prior_skips=true where id=r.id and user_id=uid returning * into r;
  end if;
  if (select count(*) from public.taste_rating_offers where round_id=r.id and user_id=uid and decision='rated')>=r.goal then
    update public.taste_rating_rounds set completed_at=coalesce(completed_at,now()) where id=r.id and user_id=uid;
  elsif r.completed_at is null and not exists(select 1 from public.taste_rating_offers where round_id=r.id and user_id=uid and decision='offered') then
    select w.id into next_work from public.works w
    join taste_private.eligible_inventory_v1 i on i.work_id=w.id and i.language=r.language
    where taste_private.inventory_current_v1(w.id,r.language)
      and not exists(select 1 from public.ratings x where x.user_id=uid and x.work_id=w.id)
      and not exists(select 1 from public.user_book_status x where x.user_id=uid and x.work_id=w.id and x.status='read')
      and not exists(select 1 from public.taste_rating_offers x where x.user_id=uid and x.work_id=w.id
        and (x.round_id=r.id or x.decision<>'skipped' or not r.revisit_prior_skips))
    order by
      (select count(*) from public.taste_rating_offers x join public.works prev on prev.id=x.work_id where x.round_id=r.id and prev.author_id=w.author_id),
      (select count(*) from public.taste_rating_offers x join public.work_catalog_categories prev on prev.work_id=x.work_id
        where x.round_id=r.id and exists(select 1 from public.work_catalog_categories c where c.work_id=w.id and c.category_id=prev.category_id)),
      (select count(*) from public.ratings popularity where popularity.work_id=w.id) desc,
      (w.cover_id is not null) desc,w.id limit 1;
    if next_work is not null then insert into public.taste_rating_offers(round_id,user_id,work_id) values(r.id,uid,next_work); end if;
  end if;
  return public.taste_rating_state_v3();
end;
$$;
revoke all on function taste_private.advance_round_v3(text,uuid,bigint,integer,text,integer) from public,anon;
grant execute on function taste_private.advance_round_v3(text,uuid,bigint,integer,text,integer) to authenticated;
create function public.taste_rating_advance_v3(p_action text,p_round_id uuid default null,p_work_id bigint default null,
  p_score integer default null,p_language text default 'en',p_goal integer default 20) returns jsonb
language sql volatile security invoker set search_path='' as $$
  select taste_private.advance_round_v3(p_action,p_round_id,p_work_id,p_score,p_language,p_goal);
$$;
revoke all on function public.taste_rating_advance_v3(text,uuid,bigint,integer,text,integer) from public,anon;
grant execute on function public.taste_rating_advance_v3(text,uuid,bigint,integer,text,integer) to authenticated;
-- Essential: v2 UPDATE used user_id/work_id without round_id. Keeping it executable
-- after the new key would mutate historical decisions. Bridge EVERY old entry.
create or replace function taste_private.advance_round_v2(p_action text,p_round_id uuid,p_work_id bigint,p_score integer,p_language text,p_goal integer)
returns jsonb language sql volatile security definer set search_path='' as $$
  select taste_private.advance_round_v3(p_action,p_round_id,p_work_id,p_score,p_language,p_goal);
$$;
revoke all on function taste_private.advance_round_v2(text,uuid,bigint,integer,text,integer) from public,anon;
grant execute on function taste_private.advance_round_v2(text,uuid,bigint,integer,text,integer) to authenticated;
commit;
