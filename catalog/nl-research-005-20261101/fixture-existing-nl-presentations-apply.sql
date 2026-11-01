-- REVIEW ONLY. Exact target hlvujbrmfdlrfxdjwsmb. Isolated disposable test canary.
-- No accounts, ratings, progress, collections, taxonomy or taste-inventory DML.
-- COMMIT: securely retain FIRST non-empty full receipt, never substitute a replay receipt.
begin;set local lock_timeout='3s';set local statement_timeout='30s';
lock table public.authors,public.works,public.editions,public.catalog_work_descriptions,public.catalog_edition_metadata in share row exclusive mode;
create temporary table catalog_release_receipt(seq integer,relation text,key jsonb,before_row jsonb,after_row jsonb) on commit drop;
do $release$ declare payload jsonb:='{"batch":"nl005-existing-fixture-covers-only-20261101","project":"hlvujbrmfdlrfxdjwsmb","actions":[{"relation":"catalog_edition_metadata","ref":"fixture-metadata:9789022574492","key":{"edition_id":610},"before":null,"after":{"edition_id":610,"work_id":8800307,"bound_author_id":8800014,"bound_title":"De reiziger","bound_language":"nld","bound_isbn13":"9789022574492","format":"paperback","cover_url":"https://metadata.isbn.nl/ie_fcache/0000521852_De_reiziger_0_0.jpg","card_cover_url":null,"evidence_url":"https://metadata.isbn.nl/162775/de-reiziger.html","review_status":"approved","reviewed_at":"2026-11-01T11:32:04.867Z","review_batch":"nl005-existing-fixture-covers-only-20261101","evidence":[{"url":"https://metadata.isbn.nl/162775/de-reiziger.html","sha256":"037c6adc1cfd42b779e0e3ba6773af6072e212a9af80b5c4454f696ce91e77bd","checkedAt":"2026-11-01","fact":"Exact printed ISBN-to-image block; artwork visually reviewed; existing test language/Work identity retained."},{"url":"https://metadata.isbn.nl/ie_fcache/0000521852_De_reiziger_0_0.jpg","sha256":"c338f1e90fc51cd65c33e4b28ea19f6776eaec4286ace1d4d3a9ddf4f5087650","bytes":544138,"checkedAt":"2026-11-01T11:32:04.867Z","fact":"Real image; title/author visual check, not HTTP alone."},{"url":"https://www.lannoo.com/nl-be/literatuur-romans/de-reiziger-9789022574492","checkedAt":"2026-11-01","facts":["Exact9789022574492,De reiziger,DianaGabaldon,Dutch,paperback,2015; explicitly corrects contradictory Bureau ENG field."],"role":"Independent publisher language/format/identity, lines316–336; no full source text copied."}]}},{"relation":"catalog_edition_metadata","ref":"fixture-metadata:9789056727659","key":{"edition_id":609},"before":null,"after":{"edition_id":609,"work_id":8800306,"bound_author_id":8800013,"bound_title":"Mannen die vrouwen haten","bound_language":"nld","bound_isbn13":"9789056727659","format":"paperback","cover_url":"https://metadata.isbn.nl/ie_fcache/0000499132_Mannen_die_vrouwen_haten_-_Millennium_1_0_0.jpg","card_cover_url":null,"evidence_url":"https://metadata.isbn.nl/1730692/mannen-die-vrouwen-haten-millennium-1.html","review_status":"approved","reviewed_at":"2026-11-01T11:32:06.666Z","review_batch":"nl005-existing-fixture-covers-only-20261101","evidence":[{"url":"https://metadata.isbn.nl/1730692/mannen-die-vrouwen-haten-millennium-1.html","sha256":"4e66bade1d7be8ffb9c3e3d146e63a1a1a3431161f0767449f8e8f5d21fe6d06","checkedAt":"2026-11-01","fact":"Exact printed ISBN-to-image block; artwork visually reviewed; existing test language/Work identity retained."},{"url":"https://metadata.isbn.nl/ie_fcache/0000499132_Mannen_die_vrouwen_haten_-_Millennium_1_0_0.jpg","sha256":"ab0e270bc7e8f7bc4ef25d41e694157090396585fa767a1e23adf250f9466a5a","bytes":75660,"checkedAt":"2026-11-01T11:32:06.666Z","fact":"Real image; title/author visual check, not HTTP alone."}]}}],"bindings":[{"work":{"id":8800307,"title":"Outlander","cover_id":null,"author_id":8800014,"work_type":null,"source_type":"open_library","open_library_id":"OL3261155W","first_publish_year":1991,"native_identity_key":null},"author":{"id":8800014,"name":"Diana Gabaldon","open_library_id":"OL531502A"}},{"work":{"id":8800306,"title":"The Girl with the Dragon Tattoo","cover_id":null,"author_id":8800013,"work_type":null,"source_type":"open_library","open_library_id":"OL5784622W","first_publish_year":2005,"native_identity_key":null},"author":{"id":8800013,"name":"Stieg Larsson","open_library_id":"OL1414302A"}}],"authorCorpora":[]}'::jsonb;a jsonb;b jsonb;actual jsonb;oldrow jsonb;nextrow jsonb;k jsonb;kv record;ids jsonb:='{}';cols text;vals text;v_id bigint;i integer:=0;n integer;begin
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
  execute format('select to_jsonb(t) from public.%I t where to_jsonb(t) @> $1 for update',a->>'relation') into actual using k;
  if oldrow<>'null'::jsonb then
   execute format('select to_jsonb(jsonb_populate_record(null::public.%I,$1))',a->>'relation') into oldrow using oldrow;
   execute format('select to_jsonb(jsonb_populate_record(null::public.%I,$1))',a->>'relation') into nextrow using nextrow;
   if actual is not distinct from nextrow then continue;end if;
   if actual is distinct from oldrow then raise exception 'Changed existing row in % at action %',a->>'relation',i;end if;
   select string_agg(format('%I=(jsonb_populate_record(null::public.%I,$1)).%I',key,a->>'relation',key),',') into cols from jsonb_each(nextrow) where value is distinct from oldrow->key;
   execute format('update public.%I t set %s where to_jsonb(t) @> $2 returning to_jsonb(t)',a->>'relation',cols) into actual using nextrow,k;
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
 if n not in (0,2) then raise exception 'Partial install/replay; expected zero or all actions, got %',n;end if;
end;$release$;
select jsonb_build_object('project','hlvujbrmfdlrfxdjwsmb','batch','nl005-existing-fixture-covers-only-20261101','rows',coalesce(jsonb_agg(to_jsonb(r) order by seq),'[]')) as receipt from catalog_release_receipt r;
commit;
