-- Additive API. Old clients and existing explicit ratings remain valid.
begin;
create function taste_private.round_pool(p_round_id uuid) returns table(work_id bigint)
language sql stable security definer set search_path='' as $$
  with r as (select * from public.taste_rating_rounds where id=p_round_id and user_id=(select auth.uid()) and completed_at is null),
  eligible as materialized (
    select w.id,w.author_id,
      exists(select 1 from public.taste_rating_offers o where o.user_id=r.user_id and o.round_id=r.id and o.work_id=w.id and o.decision='offered') as current_offer,
      (select count(*) from public.ratings x where x.work_id=w.id) as popularity
    from r cross join public.works w
    where taste_private.content_eligible_v1(w.id,r.language)
      and not exists(select 1 from public.ratings x where x.user_id=r.user_id and x.work_id=w.id)
      and not exists(select 1 from public.taste_rating_offers o where o.user_id=r.user_id and o.work_id=w.id and (o.round_id<>r.id or o.decision<>'offered'))
  ), ranked as (select *,row_number() over(partition by author_id order by popularity desc,id) as author_position from eligible)
  select id from ranked order by current_offer desc,author_position,popularity desc,id limit 60;
$$;
create function public.taste_rating_pool(p_round_id uuid) returns table(work_id bigint)
language sql stable security invoker set search_path='' as $$ select * from taste_private.round_pool(p_round_id); $$;

create function taste_private.save_round_batch(p_round_id uuid,p_decisions jsonb) returns jsonb
language plpgsql volatile security definer set search_path='' as $$
declare uid uuid:=auth.uid(); r public.taste_rating_rounds; o public.taste_rating_offers;
  d jsonb; wid bigint; v_score integer; v_decision text; rated integer; inserted integer; changed boolean:=false;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_decisions is null or jsonb_typeof(p_decisions)<>'array' then raise exception 'Invalid batch' using errcode='22023'; end if;
  if jsonb_array_length(p_decisions) not between 1 and 120 then raise exception 'Invalid batch size' using errcode='22023'; end if;
  if (select count(distinct value->>'workId') from jsonb_array_elements(p_decisions))<>jsonb_array_length(p_decisions) then raise exception 'Duplicate work' using errcode='22023'; end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('lumiscore-taste:'||uid::text,0));
  select * into r from public.taste_rating_rounds where user_id=uid order by round_number desc limit 1 for update;
  if r.id is null or r.id is distinct from p_round_id then raise exception 'Round not current' using errcode='22023'; end if;
  select count(*) into rated from public.taste_rating_offers where round_id=r.id and user_id=uid and decision='rated';
  for d in select value from jsonb_array_elements(p_decisions) loop
    if jsonb_typeof(d)<>'object' or not coalesce(d->>'workId' ~ '^[1-9][0-9]{0,14}$',false)
      or (select count(*) from jsonb_object_keys(d))<>2 then raise exception 'Invalid decision' using errcode='22023'; end if;
    wid:=(d->>'workId')::bigint;
    if d->'score'='null'::jsonb then v_score:=null;v_decision:='skipped';
    elsif jsonb_typeof(d->'score')='number' and d->>'score' ~ '^(10|[1-9])$' then v_score:=(d->>'score')::integer;v_decision:='rated';
    else raise exception 'Invalid score' using errcode='22023'; end if;
    select * into o from public.taste_rating_offers where user_id=uid and work_id=wid for update;
    -- Idempotent retry, including after a lost successful response.
    if o.round_id=r.id and o.decision=v_decision and o.score is not distinct from v_score then continue; end if;
    if r.completed_at is not null or rated>=r.goal or (o.work_id is not null and (o.round_id<>r.id or o.decision<>'offered')) then
      raise exception 'Round changed; existing decisions preserved' using errcode='22023'; end if;
    if not taste_private.content_eligible_v1(wid,r.language) then raise exception 'Book no longer eligible' using errcode='22023'; end if;
    if exists(select 1 from public.ratings where user_id=uid and work_id=wid) then raise exception 'Existing rating preserved' using errcode='23505'; end if;
    if v_score is not null then
      insert into public.ratings(user_id,work_id,rating) values(uid,wid,v_score) on conflict(user_id,work_id) do nothing;
      get diagnostics inserted=row_count;
      if inserted<>1 then raise exception 'Existing rating preserved' using errcode='23505'; end if;
      rated:=rated+1;
    end if;
    changed:=true;
    if o.work_id is null then
      insert into public.taste_rating_offers(round_id,user_id,work_id,decision,score,decided_at) values(r.id,uid,wid,v_decision,v_score,now());
    else update public.taste_rating_offers set decision=v_decision,score=v_score,decided_at=now() where user_id=uid and work_id=wid; end if;
  end loop;
  if not changed then return public.taste_rating_state(); end if;
  -- A reader choosing another book has declined the former current offer.
  update public.taste_rating_offers set decision='skipped',decided_at=now() where user_id=uid and round_id=r.id and decision='offered';
  -- Reuse completion/next-offer rules once, after the whole atomic batch.
  return taste_private.advance_round_v2('resume',r.id,null,null,r.language,r.goal);
end;
$$;
create function public.taste_rating_save_batch(p_round_id uuid,p_decisions jsonb) returns jsonb
language sql volatile security invoker set search_path='' as $$ select taste_private.save_round_batch(p_round_id,p_decisions); $$;
revoke all on function taste_private.round_pool(uuid),public.taste_rating_pool(uuid),taste_private.save_round_batch(uuid,jsonb),public.taste_rating_save_batch(uuid,jsonb) from public,anon,service_role;
grant execute on function taste_private.round_pool(uuid),public.taste_rating_pool(uuid),taste_private.save_round_batch(uuid,jsonb),public.taste_rating_save_batch(uuid,jsonb) to authenticated;
commit;
