-- Restore only after code rollback; guards for the exact installed body required.
begin;
do $helper_restore$ declare current_body text;current_definer boolean;current_acl text;begin
select prosrc,prosecdef,proacl::text into current_body,current_definer,current_acl from pg_proc where oid=to_regprocedure('taste_private.content_eligible_v1(bigint,text)');if current_body is distinct from '
declare eligible boolean;begin
if auth.uid() is null then return false;end if;
select coalesce((select
   not exists(select 1 from public.work_catalog_categories c where c.work_id=w.id and c.category_id=''nonfiction_cooking_food'')
   and not exists(select 1 from public.work_trait_evidence t cross join lateral unnest(t.raw_labels) label
     where t.work_id=w.id and t.mapping_version=''taste_traits_v1'' and t.source in (''manual'',''reviewed_seed'',''open_library'',''google_books'')
       and t.confidence>=0.6 and label ~* ''\m(cooking|cookbooks?|cookery|recipes?|kookboeken?|kookkunst|recepten(boek(en)?)?)\M''
       -- A loose provider subject is not a reviewed cookbook classification.
       -- Specific existing catalogue categories outrank weaker external labels.
       and (t.source in (''manual'',''reviewed_seed'') or not exists(
         select 1 from public.work_catalog_categories c join public.catalog_categories known on known.id=c.category_id
         where c.work_id=w.id and c.category_id<>''nonfiction_cooking_food'')))
   and (exists(select 1 from public.work_catalog_categories c join public.catalog_categories known on known.id=c.category_id
       where c.work_id=w.id and c.category_id<>''nonfiction_cooking_food'')
     or exists(select 1 from public.work_trait_evidence t where t.work_id=w.id and t.mapping_version=''taste_traits_v1''
       and t.source in (''manual'',''reviewed_seed'',''open_library'',''google_books'') and t.confidence>=0.6 and t.weight>0 and t.weight<=1
       and t.trait in (''fantasy'',''science_fiction'',''literary'',''romance'',''thriller_mystery'',''nonfiction'')))
   and exists(select 1 from public.editions e left join public.catalog_edition_metadata m on m.edition_id=e.id
     and m.work_id=w.id and m.bound_author_id=w.author_id and m.bound_title=e.title and m.bound_isbn13=e.isbn_13
     and m.bound_language=e.language and m.review_status=''approved''
     where e.work_id=w.id and length(trim(e.title))>0 and lower(e.language)=any(case p_language
       when ''nl'' then array[''nl'',''nld'',''dut''] when ''en'' then array[''en'',''eng''] else array[]::text[] end)
       and (m.edition_id is null or m.format in (''paperback'',''hardcover'',''ebook'') or(w.work_type=''audiobook_original'' and m.format=''audio''))
       and e.title !~* ''\m(omnibus|boxed[ -]?set|study guide|adaptation|large[ -]?print|book summary)\M''
       and (w.work_type=''audiobook_original'' or e.title !~* ''\m(audiobook|audio book|mp3|unabridged|abridged|cassette)\M''))
   from public.works w join public.authors a on a.id=w.author_id
   where w.id=p_work_id and length(trim(w.title))>0 and length(trim(a.name))>0
     and coalesce(w.open_library_id,w.native_identity_key) is not null),false) into eligible;
if not eligible then return false;end if;
-- Preserve a pre-existing stricter reviewed inventory; never fall back on errors.
if to_regprocedure(''taste_private.inventory_current_v1(bigint,text)'') is not null then
 execute ''select taste_private.inventory_current_v1($1,$2)'' into eligible using p_work_id,p_language;
end if;return coalesce(eligible,false);end;
' or current_definer is distinct from true or current_acl is distinct from '{postgres=X/postgres,authenticated=X/postgres}' then raise exception 'Later helper body or permissions change; recovery refused';end if;
select prosrc,prosecdef,proacl::text into current_body,current_definer,current_acl from pg_proc where oid=to_regprocedure('public.taste_rating_allowed(bigint,text)');if current_body is distinct from ' select taste_private.content_eligible_v1(p_work_id,p_language); ' or current_definer is distinct from false or current_acl is distinct from '{postgres=X/postgres,authenticated=X/postgres}' then raise exception 'Later helper body or permissions change; recovery refused';end if;
select prosrc,prosecdef,proacl::text into current_body,current_definer,current_acl from pg_proc where oid=to_regprocedure('public.taste_rating_candidates(text,text)');if current_body is distinct from '
 with current_round as(select r.* from public.taste_rating_rounds r where r.user_id=(select auth.uid()) order by r.round_number desc limit 1)
 select w.id from current_round r cross join public.works w join public.authors a on a.id=w.author_id
 where r.completed_at is null and p_language in(''nl'',''en'') and length(trim(p_query)) between 2 and 100
   and taste_private.content_eligible_v1(w.id,r.language) and taste_private.content_eligible_v1(w.id,p_language)
   and exists(select 1 from public.editions e where e.work_id=w.id and (e.title ilike ''%''||replace(replace(replace(p_query,''\'',''\\''),''%'',''\%''),''_'',''\_'')||''%'' or a.name ilike ''%''||replace(replace(replace(p_query,''\'',''\\''),''%'',''\%''),''_'',''\_'')||''%''))
   and not exists(select 1 from public.ratings x where x.user_id=r.user_id and x.work_id=w.id)
   and not exists(select 1 from public.taste_rating_offers x where x.user_id=r.user_id and x.work_id=w.id
     and (x.round_id=r.id or x.decision<>''skipped'' or not coalesce((to_jsonb(r)->>''revisit_prior_skips'')::boolean,false)))
 order by w.id limit 20; ' or current_definer is distinct from false or current_acl is distinct from '{postgres=X/postgres,authenticated=X/postgres}' then raise exception 'Later helper body or permissions change; recovery refused';end if;
end;$helper_restore$;
do $guard$ begin
if pg_get_functiondef('taste_private.advance_round_v2(text, uuid, bigint, integer, text, integer)'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION taste_private.advance_round_v2(p_action text, p_round_id uuid, p_work_id bigint, p_score integer, p_language text, p_goal integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''''
AS $function$
declare
  uid uuid := auth.uid();
  r public.taste_rating_rounds;
  o public.taste_rating_offers;
  next_work bigint;
  inserted integer;
begin
  if uid is null then raise exception ''Authentication required'' using errcode=''42501''; end if;
  if p_action is null or p_action not in (''start'',''resume'',''skip'',''rate'',''choose'',''extend'') then raise exception ''Invalid action'' using errcode=''22023''; end if;
  -- Serialize only this reader''s round actions; website traffic remains online.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(''lumiscore-taste:''||uid::text,0));
  select * into r from public.taste_rating_rounds where user_id=uid order by round_number desc limit 1 for update;
  if p_action=''start'' then
    if p_goal is null or p_goal not in (10,15,20,30) then raise exception ''Invalid goal'' using errcode=''22023''; end if;
    if p_language is null or p_language not in (''nl'',''en'') then raise exception ''Invalid language'' using errcode=''22023''; end if;
    if r.id is null or r.completed_at is not null then
      insert into public.taste_rating_rounds(user_id,round_number,language,goal)
        values(uid,coalesce(r.round_number,0)+1,p_language,p_goal) returning * into r;
    end if;
  elsif r.id is null or p_round_id is distinct from r.id or r.user_id<>uid then
    raise exception ''Round not current'' using errcode=''22023'';
  end if;
  if p_action=''extend'' then
    if r.goal=20 or p_goal is null or p_goal not in (15,30) or p_goal<r.goal then
      raise exception ''Invalid extension'' using errcode=''22023'';
    end if;
    if p_goal>r.goal then
      update public.taste_rating_rounds set goal=p_goal,completed_at=null where id=r.id and user_id=uid returning * into r;
    end if;
  end if;
  -- Retire only an ineligible pending offer; keep history, all ratings and counters.
  -- GET is read-only; explicit resume/extend/start/choose performs this transition.
  if p_action in (''start'',''resume'',''extend'',''choose'') and r.completed_at is null then
    update public.taste_rating_offers set decision=''skipped'',decided_at=now()
      where round_id=r.id and user_id=uid and decision=''offered''
        and not taste_private.content_eligible_v1(work_id,r.language);
  end if;
  if p_action in (''rate'',''skip'') then
    select * into o from public.taste_rating_offers where user_id=uid and round_id=r.id and work_id=p_work_id for update;
    if o.work_id is null then raise exception ''Book not offered'' using errcode=''22023''; end if;
    if o.decision<>''offered'' then
      -- Retries return persisted state, but a different decision is not accepted.
      if (p_action=''rate'' and o.decision=''rated'' and o.score=p_score) or (p_action=''skip'' and o.decision=''skipped'') then
        return public.taste_rating_state();
      end if;
      raise exception ''Book already decided'' using errcode=''22023'';
    end if;
    if r.completed_at is not null then raise exception ''Round complete'' using errcode=''22023''; end if;
    if p_action=''rate'' then
      if not taste_private.content_eligible_v1(p_work_id,r.language) then raise exception ''Book no longer taste eligible; resume'' using errcode=''22023'';end if;
      if p_score is null or p_score<1 or p_score>10 then raise exception ''Invalid rating'' using errcode=''22023''; end if;
      insert into public.ratings(user_id,work_id,rating) values(uid,p_work_id,p_score)
        on conflict(user_id,work_id) do nothing;
      get diagnostics inserted=row_count;
      if inserted<>1 then raise exception ''Existing rating preserved; choose another book'' using errcode=''23505''; end if;
      -- Existing ratings trigger applies the existing rating-implies-read rule.
      update public.taste_rating_offers set decision=''rated'',score=p_score,decided_at=now() where user_id=uid and work_id=p_work_id;
    else
      update public.taste_rating_offers set decision=''skipped'',decided_at=now() where user_id=uid and work_id=p_work_id;
    end if;
  elsif p_action=''choose'' then
    if not taste_private.content_eligible_v1(p_work_id,r.language) then raise exception ''Choose an eligible book'' using errcode=''22023'';end if;
    if r.completed_at is not null then raise exception ''Round complete'' using errcode=''22023''; end if;
    if p_work_id is null or not exists(select 1 from public.works where id=p_work_id)
      or exists(select 1 from public.ratings where user_id=uid and work_id=p_work_id)
      or exists(select 1 from public.taste_rating_offers where user_id=uid and work_id=p_work_id) then
      raise exception ''Choose a different unrated book'' using errcode=''22023'';
    end if;
    update public.taste_rating_offers set decision=''skipped'',decided_at=now() where round_id=r.id and user_id=uid and decision=''offered'';
    insert into public.taste_rating_offers(round_id,user_id,work_id) values(r.id,uid,p_work_id);
  end if;
  if (select count(*) from public.taste_rating_offers where round_id=r.id and user_id=uid and decision=''rated'')>=r.goal then
    update public.taste_rating_rounds set completed_at=coalesce(completed_at,now()) where id=r.id and user_id=uid;
  elsif r.completed_at is null and not exists(select 1 from public.taste_rating_offers where round_id=r.id and user_id=uid and decision=''offered'') then
    select w.id into next_work from public.works w
    where not exists(select 1 from public.ratings x where x.user_id=uid and x.work_id=w.id)
      and not exists(select 1 from public.taste_rating_offers x where x.user_id=uid and x.work_id=w.id)
      and exists(select 1 from public.editions e where e.work_id=w.id and
        ((r.language=''nl'' and lower(e.language) in (''nl'',''nld'',''dut'')) or (r.language=''en'' and lower(e.language) in (''en'',''eng''))))
      and taste_private.content_eligible_v1(w.id,r.language)
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
$function$
' then raise exception 'Later function change; recovery refused';end if;
if pg_get_functiondef('public.taste_rating_state()'::regprocedure) is distinct from 'CREATE OR REPLACE FUNCTION public.taste_rating_state()
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''''
AS $function$
  select coalesce((select jsonb_build_object(
    ''round'',jsonb_build_object(''id'',r.id,''number'',r.round_number,''language'',r.language,
      ''goal'',r.goal,''complete'',r.completed_at is not null,''ratedCount'',(select count(*) from public.taste_rating_offers o where o.round_id=r.id and o.decision=''rated''),
      ''offeredCount'',(select count(*) from public.taste_rating_offers o where o.round_id=r.id)),
    ''currentWorkId'',(select work_id::text from public.taste_rating_offers o where o.round_id=r.id and o.decision=''offered'' and taste_private.content_eligible_v1(o.work_id,r.language)),
    ''exhausted'',r.completed_at is null and not exists(select 1 from public.taste_rating_offers o where o.round_id=r.id and o.decision=''offered'' and taste_private.content_eligible_v1(o.work_id,r.language)))
    from public.taste_rating_rounds r where r.user_id=(select auth.uid()) order by r.round_number desc limit 1),
    ''{"round":null,"currentWorkId":null,"exhausted":false}''::jsonb);
$function$
' then raise exception 'Later function change; recovery refused';end if;
end;$guard$;
CREATE OR REPLACE FUNCTION taste_private.advance_round_v2(p_action text, p_round_id uuid, p_work_id bigint, p_score integer, p_language text, p_goal integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    'currentWorkId',(select work_id::text from public.taste_rating_offers o where o.round_id=r.id and o.decision='offered'),
    'exhausted',r.completed_at is null and not exists(select 1 from public.taste_rating_offers o where o.round_id=r.id and o.decision='offered'))
    from public.taste_rating_rounds r where r.user_id=(select auth.uid()) order by r.round_number desc limit 1),
    '{"round":null,"currentWorkId":null,"exhausted":false}'::jsonb);
$function$
;
drop function public.taste_rating_candidates(text,text);drop function public.taste_rating_allowed(bigint,text);drop function taste_private.content_eligible_v1(bigint,text);
commit;
