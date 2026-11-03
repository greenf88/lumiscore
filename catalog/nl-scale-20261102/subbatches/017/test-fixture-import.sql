-- REVIEW ONLY. Exact target hlvujbrmfdlrfxdjwsmb. Isolated disposable test canary.
-- No accounts, ratings, progress, collections, taxonomy or taste-inventory DML.
-- COMMIT: securely retain FIRST non-empty full receipt, never substitute a replay receipt.
begin;set local lock_timeout='3s';set local statement_timeout='30s';
lock table public.authors,public.works,public.editions,public.catalog_work_descriptions,public.catalog_edition_metadata in share row exclusive mode;
create temporary table catalog_release_receipt(seq integer,relation text,key jsonb,before_row jsonb,after_row jsonb) on commit drop;
do $release$ declare payload jsonb:='{"batch":"nl-scale-20261102-017-fixture","project":"hlvujbrmfdlrfxdjwsmb","actions":[{"ref":"a1","relation":"authors","key":{"open_library_id":"OL29303A"},"before":null,"after":{"id":987316001,"name":"Dante Alighieri","open_library_id":"OL29303A"}},{"ref":"a2","relation":"authors","key":{"open_library_id":"OL2055261A"},"before":null,"after":{"id":987316002,"name":"Giovanni Boccaccio","open_library_id":"OL2055261A"}},{"ref":"a3","relation":"authors","key":{"open_library_id":"OL18283A"},"before":null,"after":{"id":987316003,"name":"Daniel Defoe","open_library_id":"OL18283A"}},{"ref":"w1","relation":"works","key":{"native_identity_key":"nlscale:fixture017:318"},"before":null,"after":{"id":987116001,"title":"The Divine Comedy","author_id":"@a1","first_publish_year":1472,"open_library_id":"OL93082W","cover_id":null,"source_type":"open_library","work_type":null,"native_identity_key":"nlscale:fixture017:318"}},{"ref":"w2","relation":"works","key":{"native_identity_key":"nlscale:fixture017:400"},"before":null,"after":{"id":987116002,"title":"Decamerone","author_id":"@a2","first_publish_year":1516,"open_library_id":"OL7180368W","cover_id":null,"source_type":"open_library","work_type":null,"native_identity_key":"nlscale:fixture017:400"}},{"ref":"w3","relation":"works","key":{"native_identity_key":"nlscale:fixture017:1408"},"before":null,"after":{"id":987116003,"title":"King Lear","author_id":987311001,"first_publish_year":1608,"open_library_id":"OL259026W","cover_id":null,"source_type":"open_library","work_type":null,"native_identity_key":"nlscale:fixture017:1408"}},{"ref":"w4","relation":"works","key":{"native_identity_key":"nlscale:fixture017:1507"},"before":null,"after":{"id":987116004,"title":"Moll Flanders","author_id":"@a3","first_publish_year":1722,"open_library_id":"OL45139W","cover_id":null,"source_type":"open_library","work_type":null,"native_identity_key":"nlscale:fixture017:1507"}},{"ref":"e1","relation":"editions","key":{"open_library_edition_id":"OL29959634M"},"before":null,"after":{"id":987216001,"work_id":"@w1","title":"Divine Comedy Illustrated","language":null,"open_library_edition_id":"OL29959634M","isbn_10":null,"isbn_13":"9781712076972","publisher":"Independently Published","publish_date":null,"cover_id":null}},{"ref":"e2","relation":"editions","key":{"open_library_edition_id":"OL34486489M"},"before":null,"after":{"id":987216002,"work_id":"@w2","title":"Décaméron","language":null,"open_library_edition_id":"OL34486489M","isbn_10":null,"isbn_13":"9781234915209","publisher":"General Books LLC","publish_date":null,"cover_id":null}},{"ref":"e3","relation":"editions","key":{"open_library_edition_id":"OL32276365M"},"before":null,"after":{"id":987216003,"work_id":"@w3","title":"King Lear","language":"eng","open_library_edition_id":"OL32276365M","isbn_10":"0342048961","isbn_13":"9780342048960","publisher":"Franklin Classics","publish_date":null,"cover_id":null}},{"ref":"e4","relation":"editions","key":{"open_library_edition_id":"OL61004144M"},"before":null,"after":{"id":987216004,"work_id":"@w3","title":"Koning Leare","language":"dut","open_library_edition_id":"OL61004144M","isbn_10":null,"isbn_13":null,"publisher":"J.C. Leeuwestyn","publish_date":null,"cover_id":null}},{"ref":"e5","relation":"editions","key":{"open_library_edition_id":"OL46351636M"},"before":null,"after":{"id":987216005,"work_id":"@w4","title":"Moll Flanders (Royal Collector''s Edition) (Case Laminate Hardcover with Jacket)","language":"eng","open_library_edition_id":"OL46351636M","isbn_10":null,"isbn_13":"9781774769294","publisher":"AD Classic","publish_date":null,"cover_id":null}}],"bindings":[{"work":{"id":987111003,"title":"The Tempest","cover_id":null,"author_id":987311001,"work_type":null,"source_type":"open_library","open_library_id":"OL362699W","first_publish_year":1611,"native_identity_key":"nlscale:fixture012:331"},"author":{"id":987311001,"name":"William Shakespeare","open_library_id":"OL9388A"}},{"work":{"id":987111005,"title":"The Merchant of Venice","cover_id":null,"author_id":987311001,"work_type":null,"source_type":"open_library","open_library_id":"OL258758W","first_publish_year":1600,"native_identity_key":"nlscale:fixture012:433"},"author":{"id":987311001,"name":"William Shakespeare","open_library_id":"OL9388A"}}],"authorCorpora":[{"author_id":987311001,"rows":[{"id":987111003,"title":"The Tempest","cover_id":null,"author_id":987311001,"work_type":null,"source_type":"open_library","open_library_id":"OL362699W","first_publish_year":1611,"native_identity_key":"nlscale:fixture012:331"},{"id":987111005,"title":"The Merchant of Venice","cover_id":null,"author_id":987311001,"work_type":null,"source_type":"open_library","open_library_id":"OL258758W","first_publish_year":1600,"native_identity_key":"nlscale:fixture012:433"}]}]}'::jsonb;a jsonb;b jsonb;actual jsonb;oldrow jsonb;nextrow jsonb;k jsonb;kv record;ids jsonb:='{}';cols text;vals text;predicate text;v_id bigint;i integer:=0;n integer;begin
 for b in select value from jsonb_array_elements(payload->'bindings') loop
  select to_jsonb(w) into actual from public.works w where id=(b->'work'->>'id')::bigint;
  if actual is distinct from b->'work' and not exists(select 1 from jsonb_array_elements(payload->'actions') p where p->>'relation'='works' and p->'key'=jsonb_build_object('id',(b->'work'->>'id')::bigint) and actual=p->'after') then raise exception 'Work preflight drift';end if;
  select to_jsonb(t) into actual from public.authors t where id=(b->'author'->>'id')::bigint;
  if actual is distinct from b->'author' then raise exception 'Author preflight drift';end if;
 end loop;
 for b in select value from jsonb_array_elements(payload->'authorCorpora') loop
  select coalesce(jsonb_agg(to_jsonb(w) order by id),'[]') into actual from public.works w where author_id=(b->>'author_id')::bigint and not exists(select 1 from jsonb_array_elements(payload->'actions') p where p->>'relation'='works' and p->'before'='null' and w.native_identity_key=p->'after'->>'native_identity_key');
  select coalesce(jsonb_agg(to_jsonb(jsonb_populate_record(null::public.works,value)) order by (value->>'id')::bigint),'[]') into oldrow from jsonb_array_elements(b->'rows');
  select coalesce(jsonb_agg(to_jsonb(jsonb_populate_record(null::public.works,coalesce((select p->'after' from jsonb_array_elements(payload->'actions') p where p->>'relation'='works' and p->'before'<>'null' and p->'key'=jsonb_build_object('id',(v.value->>'id')::bigint)),v.value))) order by (v.value->>'id')::bigint),'[]') into nextrow from jsonb_array_elements(b->'rows') v;
  if actual is distinct from oldrow and actual is distinct from nextrow then raise exception 'New Work author corpus drift; repeat identity review';end if;
 end loop;
 for a in select value from jsonb_array_elements(payload->'actions') loop
  i:=i+1;k:=a->'key';nextrow:=a->'after';oldrow:=a->'before';
  if a->>'relation' not in ('authors','works','editions','catalog_work_descriptions','catalog_edition_metadata') then raise exception 'Unreviewed relation';end if;
  for kv in select * from jsonb_each(nextrow) loop
   if jsonb_typeof(kv.value)='string' and left(kv.value#>>'{}',1)='@' then
    if not ids ? substring(kv.value#>>'{}',2) then raise exception 'Unresolved parent reference';end if;
    nextrow:=jsonb_set(nextrow,array[kv.key],ids->substring(kv.value#>>'{}',2));
   end if;
  end loop;
  for kv in select * from jsonb_each(k) loop
   if jsonb_typeof(kv.value)='string' and left(kv.value#>>'{}',1)='@' then k:=jsonb_set(k,array[kv.key],ids->substring(kv.value#>>'{}',2));end if;
  end loop;
  if exists(select 1 from jsonb_each(k) where value='null'::jsonb) then raise exception 'Unresolved/null identity key';end if;
  -- Typed equality uses the existing primary/natural-key index. Keep full-row
  -- JSON comparison below; only candidate lookup changes, not CAS protection.
  select string_agg(format('t.%I=(jsonb_populate_record(null::public.%I,$1)).%I',key,a->>'relation',key),' and ' order by key) into predicate from jsonb_each(k);
  execute format('select to_jsonb(t) from public.%I t where %s for update',a->>'relation',predicate) into actual using k;
  if oldrow<>'null'::jsonb then
   execute format('select to_jsonb(jsonb_populate_record(null::public.%I,$1))',a->>'relation') into oldrow using oldrow;
   execute format('select to_jsonb(jsonb_populate_record(null::public.%I,$1))',a->>'relation') into nextrow using nextrow;
   if actual is not distinct from nextrow then continue;end if;
   if actual is distinct from oldrow then raise exception 'Changed existing row in % at action %',a->>'relation',i;end if;
   select string_agg(format('%I=(jsonb_populate_record(null::public.%I,$1)).%I',key,a->>'relation',key),',') into cols from jsonb_each(nextrow) where value is distinct from oldrow->key;
   execute format('update public.%I t set %s where %s returning to_jsonb(t)',a->>'relation',cols,replace(predicate,'$1','$2')) into actual using nextrow,k;
   insert into catalog_release_receipt values(i,a->>'relation',k,oldrow,actual);
  elsif actual is not null then
   if a->>'relation' in ('catalog_work_descriptions','catalog_edition_metadata') then
    execute format('select to_jsonb(jsonb_populate_record(null::public.%I,$1))',a->>'relation') into nextrow using nextrow;
    if actual is distinct from nextrow then raise exception 'Existing reviewed presentation differs; never overwrite';end if;
   elsif not actual @> nextrow then raise exception 'Existing natural identity differs';end if;
  else
   if a->>'relation'='editions' and exists(select 1 from public.editions e where (nextrow->>'isbn_13' is not null and regexp_replace(coalesce(e.isbn_13,''),'[-[:space:]]','','g')=nextrow->>'isbn_13') or (nextrow->>'isbn_10' is not null and upper(regexp_replace(coalesce(e.isbn_10,''),'[-[:space:]]','','g'))=nextrow->>'isbn_10') or (nextrow->>'open_library_edition_id' is not null and e.open_library_edition_id=nextrow->>'open_library_edition_id')) then raise exception 'Global edition identity collision';end if;
   select string_agg(format('%I',key),',' order by key),string_agg(format('(jsonb_populate_record(null::public.%I,$1)).%I',a->>'relation',key),',' order by key) into cols,vals from jsonb_each(nextrow);
   execute format('insert into public.%I(%s) select %s returning to_jsonb(%I)',a->>'relation',cols,vals,a->>'relation') into actual using nextrow;
   insert into catalog_release_receipt values(i,a->>'relation',k,null,actual);
  end if;
  if actual ? 'id' then ids:=jsonb_set(ids,array[a->>'ref'],actual->'id');end if;
 end loop;
 select count(*) into n from catalog_release_receipt;
 if n not in (0,12) then raise exception 'Partial install/replay; expected zero or all actions, got %',n;end if;
end;$release$;
select jsonb_build_object('project','hlvujbrmfdlrfxdjwsmb','batch','nl-scale-20261102-017-fixture','rows',coalesce(jsonb_agg(to_jsonb(r) order by seq),'[]')) as receipt from catalog_release_receipt r;
commit;
