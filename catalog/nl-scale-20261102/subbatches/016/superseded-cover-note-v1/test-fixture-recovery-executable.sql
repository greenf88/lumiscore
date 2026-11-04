select set_config('lumiscore.catalog_release_receipt','{"rows":[{"key":{"open_library_id":"OL24522A"},"seq":1,"relation":"authors","after_row":{"id":987315001,"name":"Jonathan Swift","open_library_id":"OL24522A"},"before_row":null},{"key":{"open_library_id":"OL170469A"},"seq":2,"relation":"authors","after_row":{"id":987315002,"name":"Thomas Malory","open_library_id":"OL170469A"},"before_row":null},{"key":{"native_identity_key":"nlscale:fixture016:1395"},"seq":3,"relation":"works","after_row":{"id":987115001,"title":"Gulliver''s Travels","cover_id":null,"author_id":987315001,"work_type":null,"source_type":"open_library","open_library_id":"OL20600W","first_publish_year":1726,"native_identity_key":"nlscale:fixture016:1395"},"before_row":null},{"key":{"native_identity_key":"nlscale:fixture016:1474"},"seq":4,"relation":"works","after_row":{"id":987115002,"title":"Le Morte d''Arthur","cover_id":null,"author_id":987315002,"work_type":null,"source_type":"open_library","open_library_id":"OL15450151W","first_publish_year":1557,"native_identity_key":"nlscale:fixture016:1474"},"before_row":null},{"key":{"open_library_edition_id":"OL24354314M"},"seq":5,"relation":"editions","after_row":{"id":987215001,"title":"Gullivers reizen","isbn_10":"9027491259","isbn_13":null,"work_id":987115001,"cover_id":null,"language":"dut","publisher":"Het Spectrum","publish_date":null,"open_library_edition_id":"OL24354314M"},"before_row":null},{"key":{"open_library_edition_id":"OL7862297M"},"seq":6,"relation":"editions","after_row":{"id":987215002,"title":"Gulliver''s Travels","isbn_10":"0721417523","isbn_13":"9780721417523","work_id":987115001,"cover_id":null,"language":"eng","publisher":"Penguin USA","publish_date":null,"open_library_edition_id":"OL7862297M"},"before_row":null},{"key":{"open_library_edition_id":"OL24354315M"},"seq":7,"relation":"editions","after_row":{"id":987215003,"title":"De morte d''Arthur","isbn_10":"902749150X","isbn_13":null,"work_id":987115002,"cover_id":null,"language":"dut","publisher":"Het Spectrum","publish_date":null,"open_library_edition_id":"OL24354315M"},"before_row":null},{"key":{"open_library_edition_id":"OL7699589M"},"seq":8,"relation":"editions","after_row":{"id":987215004,"title":"Le Morte d''Arthur","isbn_10":"067960099X","isbn_13":"9780679600992","work_id":987115002,"cover_id":null,"language":"eng","publisher":"Modern Library","publish_date":null,"open_library_edition_id":"OL7699589M"},"before_row":null}],"batch":"nl-scale-20261102-016-fixture","project":"hlvujbrmfdlrfxdjwsmb"}',false);
-- REVIEW ONLY. Receipt from FIRST successful COMMIT required; a dry-run receipt is forbidden.
-- Load the exact approved receipt via parameterized set_config('lumiscore.catalog_release_receipt',$1,false).
-- Only receipt rows; full-row CAS, parent locks, every incoming FK including CASCADE; later changes abort all.
begin;set local lock_timeout='3s';set local statement_timeout='30s';
lock table public.authors,public.works,public.editions,public.catalog_work_descriptions,public.catalog_edition_metadata in share row exclusive mode;
do $undo$ declare receipt jsonb;r jsonb;actual jsonb;dep record;n bigint;cols text;k jsonb;predicate text;allowed_keys text[];begin
 receipt:=nullif(current_setting('lumiscore.catalog_release_receipt',true),'')::jsonb;
 if receipt->>'project' is distinct from 'hlvujbrmfdlrfxdjwsmb' or receipt->>'batch' is distinct from 'nl-scale-20261102-016-fixture' or jsonb_typeof(receipt->'rows') is distinct from 'array' or jsonb_array_length(receipt->'rows')<>8 then raise exception 'Exact first committed receipt required';end if;
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
