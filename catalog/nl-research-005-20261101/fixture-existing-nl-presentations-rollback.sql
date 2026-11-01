-- REVIEW ONLY. Receipt from FIRST successful COMMIT required; a dry-run receipt is forbidden.
-- Load the exact approved receipt via parameterized set_config('lumiscore.catalog_release_receipt',$1,false).
-- Only receipt rows; full-row CAS, parent locks, every incoming FK including CASCADE; later changes abort all.
begin;set local lock_timeout='3s';set local statement_timeout='30s';
lock table public.authors,public.works,public.editions,public.catalog_work_descriptions,public.catalog_edition_metadata in share row exclusive mode;
do $manifest_guard$ declare reviewed jsonb:='[{"relation":"catalog_edition_metadata","ref":"fixture-metadata:9789022574492","key":{"edition_id":610},"before":null,"after":{"edition_id":610,"work_id":8800307,"bound_author_id":8800014,"bound_title":"De reiziger","bound_language":"nld","bound_isbn13":"9789022574492","format":"paperback","cover_url":"https://metadata.isbn.nl/ie_fcache/0000521852_De_reiziger_0_0.jpg","card_cover_url":null,"evidence_url":"https://metadata.isbn.nl/162775/de-reiziger.html","review_status":"approved","reviewed_at":"2026-11-01T11:32:04.867Z","review_batch":"nl005-existing-fixture-covers-only-20261101","evidence":[{"url":"https://metadata.isbn.nl/162775/de-reiziger.html","sha256":"037c6adc1cfd42b779e0e3ba6773af6072e212a9af80b5c4454f696ce91e77bd","checkedAt":"2026-11-01","fact":"Exact printed ISBN-to-image block; artwork visually reviewed; existing test language/Work identity retained."},{"url":"https://metadata.isbn.nl/ie_fcache/0000521852_De_reiziger_0_0.jpg","sha256":"c338f1e90fc51cd65c33e4b28ea19f6776eaec4286ace1d4d3a9ddf4f5087650","bytes":544138,"checkedAt":"2026-11-01T11:32:04.867Z","fact":"Real image; title/author visual check, not HTTP alone."},{"url":"https://www.lannoo.com/nl-be/literatuur-romans/de-reiziger-9789022574492","checkedAt":"2026-11-01","facts":["Exact9789022574492,De reiziger,DianaGabaldon,Dutch,paperback,2015; explicitly corrects contradictory Bureau ENG field."],"role":"Independent publisher language/format/identity, lines316–336; no full source text copied."}]}},{"relation":"catalog_edition_metadata","ref":"fixture-metadata:9789056727659","key":{"edition_id":609},"before":null,"after":{"edition_id":609,"work_id":8800306,"bound_author_id":8800013,"bound_title":"Mannen die vrouwen haten","bound_language":"nld","bound_isbn13":"9789056727659","format":"paperback","cover_url":"https://metadata.isbn.nl/ie_fcache/0000499132_Mannen_die_vrouwen_haten_-_Millennium_1_0_0.jpg","card_cover_url":null,"evidence_url":"https://metadata.isbn.nl/1730692/mannen-die-vrouwen-haten-millennium-1.html","review_status":"approved","reviewed_at":"2026-11-01T11:32:06.666Z","review_batch":"nl005-existing-fixture-covers-only-20261101","evidence":[{"url":"https://metadata.isbn.nl/1730692/mannen-die-vrouwen-haten-millennium-1.html","sha256":"4e66bade1d7be8ffb9c3e3d146e63a1a1a3431161f0767449f8e8f5d21fe6d06","checkedAt":"2026-11-01","fact":"Exact printed ISBN-to-image block; artwork visually reviewed; existing test language/Work identity retained."},{"url":"https://metadata.isbn.nl/ie_fcache/0000499132_Mannen_die_vrouwen_haten_-_Millennium_1_0_0.jpg","sha256":"ab0e270bc7e8f7bc4ef25d41e694157090396585fa767a1e23adf250f9466a5a","bytes":75660,"checkedAt":"2026-11-01T11:32:06.666Z","fact":"Real image; title/author visual check, not HTTP alone."}]}}]'::jsonb;receipt jsonb;r jsonb;p jsonb;k jsonb;expected jsonb;prior jsonb;ids jsonb:='{}';kv record;i integer:=0;n integer;begin
 receipt:=nullif(current_setting('lumiscore.catalog_release_receipt',true),'')::jsonb;
 if receipt->>'project' is distinct from 'hlvujbrmfdlrfxdjwsmb' or receipt->>'batch' is distinct from 'nl005-existing-fixture-covers-only-20261101' or jsonb_typeof(receipt->'rows') is distinct from 'array' or jsonb_array_length(receipt->'rows')<>2 then raise exception 'Exact manifest receipt required';end if;
 for p in select value from jsonb_array_elements(reviewed) loop
  i:=i+1;select count(*) into n from jsonb_array_elements(receipt->'rows')x where x->>'seq'=i::text;
  if n<>1 then raise exception 'Receipt manifest sequence mismatch';end if;
  select x into r from jsonb_array_elements(receipt->'rows')x where x->>'seq'=i::text;
  if r->>'relation' is distinct from p->>'relation' then raise exception 'Receipt manifest relation mismatch';end if;
  k:=p->'key';expected:=p->'after';prior:=p->'before';
  for kv in select * from jsonb_each(expected) loop
   if jsonb_typeof(kv.value)='string' and left(kv.value#>>'{}',1)='@' then
    if not ids ? substring(kv.value#>>'{}',2) then raise exception 'Receipt manifest missing parent';end if;
    expected:=jsonb_set(expected,array[kv.key],ids->substring(kv.value#>>'{}',2));end if;
  end loop;
  for kv in select * from jsonb_each(k) loop
   if jsonb_typeof(kv.value)='string' and left(kv.value#>>'{}',1)='@' then k:=jsonb_set(k,array[kv.key],ids->substring(kv.value#>>'{}',2));end if;
  end loop;
  if prior<>'null'::jsonb then execute format('select to_jsonb(jsonb_populate_record(null::public.%I,$1))',p->>'relation') into prior using prior;end if;
  execute format('select coalesce(jsonb_object_agg(x.key,x.value),''{}''::jsonb) from jsonb_each(to_jsonb(jsonb_populate_record(null::public.%I,$1))) x where $1 ? x.key',p->>'relation') into expected using expected;
  if r->'key' is distinct from k or r->'before_row' is distinct from prior or jsonb_typeof(r->'after_row') is distinct from 'object' or not coalesce((r->'after_row')@>expected,false) then raise exception 'Receipt differs from exact reviewed manifest';end if;
  if r->'after_row' ? 'id' then ids:=jsonb_set(ids,array[p->>'ref'],r->'after_row'->'id');end if;
 end loop;
end;$manifest_guard$;
do $undo$ declare receipt jsonb;r jsonb;actual jsonb;dep record;n bigint;cols text;begin
 receipt:=nullif(current_setting('lumiscore.catalog_release_receipt',true),'')::jsonb;
 if receipt->>'project' is distinct from 'hlvujbrmfdlrfxdjwsmb' or receipt->>'batch' is distinct from 'nl005-existing-fixture-covers-only-20261101' or jsonb_typeof(receipt->'rows') is distinct from 'array' or jsonb_array_length(receipt->'rows')<>2 then raise exception 'Exact first committed receipt required';end if;
 for r in select value from jsonb_array_elements(receipt->'rows') order by (value->>'seq')::integer desc loop
  if r->>'relation' not in ('authors','works','editions','catalog_work_descriptions','catalog_edition_metadata') then raise exception 'Unreviewed receipt relation';end if;
  execute format('select to_jsonb(t) from public.%I t where to_jsonb(t) @> $1 for update',r->>'relation') into actual using r->'key';
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
   execute format('delete from public.%I t where to_jsonb(t) @> $1',r->>'relation') using r->'key';
  else
   select string_agg(format('%I=(jsonb_populate_record(null::public.%I,$1)).%I',key,r->>'relation',key),',') into cols from jsonb_each(r->'before_row') where value is distinct from r->'after_row'->key;
   execute format('update public.%I t set %s where to_jsonb(t) @> $2',r->>'relation',cols) using r->'before_row',r->'key';
  end if;
 end loop;
end;$undo$;commit;
