-- REVIEW ONLY. Receipt from FIRST successful COMMIT required; a dry-run receipt is forbidden.
-- Load the exact approved receipt via parameterized set_config('lumiscore.catalog_release_receipt',$1,false).
-- Only receipt rows; full-row CAS, parent locks, every incoming FK including CASCADE; later changes abort all.
begin;set local lock_timeout='3s';set local statement_timeout='30s';
lock table public.authors,public.works,public.editions,public.catalog_work_descriptions,public.catalog_edition_metadata in share row exclusive mode;
select set_config('lumiscore.catalog_release_receipt','{"rows":[{"key":{"edition_id":612},"seq":1,"relation":"catalog_edition_metadata","after_row":{"format":"paperback","work_id":8800308,"evidence":[{"url":"https://metadata.isbn.nl/1505865/het-oog-van-de-wereld.html","fact":"Exact existing test ISBN9789024595495, Paperback29June2021, explicit taalNederlands, RobertJordan and WorkOL7924103W; source file collection-title-135.json","checkedAt":"2026-10-31"},{"url":"https://metadata.isbn.nl/ie_fcache/0000401707_Het_oog_van_de_wereld_0_0.jpg","fact":"Decoded image visually reviewed: RobertJordan, Het oog van de wereld, Het Rad des Tijds boek1, matching exact-edition source asset","http":200,"bytes":254316,"sha256":"ccee558d21961c14397049acf55cfd35477d322738e1be7c0547816c0c9be9ae","checkedAt":"2026-10-31T22:33:00Z"}],"cover_url":"https://metadata.isbn.nl/ie_fcache/0000401707_Het_oog_van_de_wereld_0_0.jpg","edition_id":612,"bound_title":"Het oog van de wereld","reviewed_at":"2026-10-31T22:33:00+00:00","bound_isbn13":"9789024595495","evidence_url":"https://metadata.isbn.nl/1505865/het-oog-van-de-wereld.html","review_batch":"pr64-test-existing-eye-cover","review_status":"approved","bound_language":"nld","card_cover_url":null,"bound_author_id":8800015},"before_row":null}],"batch":"pr64-test-existing-eye-cover","project":"hlvujbrmfdlrfxdjwsmb"}',true);
do $manifest_guard$ declare reviewed jsonb:='[{"relation":"catalog_edition_metadata","ref":"test-only-existing-edition:612","key":{"edition_id":612},"before":null,"after":{"edition_id":612,"work_id":8800308,"bound_author_id":8800015,"bound_title":"Het oog van de wereld","bound_language":"nld","bound_isbn13":"9789024595495","format":"paperback","cover_url":"https://metadata.isbn.nl/ie_fcache/0000401707_Het_oog_van_de_wereld_0_0.jpg","card_cover_url":null,"evidence_url":"https://metadata.isbn.nl/1505865/het-oog-van-de-wereld.html","evidence":[{"url":"https://metadata.isbn.nl/1505865/het-oog-van-de-wereld.html","checkedAt":"2026-10-31","fact":"Exact existing test ISBN9789024595495, Paperback29June2021, explicit taalNederlands, RobertJordan and WorkOL7924103W; source file collection-title-135.json"},{"url":"https://metadata.isbn.nl/ie_fcache/0000401707_Het_oog_van_de_wereld_0_0.jpg","checkedAt":"2026-10-31T22:33:00Z","http":200,"bytes":254316,"sha256":"ccee558d21961c14397049acf55cfd35477d322738e1be7c0547816c0c9be9ae","fact":"Decoded image visually reviewed: RobertJordan, Het oog van de wereld, Het Rad des Tijds boek1, matching exact-edition source asset"}],"review_status":"approved","reviewed_at":"2026-10-31T22:33:00Z","review_batch":"pr64-test-existing-eye-cover"}}]'::jsonb;receipt jsonb;r jsonb;p jsonb;k jsonb;expected jsonb;prior jsonb;ids jsonb:='{}';kv record;i integer:=0;n integer;begin
 receipt:=nullif(current_setting('lumiscore.catalog_release_receipt',true),'')::jsonb;
 if receipt->>'project' is distinct from 'hlvujbrmfdlrfxdjwsmb' or receipt->>'batch' is distinct from 'pr64-test-existing-eye-cover' or jsonb_typeof(receipt->'rows') is distinct from 'array' or jsonb_array_length(receipt->'rows')<>1 then raise exception 'Exact manifest receipt required';end if;
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
 if receipt->>'project' is distinct from 'hlvujbrmfdlrfxdjwsmb' or receipt->>'batch' is distinct from 'pr64-test-existing-eye-cover' or jsonb_typeof(receipt->'rows') is distinct from 'array' or jsonb_array_length(receipt->'rows')<>1 then raise exception 'Exact first committed receipt required';end if;
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
