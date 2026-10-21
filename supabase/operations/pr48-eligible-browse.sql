-- PR48: independently reviewed, read-only function. Install on TEST first.
-- No catalog, ratings, policies or existing RPCs are changed.
begin;
create or replace function public.catalog_browse_page_v2(
  p_locale text, p_query text default '', p_categories text[] default '{}',
  p_selection text default '', p_languages text[] default '{}',
  p_sort text default 'highest', p_page integer default 1,
  p_page_size integer default 16, p_alias_ids bigint[] default '{}',
  p_author_id bigint default null
) returns jsonb language plpgsql stable security invoker set search_path = '' as $fn$
declare
  result jsonb;
  ws constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
begin
  if p_locale is null or p_locale not in ('nl','en')
    or p_sort is null or p_sort not in ('az','newest','highest')
    or p_page_size is null or p_page_size not in (16,32,64,128)
    or length(coalesce(p_query,''))>100
    or coalesce(cardinality(p_categories),0)>32
    or coalesce(cardinality(p_languages),0)>2
    or coalesce(cardinality(p_alias_ids),0)>100 then
    raise exception using errcode='22023',message='Invalid public browse selection';
  end if;
  with base as materialized (
    select w.id,w.title,w.first_publish_year from public.works w
    left join public.authors a on a.id=w.author_id
    where btrim(coalesce(w.title,''),ws)<>''
    and (p_author_id is null or w.author_id=p_author_id)
    and (trim(coalesce(p_query,''))='' or position(lower(trim(p_query)) in lower(w.title))>0
      or position(lower(trim(p_query)) in lower(a.name))>0
      or w.id=any(coalesce(p_alias_ids,'{}'))
      or exists(select 1 from public.catalog_work_title_aliases x where x.work_id=w.id and position(lower(trim(p_query)) in lower(x.title))>0)
      or exists(select 1 from public.editions e where e.work_id=w.id and position(lower(trim(p_query)) in lower(e.title))>0))
    and (coalesce(p_selection,'')='' or exists(select 1 from public.catalog_selection_members m where m.work_id=w.id and m.selection_slug=p_selection))
    -- Existence is sufficient: hydration still uses the shared strict edition
    -- ranking. This is its eligibility predicate, not a second edition chooser.
    -- No off-page editions, covers or descriptions leave the database.
    and exists (
      select 1 from public.editions e
      cross join lateral (select lower(regexp_replace(regexp_replace(btrim(e.language,ws),'/+$',''),'^.*/','')) as lang) l
      where e.work_id=w.id and btrim(coalesce(e.title,''),ws)<>''
      and (l.lang in ('en','eng','english') or (p_locale='nl' and l.lang in ('nl','nld','dut','dutch')))
      and (coalesce(cardinality(p_languages),0)=0
        or ('en'=any(p_languages) and l.lang in ('en','eng','english'))
        or ('nl'=any(p_languages) and l.lang in ('nl','nld','dut','dutch')))
      -- Same title-only suspicious-form guard used by strict-edition.ts and
      -- the existing PR45 SQL projection. No script/ISBN-prefix inference.
      and e.title !~* '(^|[^A-Za-z0-9_])(audio\s*(?:book|books|cd|cassette)?|audiobook|bookcassette|books? on (?:tape|cassette)|cassette|cd-rom|mp3(?:-?cd)?|spoken word|unabridged|abridged|dramatized|recorded books|large[-\s]?print|box(?:ed)?[-\s]?set|omnibus|study guide|(?:book )?summary|adaptation|(?:movie|film)(?:\s*/\s*tv)?[-\s]?tie[-\s]?in)($|[^A-Za-z0-9_])'
    )
  ), filtered as materialized (
    select b.* from base b where coalesce(cardinality(p_categories),0)=0 or exists(
      select 1 from public.work_catalog_categories c where c.work_id=b.id and c.category_id=any(p_categories))
  ), summary_batches as (
    select array_agg(id) as ids from (
      select id,(row_number() over(order by id)-1)/100 as batch from filtered where p_sort='highest'
    ) numbered group by batch
  ), summaries as materialized (
    select s.* from summary_batches b cross join lateral public.get_work_rating_summaries(b.ids) s
  ), ranked as (
    select f.*,s.lumiscore from filtered f left join summaries s on s.work_id=f.id
  ), stats as (select count(*) as total from filtered), paging as (
    select total,greatest(1,ceil(total::numeric/p_page_size)::integer) as pages,
      least(greatest(1,coalesce(p_page,1)),greatest(1,ceil(total::numeric/p_page_size)::integer)) as page from stats
  ), results as (
    select f.id,row_number() over(order by
      case when p_sort='highest' then f.lumiscore end desc nulls last,
      case when p_sort='newest' then f.first_publish_year end desc nulls last,
      lower(f.title),f.id) as position
    from ranked f order by position limit p_page_size offset (select (page::bigint-1)*p_page_size from paging)
  ), facets as (
    select c.id,count(distinct b.id) as count from public.catalog_categories c
    left join public.work_catalog_categories wc on wc.category_id=c.id
    left join base b on b.id=wc.work_id group by c.id
  )
  select jsonb_build_object('contract','eligible-browse-v2','locale',p_locale,
    'workIds',coalesce((select jsonb_agg(id order by position) from results),'[]'::jsonb),
    'total',total,'page',page,'pageSize',p_page_size,'pageCount',pages,
    'selectionCount',(select count(*) from filtered f where exists(select 1 from public.catalog_selection_members m where m.work_id=f.id and m.selection_slug='lumiscore-selectie-1000')),
    'facets',coalesce((select jsonb_object_agg(id,count) from facets),'{}'::jsonb)) into result from paging;
  return result;
end;
$fn$;
revoke all on function public.catalog_browse_page_v2(text,text,text[],text,text[],text,integer,integer,bigint[],bigint) from public;
grant execute on function public.catalog_browse_page_v2(text,text,text[],text,text[],text,integer,integer,bigint[],bigint) to anon,authenticated;
comment on function public.catalog_browse_page_v2(text,text,text[],text,text[],text,integer,integer,bigint[],bigint) is
  'PR48 bounded eligible public pages. Locale/filter selection before count/order/page; existing public score aggregate; invoker RLS; no user data or writes.';
commit;
