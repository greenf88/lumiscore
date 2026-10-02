-- Additive editorial catalog. No existing bibliographic or user rows are modified.
create schema if not exists catalog_private;
revoke all on schema catalog_private from public, anon, authenticated;

create table public.catalog_categories (
  id text primary key check (id ~ '^[a-z][a-z0-9_]+$'),
  label_nl text not null,
  label_en text not null
);
create table public.catalog_selections (
  slug text primary key,
  label_nl text not null,
  label_en text not null
);
create table public.catalog_selection_members (
  selection_slug text not null references public.catalog_selections(slug),
  work_id bigint not null references public.works(id),
  candidate_id text not null,
  primary key (selection_slug, work_id),
  unique (selection_slug, candidate_id)
);
create index catalog_selection_members_work_idx on public.catalog_selection_members(work_id);
create table public.work_catalog_categories (
  work_id bigint not null references public.works(id),
  category_id text not null references public.catalog_categories(id),
  primary key (work_id, category_id)
);
create index work_catalog_categories_category_idx on public.work_catalog_categories(category_id, work_id);
create table public.catalog_work_title_aliases (
  work_id bigint not null references public.works(id),
  title text not null,
  primary key (work_id,title)
);
alter table public.catalog_work_title_aliases enable row level security;
create policy catalog_work_title_aliases_read on public.catalog_work_title_aliases for select to anon, authenticated using (true);
revoke all on public.catalog_work_title_aliases from public, anon, authenticated;
grant select on public.catalog_work_title_aliases to anon, authenticated;
grant all on public.catalog_work_title_aliases to service_role;
create table catalog_private.editorial_records (
  selection_slug text not null,
  candidate_id text not null,
  work_id bigint not null references public.works(id),
  record_hash text not null,
  editorial_status text not null check (editorial_status in ('ZEKER','WAARSCHIJNLIJK')),
  classifier text not null check (classifier = 'AI_EDITORIAL'),
  audience text,
  work_form text,
  evidence jsonb not null,
  primary key (selection_slug, candidate_id),
  foreign key (selection_slug, work_id) references public.catalog_selection_members(selection_slug, work_id)
);
create index editorial_records_work_idx on catalog_private.editorial_records(work_id);
alter table public.catalog_categories enable row level security;
alter table public.catalog_selections enable row level security;
alter table public.catalog_selection_members enable row level security;
alter table public.work_catalog_categories enable row level security;
alter table catalog_private.editorial_records enable row level security;
create policy catalog_categories_read on public.catalog_categories for select to anon, authenticated using (true);
create policy catalog_selections_read on public.catalog_selections for select to anon, authenticated using (true);
create policy catalog_selection_members_read on public.catalog_selection_members for select to anon, authenticated using (true);
create policy work_catalog_categories_read on public.work_catalog_categories for select to anon, authenticated using (true);
revoke all on public.catalog_categories, public.catalog_selections, public.catalog_selection_members, public.work_catalog_categories from public, anon, authenticated;
grant select on public.catalog_categories, public.catalog_selections, public.catalog_selection_members, public.work_catalog_categories to anon, authenticated;
grant all on public.catalog_categories, public.catalog_selections, public.catalog_selection_members, public.work_catalog_categories to service_role;
grant usage on schema catalog_private to service_role;
grant all on catalog_private.editorial_records to service_role;

-- Same query for Browse and Search. EXISTS avoids multiplying multi-genre Works.
-- Counts and pagination apply AFTER search, selection, language and category filters.
-- No dynamic SQL and no access to editorial evidence or user records.
create function public.catalog_editorial_page(
  p_query text default '', p_categories text[] default '{}',
  p_selection text default '', p_languages text[] default '{}',
  p_sort text default 'az', p_page integer default 1,
  p_page_size integer default 32, p_alias_ids bigint[] default '{}'
) returns jsonb language sql stable security invoker set search_path = '' as $$
  with args as (
    select left(trim(coalesce(p_query,'')),100) as q,
      case when p_page_size in (32,64,128) then p_page_size else 32 end as size
  ), base as materialized (
    select w.id,w.title,w.first_publish_year from public.works w
    left join public.authors a on a.id=w.author_id cross join args
    where (args.q='' or position(lower(args.q) in lower(w.title))>0
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
  ), stats as (
    select count(*) as total from filtered
  ), paging as (
    select total,size,greatest(1,ceil(total::numeric/size)::integer) as pages,
      least(greatest(1,coalesce(p_page,1)),greatest(1,ceil(total::numeric/size)::integer)) as page
    from stats cross join args
  ), results as (
    select f.id, row_number() over(order by
      case when p_sort='newest' then f.first_publish_year end desc nulls last,
      lower(f.title),f.id) as position
    from filtered f order by position
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
revoke all on function public.catalog_editorial_page(text,text[],text,text[],text,integer,integer,bigint[]) from public;
grant execute on function public.catalog_editorial_page(text,text[],text,text[],text,integer,integer,bigint[]) to anon, authenticated, service_role;
