-- REVIEWED TEST INSTALLATION ONLY hlvujbrmfdlrfxdjwsmb. Production needs separate release approval.
-- Additive versioned read-only functions: existing application/RPCs remain compatible.
begin;set local lock_timeout='3s';set local statement_timeout='30s';

-- catalog_browse_page_v3: SECURITY INVOKER, STABLE, empty search_path, public bibliography only.
do $catalog_guard$ declare p record;begin
 select * into p from pg_proc where oid=to_regprocedure('public.catalog_browse_page_v3(text, text, text[], text, text[], text, integer, integer, bigint[], bigint)');
 if found then
  if md5(p.prosrc) not in ('8a018863e8f71c70d6136396844610db','8a018863e8f71c70d6136396844610db') or p.prosecdef then raise exception 'Unexpected existing catalog function; snapshot/review required: catalog_browse_page_v3';end if;
  if exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee<>p.proowner and a.grantee not in ('anon'::regrole,'authenticated'::regrole)) then raise exception 'Unexpected existing function grants; stop before replacement';end if;
 end if;
end;$catalog_guard$;
CREATE OR REPLACE FUNCTION public.catalog_browse_page_v3(p_locale text, p_query text DEFAULT ''::text, p_categories text[] DEFAULT '{}'::text[], p_selection text DEFAULT ''::text, p_languages text[] DEFAULT '{}'::text[], p_sort text DEFAULT 'highest'::text, p_page integer DEFAULT 1, p_page_size integer DEFAULT 16, p_alias_ids bigint[] DEFAULT '{}'::bigint[], p_author_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
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
      cross join lateral (select lower(case when btrim(e.language,ws) ~* '^/?languages/[a-z-]+/?$' then regexp_replace(regexp_replace(btrim(e.language,ws),'^/?languages/','','i'),'/$','') else replace(btrim(e.language,ws),'_','-') end) as lang) l
      where e.work_id=w.id and btrim(coalesce(e.title,''),ws)<>''
      and ((p_locale='en' and l.lang in ('en','eng','english','en-us','en-gb')) or (p_locale='nl' and l.lang in ('nl','nld','dut','dutch','nederlands','nl-nl','nl-be')))
      and (coalesce(cardinality(p_languages),0)=0
        or ('en'=any(p_languages) and l.lang in ('en','eng','english','en-us','en-gb'))
        or ('nl'=any(p_languages) and l.lang in ('nl','nld','dut','dutch','nederlands','nl-nl','nl-be')))
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
  select jsonb_build_object('contract','eligible-browse-v3','locale',p_locale,
    'workIds',coalesce((select jsonb_agg(id order by position) from results),'[]'::jsonb),
    'total',total,'page',page,'pageSize',p_page_size,'pageCount',pages,
    'selectionCount',(select count(*) from filtered f where exists(select 1 from public.catalog_selection_members m where m.work_id=f.id and m.selection_slug='lumiscore-selectie-1000')),
    'facets',coalesce((select jsonb_object_agg(id,count) from facets),'{}'::jsonb)) into result from paging;
  return result;
end;
$function$;
-- Remove ALL inherited/default direct grants, including unforeseen custom roles.
do $catalog_acl$ declare a record;begin
 for a in select x.grantee,r.rolname from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x left join pg_roles r on r.oid=x.grantee
  where p.oid='public.catalog_browse_page_v3(text, text, text[], text, text[], text, integer, integer, bigint[], bigint)'::regprocedure and x.grantee<>p.proowner loop
  if a.grantee=0 then execute 'revoke all on function public.catalog_browse_page_v3(text, text, text[], text, text[], text, integer, integer, bigint[], bigint) from public';
  else execute format('revoke all on function public.catalog_browse_page_v3(text, text, text[], text, text[], text, integer, integer, bigint[], bigint) from %I',a.rolname);end if;
 end loop;
end;$catalog_acl$;
grant execute on function public.catalog_browse_page_v3(text, text, text[], text, text[], text, integer, integer, bigint[], bigint) to anon,authenticated;

-- catalog_search_selection_v2: SECURITY INVOKER, STABLE, empty search_path, public bibliography only.
do $catalog_guard$ declare p record;begin
 select * into p from pg_proc where oid=to_regprocedure('public.catalog_search_selection_v2(text, text, text[], text, text[], text, bigint[], bigint)');
 if found then
  if md5(p.prosrc) not in ('22d828c503e8b36cdd86a16602e594e4','bba7c870a0add8ad9fe5cd2491adb47b') or p.prosecdef then raise exception 'Unexpected existing catalog function; snapshot/review required: catalog_search_selection_v2';end if;
  if exists(select 1 from aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a where a.grantee<>p.proowner and a.grantee not in ('anon'::regrole,'authenticated'::regrole)) then raise exception 'Unexpected existing function grants; stop before replacement';end if;
 end if;
end;$catalog_guard$;
CREATE OR REPLACE FUNCTION public.catalog_search_selection_v2(p_query text, p_locale text, p_categories text[] DEFAULT '{}'::text[], p_selection text DEFAULT ''::text, p_languages text[] DEFAULT '{}'::text[], p_sort text DEFAULT 'az'::text, p_alias_ids bigint[] DEFAULT '{}'::bigint[], p_author_id bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare
  ids bigint[]; n integer;
  result jsonb;
  -- ECMAScript String.trim whitespace, not just ASCII spaces.
  ws constant text := U&'\0009\000A\000B\000C\000D\0020\00A0\1680\2000\2001\2002\2003\2004\2005\2006\2007\2008\2009\200A\2028\2029\202F\205F\3000\FEFF';
begin
  if p_locale not in ('nl','en') or p_locale is null
     or p_sort not in ('az','newest','highest') or p_sort is null
     or length(trim(coalesce(p_query,'')))<2 or length(p_query)>100
     or coalesce(cardinality(p_categories),0)>32
     or coalesce(cardinality(p_languages),0)>2
     or coalesce(cardinality(p_alias_ids),0)>100 then
    raise exception using errcode='22023',message='Invalid public search selection';
  end if;
  -- Identical to catalog_discovery_page's membership; no repeated128-ID pages,
  -- facet scans or aggregate recomputation for off-page windows.
  with matches as materialized (
    select w.id,w.title,w.first_publish_year from public.works w
    left join public.authors a on a.id=w.author_id
    where (p_author_id is null or w.author_id=p_author_id)
    and (position(lower(trim(p_query)) in lower(w.title))>0
      or position(lower(trim(p_query)) in lower(a.name))>0
      or w.id=any(coalesce(p_alias_ids,'{}'))
      or exists(select 1 from public.catalog_work_title_aliases x where x.work_id=w.id and position(lower(trim(p_query)) in lower(x.title))>0)
      or exists(select 1 from public.editions e where e.work_id=w.id and position(lower(trim(p_query)) in lower(e.title))>0))
    and (coalesce(p_selection,'')='' or exists(select 1 from public.catalog_selection_members m where m.work_id=w.id and m.selection_slug=p_selection))
    and (coalesce(cardinality(p_languages),0)=0 or p_locale=any(p_languages))
    and (coalesce(cardinality(p_categories),0)=0 or exists(select 1 from public.work_catalog_categories c where c.work_id=w.id and c.category_id=any(p_categories)))
    limit 10001
  ), summary_batches as (
    select array_agg(id) as ids from (select id,(row_number() over(order by id)-1)/100 as batch from matches where p_sort='highest') numbered group by batch
  ), summaries as materialized (
    select s.* from summary_batches b cross join lateral public.get_work_rating_summaries(b.ids) s
  )
  select coalesce(array_agg(m.id order by case when p_sort='highest' then s.lumiscore end desc nulls last,
    case when p_sort='newest' then m.first_publish_year end desc nulls last,lower(m.title),m.id),'{}')
  into ids from matches m left join summaries s on s.work_id=m.id;
  n:=cardinality(ids);
  if n>10000 then raise exception using errcode='22023',message='Narrow the public search selection'; end if;
  with base as materialized (
    select w.id,w.title,coalesce(nullif(btrim(a.name,ws),''),'Unknown author') as author,x.position
    from unnest(ids) with ordinality x(id,position)
    join public.works w on w.id=x.id left join public.authors a on a.id=w.author_id
    where btrim(w.title,ws)<>''
  ), all_editions as materialized (
    select e.id,e.work_id,e.title,e.language,e.isbn_13,e.open_library_edition_id,
      lower(case when btrim(e.language,ws) ~* '^/?languages/[a-z-]+/?$' then regexp_replace(regexp_replace(btrim(e.language,ws),'^/?languages/','','i'),'/$','') else replace(btrim(e.language,ws),'_','-') end) as lang,
      case when upper(regexp_replace(regexp_replace(btrim(e.open_library_edition_id,ws),'/+$',''),'^.*/','')) ~ '^OL[0-9]+M$'
        then upper(regexp_replace(regexp_replace(btrim(e.open_library_edition_id,ws),'/+$',''),'^.*/','')) end as normalized_olid,
      translate(e.isbn_13,ws||'-','') ~ '^[0-9]{13}$' as has_isbn,
      -- Same NFKD/combining-mark/letter-number normalization as edition-ranking.ts.
      lower(btrim(regexp_replace(regexp_replace(normalize(coalesce(e.title,''),NFKD),U&'[\0300-\036F]','','g'),'[^[:alnum:]]+',' ','g'))) as normalized_title,
      lower(btrim(regexp_replace(regexp_replace(normalize(b.title,NFKD),U&'[\0300-\036F]','','g'),'[^[:alnum:]]+',' ','g'))) as normalized_work
    from public.editions e join base b on b.id=e.work_id
  ), permitted as (
    select e.*,case when lang in ('nl','nld','dut','dutch','nederlands','nl-nl','nl-be') then 'nl' else 'en' end as locale
    from all_editions e where btrim(coalesce(e.title,''),ws)<>'' and
      ((p_locale='en' and lang in ('en','eng','english','en-us','en-gb')) or (p_locale='nl' and lang in ('nl','nld','dut','dutch','nederlands','nl-nl','nl-be')))
      -- Strict selection excludes suspicious forms by TITLE, as the existing JS
      -- row shape has no physicalFormat/publishers aliases. Do not invent new rules.
      and e.title !~* '(^|[^A-Za-z0-9_])(audio\s*(?:book|books|cd|cassette)?|audiobook|bookcassette|books? on (?:tape|cassette)|cassette|cd-rom|mp3(?:-?cd)?|spoken word|unabridged|abridged|dramatized|recorded books|large[-\s]?print|box(?:ed)?[-\s]?set|omnibus|study guide|(?:book )?summary|adaptation|(?:movie|film)(?:\s*/\s*tv)?[-\s]?tie[-\s]?in)($|[^A-Za-z0-9_])'
  ), scored as (
    select e.*,
      (case when e.title ~* '(^|[^A-Za-z0-9_])(hardcover|hardback|cloth|library binding)($|[^A-Za-z0-9_])' then 1000
        when e.title ~* '(^|[^A-Za-z0-9_])(paperback|softcover|trade paper|mass market|perfect paperback)($|[^A-Za-z0-9_])' then 800
        when e.title ~* '(^|[^A-Za-z0-9_])(ebook|e-book|kindle|epub|digital edition)($|[^A-Za-z0-9_])' then 600 else 500 end)
      +case when e.locale=p_locale then 600 else -400 end
      +case when normalized_title='' or normalized_work='' then 0
        when normalized_title=normalized_work then 80
        when starts_with(normalized_title,normalized_work||' ') then 35 else 0 end
      +case when e.title ~* '(^|[^A-Za-z0-9_])(tandem library|rebound by sagebrush|perfection learning|school (?:and|&) library binding|library binding)($|[^A-Za-z0-9_])' then -150 else 0 end
      +case when has_isbn then 150 else 0 end as rank,
      coalesce(substring(coalesce(normalized_olid,e.id::text) from '[0-9]+'),'') as digits
    from permitted e
  ), ranked as (
    select e.*,row_number() over(partition by work_id order by
      case when locale=p_locale then 0 else 1 end,rank desc,
      (case when digits='' then coalesce(normalized_olid,id::text)
        when length((digits::numeric)::text)<12 then lpad((digits::numeric)::text,12,'0') else (digits::numeric)::text end)||chr(1)||normalized_title,id
    ) as choice from scored e
  ), aliases as (
    select work_id,jsonb_agg(title order by id) filter(where title is not null) as titles from all_editions group by work_id
  )
  select jsonb_build_object('contract','strict-spine-v2','candidates',coalesce(jsonb_agg(jsonb_build_object(
    'workId',b.id::text,'editionId',e.id::text,'title',btrim(e.title,ws),'author',b.author,
    'aliases',coalesce(a.titles,'[]'::jsonb)||jsonb_build_array(b.title)
  ) order by b.position),'[]'::jsonb)) into result
  from base b join ranked e on e.work_id=b.id and e.choice=1 left join aliases a on a.work_id=b.id;
  return result;
end;
$function$;
-- Remove ALL inherited/default direct grants, including unforeseen custom roles.
do $catalog_acl$ declare a record;begin
 for a in select x.grantee,r.rolname from pg_proc p cross join lateral aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) x left join pg_roles r on r.oid=x.grantee
  where p.oid='public.catalog_search_selection_v2(text, text, text[], text, text[], text, bigint[], bigint)'::regprocedure and x.grantee<>p.proowner loop
  if a.grantee=0 then execute 'revoke all on function public.catalog_search_selection_v2(text, text, text[], text, text[], text, bigint[], bigint) from public';
  else execute format('revoke all on function public.catalog_search_selection_v2(text, text, text[], text, text[], text, bigint[], bigint) from %I',a.rolname);end if;
 end loop;
end;$catalog_acl$;
grant execute on function public.catalog_search_selection_v2(text, text, text[], text, text[], text, bigint[], bigint) to anon,authenticated;
commit;
