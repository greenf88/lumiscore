-- Forward-only, review/test only. Preserve all existing ratings and rounds.
begin;
alter table public.taste_rating_rounds add column goal integer not null default 20
  constraint taste_rating_rounds_goal check(goal in (10,15,20,30));
create or replace function public.taste_rating_state() returns jsonb
language sql stable security invoker set search_path='' as $$
  select coalesce((select jsonb_build_object(
    'round',jsonb_build_object('id',r.id,'number',r.round_number,'language',r.language,
      'goal',r.goal,'complete',r.completed_at is not null,'ratedCount',(select count(*) from public.taste_rating_offers o where o.round_id=r.id and o.decision='rated'),
      'offeredCount',(select count(*) from public.taste_rating_offers o where o.round_id=r.id)),
    'currentWorkId',(select work_id::text from public.taste_rating_offers o where o.round_id=r.id and o.decision='offered'),
    'exhausted',r.completed_at is null and not exists(select 1 from public.taste_rating_offers o where o.round_id=r.id and o.decision='offered'))
    from public.taste_rating_rounds r where r.user_id=(select auth.uid()) order by r.round_number desc limit 1),
    '{"round":null,"currentWorkId":null,"exhausted":false}'::jsonb);
$$;
revoke all on function public.taste_rating_state() from public,anon;
grant execute on function public.taste_rating_state() to authenticated;


create function taste_private.advance_round_v2(p_action text,p_round_id uuid,p_work_id bigint,p_score integer,p_language text,p_goal integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  r public.taste_rating_rounds;
  o public.taste_rating_offers;
  next_work bigint;
  inserted integer;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_action is null or p_action not in ('start','resume','skip','rate','choose','extend') then raise exception 'Invalid action' using errcode='22023'; end if;
  -- Serialize only this reader's round actions; website traffic remains online.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('lumiscore-taste:'||uid::text,0));
  select * into r from public.taste_rating_rounds where user_id=uid order by round_number desc limit 1 for update;
  if p_action='start' then
    if p_goal is null or p_goal not in (10,15,20,30) then raise exception 'Invalid goal' using errcode='22023'; end if;
    if p_language is null or p_language not in ('nl','en') then raise exception 'Invalid language' using errcode='22023'; end if;
    if r.id is null or r.completed_at is not null then
      insert into public.taste_rating_rounds(user_id,round_number,language,goal)
        values(uid,coalesce(r.round_number,0)+1,p_language,p_goal) returning * into r;
    end if;
  elsif r.id is null or p_round_id is distinct from r.id or r.user_id<>uid then
    raise exception 'Round not current' using errcode='22023';
  end if;
  if p_action='extend' then
    if r.goal=20 or p_goal is null or p_goal not in (15,30) or p_goal<r.goal then
      raise exception 'Invalid extension' using errcode='22023';
    end if;
    if p_goal>r.goal then
      update public.taste_rating_rounds set goal=p_goal,completed_at=null where id=r.id and user_id=uid returning * into r;
    end if;
  end if;
  if p_action in ('rate','skip') then
    select * into o from public.taste_rating_offers where user_id=uid and round_id=r.id and work_id=p_work_id for update;
    if o.work_id is null then raise exception 'Book not offered' using errcode='22023'; end if;
    if o.decision<>'offered' then
      -- Retries return persisted state, but a different decision is not accepted.
      if (p_action='rate' and o.decision='rated' and o.score=p_score) or (p_action='skip' and o.decision='skipped') then
        return public.taste_rating_state();
      end if;
      raise exception 'Book already decided' using errcode='22023';
    end if;
    if r.completed_at is not null then raise exception 'Round complete' using errcode='22023'; end if;
    if p_action='rate' then
      if p_score is null or p_score<1 or p_score>10 then raise exception 'Invalid rating' using errcode='22023'; end if;
      insert into public.ratings(user_id,work_id,rating) values(uid,p_work_id,p_score)
        on conflict(user_id,work_id) do nothing;
      get diagnostics inserted=row_count;
      if inserted<>1 then raise exception 'Existing rating preserved; choose another book' using errcode='23505'; end if;
      -- Existing ratings trigger applies the existing rating-implies-read rule.
      update public.taste_rating_offers set decision='rated',score=p_score,decided_at=now() where user_id=uid and work_id=p_work_id;
    else
      update public.taste_rating_offers set decision='skipped',decided_at=now() where user_id=uid and work_id=p_work_id;
    end if;
  elsif p_action='choose' then
    if r.completed_at is not null then raise exception 'Round complete' using errcode='22023'; end if;
    if p_work_id is null or not exists(select 1 from public.works where id=p_work_id)
      or exists(select 1 from public.ratings where user_id=uid and work_id=p_work_id)
      or exists(select 1 from public.taste_rating_offers where user_id=uid and work_id=p_work_id) then
      raise exception 'Choose a different unrated book' using errcode='22023';
    end if;
    update public.taste_rating_offers set decision='skipped',decided_at=now() where round_id=r.id and user_id=uid and decision='offered';
    insert into public.taste_rating_offers(round_id,user_id,work_id) values(r.id,uid,p_work_id);
  end if;
  if (select count(*) from public.taste_rating_offers where round_id=r.id and user_id=uid and decision='rated')>=r.goal then
    update public.taste_rating_rounds set completed_at=coalesce(completed_at,now()) where id=r.id and user_id=uid;
  elsif r.completed_at is null and not exists(select 1 from public.taste_rating_offers where round_id=r.id and user_id=uid and decision='offered') then
    select w.id into next_work from public.works w
    where not exists(select 1 from public.ratings x where x.user_id=uid and x.work_id=w.id)
      and not exists(select 1 from public.taste_rating_offers x where x.user_id=uid and x.work_id=w.id)
      and exists(select 1 from public.editions e where e.work_id=w.id and
        ((r.language='nl' and lower(e.language) in ('nl','nld','dut')) or (r.language='en' and lower(e.language) in ('en','eng'))))
    order by
      (select count(*) from public.taste_rating_offers x join public.works prev on prev.id=x.work_id
        where x.round_id=r.id and prev.author_id=w.author_id),
      (select count(*) from public.taste_rating_offers x join public.work_catalog_categories prev on prev.work_id=x.work_id
        where x.round_id=r.id and exists(select 1 from public.work_catalog_categories c where c.work_id=w.id and c.category_id=prev.category_id)),
      (select count(*) from public.ratings popularity where popularity.work_id=w.id) desc,
      (w.cover_id is not null) desc,w.id
    limit 1;
    if next_work is not null then insert into public.taste_rating_offers(round_id,user_id,work_id) values(r.id,uid,next_work); end if;
  end if;
  return public.taste_rating_state();
end;
$$;

revoke all on function taste_private.advance_round_v2(text,uuid,bigint,integer,text,integer) from public,anon,authenticated;
grant execute on function taste_private.advance_round_v2(text,uuid,bigint,integer,text,integer) to authenticated;
create function public.taste_rating_advance_v2(p_action text,p_round_id uuid default null,p_work_id bigint default null,p_score integer default null,p_language text default 'en',p_goal integer default 20)
returns jsonb language sql volatile security invoker set search_path='' as $$
  select taste_private.advance_round_v2(p_action,p_round_id,p_work_id,p_score,p_language,p_goal);
$$;
revoke all on function public.taste_rating_advance_v2(text,uuid,bigint,integer,text,integer) from public,anon;
grant execute on function public.taste_rating_advance_v2(text,uuid,bigint,integer,text,integer) to authenticated;
-- Keep the exact deployed five-argument API; new rounds from old clients use 20.
create or replace function taste_private.advance_round(p_action text,p_round_id uuid,p_work_id bigint,p_score integer,p_language text)
returns jsonb language sql volatile security definer set search_path='' as $$
  select taste_private.advance_round_v2(p_action,p_round_id,p_work_id,p_score,p_language,20);
$$;
revoke all on function taste_private.advance_round(text,uuid,bigint,integer,text) from public,anon;
grant execute on function taste_private.advance_round(text,uuid,bigint,integer,text) to authenticated;
commit;
