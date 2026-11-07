-- Exact test target hlvujbrmfdlrfxdjwsmb. No catalogue, auth or rating data writes.
begin;set local lock_timeout='3s';set local statement_timeout='30s';
do $guard$ begin
if encode(sha256(convert_to(pg_get_functiondef('taste_private.advance_round_v3(text, uuid, bigint, integer, text, integer)'::regprocedure),'UTF8')),'hex') not in ('091ec897bc0542639226ec13d8292ef24fc180a64abfad14bbbc3d3586e1048e','343dd0fb265e701d538ecec675c1cc422fa08ceb1cd59b4fe49670593c2f1e25') then raise exception 'Function drift: advance_round_v3';end if;
if encode(sha256(convert_to(pg_get_functiondef('public.taste_rating_state()'::regprocedure),'UTF8')),'hex') not in ('2c1434547926c214e6c91a798fd5b9f7009851e2ae9483ab91d6c490a38cdb69','39e25afc4f914ec0fc6216eb97ae471552f7b2029cf8a9c29fdeb08d7d779d8d') then raise exception 'Function drift: taste_rating_state';end if;
end;$guard$;
create or replace function taste_private.content_eligible_v1(p_work_id bigint,p_language text) returns boolean language plpgsql stable security definer set search_path='' as $policy$
declare eligible boolean;begin
if auth.uid() is null then return false;end if;
select coalesce((select
   not exists(select 1 from public.work_catalog_categories c where c.work_id=w.id and c.category_id='nonfiction_cooking_food')
   and not exists(select 1 from public.work_trait_evidence t cross join lateral unnest(t.raw_labels) label
     where t.work_id=w.id and t.mapping_version='taste_traits_v1' and t.source in ('manual','reviewed_seed','open_library','google_books')
       and t.confidence>=0.6 and label ~* '\m(cooking|cookbooks?|cookery|recipes?|kookboeken?|kookkunst|recepten(boek(en)?)?)\M'
       -- A loose provider subject is not a reviewed cookbook classification.
       -- Specific existing catalogue categories outrank weaker external labels.
       and (t.source in ('manual','reviewed_seed') or not exists(
         select 1 from public.work_catalog_categories c join public.catalog_categories known on known.id=c.category_id
         where c.work_id=w.id and c.category_id<>'nonfiction_cooking_food')))
   and (exists(select 1 from public.work_catalog_categories c join public.catalog_categories known on known.id=c.category_id
       where c.work_id=w.id and c.category_id<>'nonfiction_cooking_food')
     or exists(select 1 from public.work_trait_evidence t where t.work_id=w.id and t.mapping_version='taste_traits_v1'
       and t.source in ('manual','reviewed_seed','open_library','google_books') and t.confidence>=0.6 and t.weight>0 and t.weight<=1
       and t.trait in ('fantasy','science_fiction','literary','romance','thriller_mystery','nonfiction')))
   and exists(select 1 from public.editions e left join public.catalog_edition_metadata m on m.edition_id=e.id
     and m.work_id=w.id and m.bound_author_id=w.author_id and m.bound_title=e.title and m.bound_isbn13=e.isbn_13
     and m.bound_language=e.language and m.review_status='approved'
     where e.work_id=w.id and length(trim(e.title))>0 and lower(e.language)=any(case p_language
       when 'nl' then array['nl','nld','dut'] when 'en' then array['en','eng'] else array[]::text[] end)
       and (m.edition_id is null or m.format in ('paperback','hardcover','ebook') or(w.work_type='audiobook_original' and m.format='audio'))
       and e.title !~* '\m(omnibus|boxed[ -]?set|study guide|adaptation|large[ -]?print|book summary)\M'
       and (w.work_type='audiobook_original' or e.title !~* '\m(audiobook|audio book|mp3|unabridged|abridged|cassette)\M'))
   from public.works w join public.authors a on a.id=w.author_id
   where w.id=p_work_id and length(trim(w.title))>0 and length(trim(a.name))>0
     and coalesce(w.open_library_id,w.native_identity_key) is not null),false) into eligible;
if not eligible then return false;end if;
-- Preserve a pre-existing stricter reviewed inventory; never fall back on errors.
if to_regprocedure('taste_private.inventory_current_v1(bigint,text)') is not null then
 execute 'select taste_private.inventory_current_v1($1,$2)' into eligible using p_work_id,p_language;
end if;return coalesce(eligible,false);end;
$policy$;
revoke all on function taste_private.content_eligible_v1(bigint,text) from public,anon,service_role;
grant execute on function taste_private.content_eligible_v1(bigint,text) to authenticated;

CREATE OR REPLACE FUNCTION taste_private.advance_round_v3(p_action text, p_round_id uuid, p_work_id bigint, p_score integer, p_language text, p_goal integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- Retire only an ineligible pending offer; keep history, all ratings and counters.
  -- GET is read-only; explicit resume/extend/start/choose performs this transition.
  if p_action in ('start','resume','extend','choose') and r.completed_at is null then
    update public.taste_rating_offers set decision='skipped',decided_at=now()
      where round_id=r.id and user_id=uid and decision='offered'
        and not taste_private.content_eligible_v1(work_id,r.language);
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
      if not taste_private.content_eligible_v1(p_work_id,r.language) then raise exception 'Book no longer taste eligible; resume' using errcode='22023';end if;
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
    if not taste_private.content_eligible_v1(p_work_id,r.language) then raise exception 'Choose an eligible book' using errcode='22023';end if;
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
      and taste_private.content_eligible_v1(w.id,r.language)
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
$function$
;
CREATE OR REPLACE FUNCTION public.taste_rating_state()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select coalesce((select jsonb_build_object(
    'round',jsonb_build_object('id',r.id,'number',r.round_number,'language',r.language,
      'goal',r.goal,'complete',r.completed_at is not null,'ratedCount',(select count(*) from public.taste_rating_offers o where o.round_id=r.id and o.decision='rated'),
      'offeredCount',(select count(*) from public.taste_rating_offers o where o.round_id=r.id)),
    'currentWorkId',(select work_id::text from public.taste_rating_offers o where o.round_id=r.id and o.decision='offered' and taste_private.content_eligible_v1(o.work_id,r.language)),
    'exhausted',r.completed_at is null and not exists(select 1 from public.taste_rating_offers o where o.round_id=r.id and o.decision='offered' and taste_private.content_eligible_v1(o.work_id,r.language)))
    from public.taste_rating_rounds r where r.user_id=(select auth.uid()) order by r.round_number desc limit 1),
    '{"round":null,"currentWorkId":null,"exhausted":false}'::jsonb);
$function$
;
create or replace function public.taste_rating_allowed(p_work_id bigint,p_language text) returns boolean language sql stable security invoker set search_path='' as $allowed$ select taste_private.content_eligible_v1(p_work_id,p_language); $allowed$;
revoke all on function public.taste_rating_allowed(bigint,text) from public,anon,service_role;grant execute on function public.taste_rating_allowed(bigint,text) to authenticated;
create or replace function public.taste_rating_candidates(p_query text,p_language text) returns table(work_id bigint) language sql stable security invoker set search_path='' as $candidates$
 with current_round as(select r.* from public.taste_rating_rounds r where r.user_id=(select auth.uid()) order by r.round_number desc limit 1)
 select w.id from current_round r cross join public.works w join public.authors a on a.id=w.author_id
 where r.completed_at is null and p_language in('nl','en') and length(trim(p_query)) between 2 and 100
   and taste_private.content_eligible_v1(w.id,r.language) and taste_private.content_eligible_v1(w.id,p_language)
   and exists(select 1 from public.editions e where e.work_id=w.id and (e.title ilike '%'||replace(replace(replace(p_query,'\','\\'),'%','\%'),'_','\_')||'%' or a.name ilike '%'||replace(replace(replace(p_query,'\','\\'),'%','\%'),'_','\_')||'%' or w.title ilike '%'||replace(replace(replace(p_query,'\','\\'),'%','\%'),'_','\_')||'%' or exists(select 1 from public.catalog_work_title_aliases alias where alias.work_id=w.id and alias.title ilike '%'||replace(replace(replace(p_query,'\','\\'),'%','\%'),'_','\_')||'%')))
   and not exists(select 1 from public.ratings x where x.user_id=r.user_id and x.work_id=w.id)
   and not exists(select 1 from public.taste_rating_offers x where x.user_id=r.user_id and x.work_id=w.id
     and (x.round_id=r.id or x.decision<>'skipped' or not coalesce((to_jsonb(r)->>'revisit_prior_skips')::boolean,false)))
 order by w.id limit 20; $candidates$;
revoke all on function public.taste_rating_candidates(text,text) from public,anon,service_role;grant execute on function public.taste_rating_candidates(text,text) to authenticated;

commit;
