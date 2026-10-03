-- Review/local only. No backfill, catalog writes or changes to existing policies.
begin;

-- Versioned API: the deployed editorial function remains unchanged.
create function public.catalog_discovery_page(
  p_query text default '', p_categories text[] default '{}',
  p_selection text default '', p_languages text[] default '{}',
  p_sort text default 'az', p_page integer default 1,
  p_page_size integer default 32, p_alias_ids bigint[] default '{}',
  p_author_id bigint default null
) returns jsonb language sql stable security invoker set search_path = '' as $$
  with args as (
    select left(trim(coalesce(p_query,'')),100) as q,
      case when p_page_size in (32,64,128) then p_page_size else 32 end as size
  ), base as materialized (
    select w.id,w.title,w.first_publish_year from public.works w
    left join public.authors a on a.id=w.author_id cross join args
    where (p_author_id is null or w.author_id=p_author_id)
    and (args.q='' or position(lower(args.q) in lower(w.title))>0
      or position(lower(args.q) in lower(a.name))>0
      or w.id=any(coalesce(p_alias_ids,'{}'))
      or exists(select 1 from public.catalog_work_title_aliases alias where alias.work_id=w.id
        and position(lower(args.q) in lower(alias.title))>0)
      or exists(select 1 from public.editions e where e.work_id=w.id
        and position(lower(args.q) in lower(e.title))>0))
    and (coalesce(p_selection,'')='' or exists(
      select 1 from public.catalog_selection_members m where m.work_id=w.id and m.selection_slug=p_selection))
    and (coalesce(cardinality(p_languages),0)=0 or exists(
      select 1 from public.editions e where e.work_id=w.id and
        (('nl'=any(p_languages) and lower(e.language) in ('nl','nld','dut'))
        or ('en'=any(p_languages) and lower(e.language) in ('en','eng')))))
  ), filtered as materialized (
    select * from base b where coalesce(cardinality(p_categories),0)=0 or exists(
      select 1 from public.work_catalog_categories c where c.work_id=b.id and c.category_id=any(p_categories))
  ), summary_batches as (
    select array_agg(id) as ids from (
      select id,(row_number() over(order by id)-1)/100 as batch from filtered where p_sort='highest'
    ) numbered group by batch
  ), summaries as materialized (
    -- Reuse the existing public aggregate, never expose individual ratings.
    select s.* from summary_batches b cross join lateral public.get_work_rating_summaries(b.ids) s
  ), ranked as materialized (
    select f.*,s.lumiscore,s.rating_count from filtered f left join summaries s on s.work_id=f.id
    where p_sort <> 'highest' or s.rating_count >= 1
  ), stats as (select count(*) as total from ranked), paging as (
    select total,size,greatest(1,ceil(total::numeric/size)::integer) as pages,
      least(greatest(1,coalesce(p_page,1)),greatest(1,ceil(total::numeric/size)::integer)) as page
    from stats cross join args
  ), results as (
    select f.id, row_number() over(order by
      case when p_sort='highest' then f.lumiscore end desc nulls last,
      case when p_sort='highest' then f.rating_count end desc nulls last,
      case when p_sort='newest' then f.first_publish_year end desc nulls last,
      lower(f.title),f.id) as position
    from ranked f order by position
    limit (select size from paging) offset (select (page::bigint-1)*size from paging)
  ), facets as (
    select c.id,count(distinct b.id) as count from public.catalog_categories c
    left join public.work_catalog_categories wc on wc.category_id=c.id
    left join base b on b.id=wc.work_id group by c.id
  )
  select jsonb_build_object('workIds',coalesce((select jsonb_agg(id order by position) from results),'[]'::jsonb),
    'total',total,'page',page,'pageSize',size,'pageCount',pages,
    'selectionCount',(select count(*) from public.catalog_selection_members where selection_slug='lumiscore-selectie-1000'),
    'facets',coalesce((select jsonb_object_agg(id,count) from facets),'{}'::jsonb)) from paging;
$$;
revoke all on function public.catalog_discovery_page(text,text[],text,text[],text,integer,integer,bigint[],bigint) from public;
grant execute on function public.catalog_discovery_page(text,text[],text,text[],text,integer,integer,bigint[],bigint) to anon, authenticated;

create table public.taste_rating_rounds (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  round_number integer not null check (round_number>0),
  language text not null check (language in ('nl','en')),
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id,round_number), unique(id,user_id)
);
create unique index taste_rating_rounds_one_open on public.taste_rating_rounds(user_id) where completed_at is null;
create table public.taste_rating_offers (
  round_id uuid not null,
  user_id uuid not null,
  work_id bigint not null references public.works(id),
  decision text not null default 'offered' check(decision in ('offered','skipped','rated')),
  score smallint check(score between 1 and 10),
  offered_at timestamptz not null default now(),
  decided_at timestamptz,
  primary key(user_id,work_id),
  foreign key(round_id,user_id) references public.taste_rating_rounds(id,user_id) on delete cascade,
  check((decision='rated')=(score is not null))
);
create index taste_rating_offers_round_idx on public.taste_rating_offers(round_id,decision);
create unique index taste_rating_offers_one_current on public.taste_rating_offers(round_id) where decision='offered';
alter table public.taste_rating_rounds enable row level security;
alter table public.taste_rating_rounds force row level security;
alter table public.taste_rating_offers enable row level security;
alter table public.taste_rating_offers force row level security;
revoke all on public.taste_rating_rounds,public.taste_rating_offers from public,anon,authenticated;
grant select on public.taste_rating_rounds,public.taste_rating_offers to authenticated;
create policy taste_rating_rounds_own on public.taste_rating_rounds for select to authenticated using(user_id=(select auth.uid()));
create policy taste_rating_offers_own on public.taste_rating_offers for select to authenticated using(user_id=(select auth.uid()));

create function public.taste_rating_state() returns jsonb
language sql stable security invoker set search_path='' as $$
  select coalesce((select jsonb_build_object(
    'round',jsonb_build_object('id',r.id,'number',r.round_number,'language',r.language,
      'complete',r.completed_at is not null,'ratedCount',(select count(*) from public.taste_rating_offers o where o.round_id=r.id and o.decision='rated'),
      'offeredCount',(select count(*) from public.taste_rating_offers o where o.round_id=r.id)),
    'currentWorkId',(select work_id::text from public.taste_rating_offers o where o.round_id=r.id and o.decision='offered'),
    'exhausted',r.completed_at is null and not exists(select 1 from public.taste_rating_offers o where o.round_id=r.id and o.decision='offered'))
    from public.taste_rating_rounds r where r.user_id=(select auth.uid()) order by r.round_number desc limit 1),
    '{"round":null,"currentWorkId":null,"exhausted":false}'::jsonb);
$$;
revoke all on function public.taste_rating_state() from public;
grant execute on function public.taste_rating_state() to authenticated;

-- Privileged implementation stays outside exposed public API schema.
-- Ownership is always obtained from verified JWT auth.uid(), never an input ID.
create schema taste_private;
revoke all on schema taste_private from public,anon,authenticated;
grant usage on schema taste_private to authenticated;
create function taste_private.advance_round(p_action text,p_round_id uuid,p_work_id bigint,p_score integer,p_language text)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  uid uuid := auth.uid();
  r public.taste_rating_rounds;
  o public.taste_rating_offers;
  next_work bigint;
  inserted integer;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  if p_action is null or p_action not in ('start','resume','skip','rate','choose') then raise exception 'Invalid action' using errcode='22023'; end if;
  -- Serialize only this reader's round actions; website traffic remains online.
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('lumiscore-taste:'||uid::text,0));
  select * into r from public.taste_rating_rounds where user_id=uid order by round_number desc limit 1 for update;
  if p_action='start' then
    if p_language is null or p_language not in ('nl','en') then raise exception 'Invalid language' using errcode='22023'; end if;
    if r.id is null or r.completed_at is not null then
      insert into public.taste_rating_rounds(user_id,round_number,language)
        values(uid,coalesce(r.round_number,0)+1,p_language) returning * into r;
    end if;
  elsif r.id is null or p_round_id is distinct from r.id or r.user_id<>uid then
    raise exception 'Round not current' using errcode='22023';
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
  if (select count(*) from public.taste_rating_offers where round_id=r.id and user_id=uid and decision='rated')=20 then
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
revoke all on function taste_private.advance_round(text,uuid,bigint,integer,text) from public,anon,authenticated;
grant execute on function taste_private.advance_round(text,uuid,bigint,integer,text) to authenticated;
create function public.taste_rating_advance(p_action text,p_round_id uuid default null,p_work_id bigint default null,p_score integer default null,p_language text default 'en')
returns jsonb language sql volatile security invoker set search_path='' as $$
  select taste_private.advance_round(p_action,p_round_id,p_work_id,p_score,p_language);
$$;
revoke all on function public.taste_rating_advance(text,uuid,bigint,integer,text) from public,anon;
grant execute on function public.taste_rating_advance(text,uuid,bigint,integer,text) to authenticated;
commit;
