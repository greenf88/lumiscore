-- REVIEW ONLY. Receipt from FIRST successful COMMIT required; a dry-run receipt is forbidden.
-- Load the exact approved receipt via parameterized set_config('lumiscore.catalog_release_receipt',$1,false).
-- Only receipt rows; full-row CAS, parent locks, every incoming FK including CASCADE; later changes abort all.
begin;set local lock_timeout='3s';set local statement_timeout='30s';
lock table public.authors,public.works,public.editions,public.catalog_work_descriptions,public.catalog_edition_metadata in share row exclusive mode;
do $receipt_scope$ declare receipt jsonb; r jsonb; a jsonb; expected jsonb; begin
  receipt:=nullif(current_setting('lumiscore.catalog_release_receipt',true),'')::jsonb;
  if receipt->>'project' is distinct from 'hlvujbrmfdlrfxdjwsmb' or receipt->>'batch' is distinct from 'soft404-9733-4873-20261110-fixture'
    or jsonb_array_length(receipt->'rows') is distinct from 6 then raise exception 'Exact first committed receipt required'; end if;
  for r in select value from jsonb_array_elements(receipt->'rows') loop
    a:=('[{"relation":"authors","ref":"author-4873","key":{"id":995020001},"before":null,"after":{"id":995020001,"name":"Eric Evans","open_library_id":"OL5205508A"}},{"relation":"works","ref":"work-4873","key":{"id":995020101},"before":null,"after":{"id":995020101,"title":"Domain-Driven Design","cover_id":null,"author_id":995020001,"work_type":null,"source_type":null,"open_library_id":"OL4464385W","first_publish_year":2003,"native_identity_key":null}},{"relation":"editions","ref":"edition-4873","key":{"id":995020201},"before":null,"after":{"id":995020201,"title":"Domain-driven design","isbn_10":"0321125215","isbn_13":"9780321125217","work_id":995020101,"language":"eng","publisher":"Addison-Wesley","open_library_edition_id":"OL17094759M","publish_date":null,"cover_id":null}},{"relation":"authors","ref":"author-9733","key":{"id":995020002},"before":null,"after":{"id":995020002,"name":"Yvonne Whittal","open_library_id":"OL808883A"}},{"relation":"works","ref":"work-9733","key":{"id":995020102},"before":null,"after":{"id":995020102,"title":"Dark heritage","cover_id":null,"author_id":995020002,"work_type":null,"source_type":null,"open_library_id":"OL4225431W","first_publish_year":1983,"native_identity_key":null}},{"relation":"editions","ref":"edition-9733","key":{"id":995020202},"before":null,"after":{"id":995020202,"title":"Dark Heritage","isbn_10":"0373106300","isbn_13":"9780373106301","work_id":995020102,"language":"eng","publisher":"harlequin","open_library_edition_id":"OL10738237M","publish_date":null,"cover_id":null}}]'::jsonb)->((r->>'seq')::integer-1);
    if a is null or r->>'relation' is distinct from a->>'relation' or r->'key' is distinct from a->'key'
      or r->'before_row' is distinct from a->'before' then raise exception 'Receipt outside exact reviewed scope'; end if;
    execute format('select to_jsonb(jsonb_populate_record(null::public.%I,$1))',a->>'relation') into expected using a->'after';
    if r->'after_row' is distinct from expected then raise exception 'Receipt content differs from proposal'; end if;
  end loop;
  if (select count(distinct value->>'seq') from jsonb_array_elements(receipt->'rows'))<> 6
    then raise exception 'Duplicate receipt sequence'; end if;
end;$receipt_scope$;
do $undo$ declare receipt jsonb;r jsonb;actual jsonb;dep record;n bigint;cols text;k jsonb;predicate text;allowed_keys text[];begin
 receipt:=nullif(current_setting('lumiscore.catalog_release_receipt',true),'')::jsonb;
 if receipt->>'project' is distinct from 'hlvujbrmfdlrfxdjwsmb' or receipt->>'batch' is distinct from 'soft404-9733-4873-20261110-fixture' or jsonb_typeof(receipt->'rows') is distinct from 'array' or jsonb_array_length(receipt->'rows')<>6 then raise exception 'Exact first committed receipt required';end if;
 for r in select value from jsonb_array_elements(receipt->'rows') order by (value->>'seq')::integer desc loop
  if r->>'relation' not in ('authors','works','editions','catalog_work_descriptions','catalog_edition_metadata') then raise exception 'Unreviewed receipt relation';end if;
  k:=r->'key';allowed_keys:=case r->>'relation' when 'authors' then array['id','open_library_id'] when 'works' then array['id','native_identity_key','open_library_id'] when 'editions' then array['id','open_library_edition_id','isbn_13','isbn_10'] when 'catalog_work_descriptions' then array['work_id','language'] else array['edition_id'] end;
  if jsonb_typeof(k)<>'object' or not exists(select 1 from jsonb_each(k)) or exists(select 1 from jsonb_each(k) where not key=any(allowed_keys) or value='null'::jsonb) then raise exception 'Invalid receipt identity key';end if;
  select string_agg(format('t.%I=(jsonb_populate_record(null::public.%I,$1)).%I',key,r->>'relation',key),' and ' order by key) into predicate from jsonb_each(k);
  execute format('select to_jsonb(t) from public.%I t where %s for update',r->>'relation',predicate) into actual using k;
  if actual is null and r->'before_row'='null'::jsonb then continue;end if;
  if actual is not distinct from r->'before_row' then continue;end if;
  if actual is distinct from r->'after_row' then raise exception 'Later legitimate change; recovery refused';end if;
  if r->'before_row'='null'::jsonb then
   for dep in select ns.nspname,c.relname,string_agg(format('(to_jsonb(child)->%L)=($1->%L)',ca.attname,pa.attname),' and ' order by k.ord) predicate
    from pg_constraint f join pg_class c on c.oid=f.conrelid join pg_namespace ns on ns.oid=c.relnamespace
    cross join lateral unnest(f.conkey,f.confkey) with ordinality k(childkey,parentkey,ord)
    join pg_attribute ca on ca.attrelid=f.conrelid and ca.attnum=k.childkey join pg_attribute pa on pa.attrelid=f.confrelid and pa.attnum=k.parentkey
    where f.contype='f' and f.confrelid=to_regclass('public.'||(r->>'relation')) group by f.oid,ns.nspname,c.relname
   loop
    execute format('select count(*) from %I.%I child where %s',dep.nspname,dep.relname,dep.predicate) into n using r->'after_row';
    if n>0 then raise exception 'Later dependency in %.%; recovery refused',dep.nspname,dep.relname;end if;
   end loop;
   execute format('delete from public.%I t where %s',r->>'relation',predicate) using k;
  else
   select string_agg(format('%I=(jsonb_populate_record(null::public.%I,$1)).%I',key,r->>'relation',key),',') into cols from jsonb_each(r->'before_row') where value is distinct from r->'after_row'->key;
   execute format('update public.%I t set %s where %s',r->>'relation',cols,replace(predicate,'$1','$2')) using r->'before_row',k;
  end if;
 end loop;
end;$undo$;commit;
