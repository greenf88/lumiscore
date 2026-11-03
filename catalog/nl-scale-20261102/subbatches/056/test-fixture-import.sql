-- REVIEW ONLY. Exact target hlvujbrmfdlrfxdjwsmb. Isolated disposable test canary.
-- No accounts, ratings, progress, collections, taxonomy or taste-inventory DML.
-- COMMIT: securely retain FIRST non-empty full receipt, never substitute a replay receipt.
begin;set local lock_timeout='3s';set local statement_timeout='30s';
lock table public.authors,public.works,public.editions,public.catalog_work_descriptions,public.catalog_edition_metadata in share row exclusive mode;
create temporary table catalog_release_receipt(seq integer,relation text,key jsonb,before_row jsonb,after_row jsonb) on commit drop;
do $release$ declare payload jsonb:='{"batch":"nl-scale-20261102-056-fixture","project":"hlvujbrmfdlrfxdjwsmb","actions":[{"ref":"a1","relation":"authors","key":{"open_library_id":"OL78910A"},"before":null,"after":{"id":987355001,"name":"Chinua Achebe","open_library_id":"OL78910A"}},{"ref":"w1","relation":"works","key":{"native_identity_key":"nlscale:fixture056:214"},"before":null,"after":{"id":987155001,"title":"Breaking Dawn","author_id":978300038,"first_publish_year":2000,"open_library_id":"OL5720022W","cover_id":null,"source_type":"open_library","work_type":null,"native_identity_key":"nlscale:fixture056:214"}},{"ref":"w2","relation":"works","key":{"native_identity_key":"nlscale:fixture056:330"},"before":null,"after":{"id":987155002,"title":"Things Fall Apart","author_id":"@a1","first_publish_year":1958,"open_library_id":"OL891786W","cover_id":null,"source_type":"open_library","work_type":null,"native_identity_key":"nlscale:fixture056:330"}},{"ref":"w3","relation":"works","key":{"native_identity_key":"nlscale:fixture056:363"},"before":null,"after":{"id":987155003,"title":"The Secret History","author_id":987334001,"first_publish_year":1992,"open_library_id":"OL4321141W","cover_id":null,"source_type":"open_library","work_type":null,"native_identity_key":"nlscale:fixture056:363"}},{"ref":"e1","relation":"editions","key":{"open_library_edition_id":"OL20962578M"},"before":null,"after":{"id":987255001,"work_id":"@w1","title":"Breaking dawn","language":null,"open_library_edition_id":"OL20962578M","isbn_10":null,"isbn_13":"9780316067928","publisher":"Little, Brown, and Co.","publish_date":null,"cover_id":null}},{"ref":"e2","relation":"editions","key":{"open_library_edition_id":"OL10151159M"},"before":null,"after":{"id":987255002,"work_id":"@w2","title":"Things Fall Apart (Reader''s Companion)","language":null,"open_library_edition_id":"OL10151159M","isbn_10":null,"isbn_13":"9780385489386","publisher":"Anchor Books","publish_date":null,"cover_id":null}},{"ref":"e3","relation":"editions","key":{"open_library_edition_id":"OL24933958M"},"before":null,"after":{"id":987255003,"work_id":"@w3","title":"The secret history","language":null,"open_library_edition_id":"OL24933958M","isbn_10":null,"isbn_13":"9781400031702","publisher":"Vintage Books","publish_date":null,"cover_id":null}}],"bindings":[{"work":{"id":978100058,"title":"Twilight","cover_id":null,"author_id":978300038,"work_type":null,"source_type":"open_library","open_library_id":"OL5720023W","first_publish_year":2005,"native_identity_key":null},"author":{"id":978300038,"name":"Stephenie Meyer","open_library_id":"OL1391085A"}},{"work":{"id":987134002,"title":"The Little Friend","cover_id":null,"author_id":987334001,"work_type":"novel","source_type":"open_library","open_library_id":"OL4321136W","first_publish_year":2002,"native_identity_key":"nlscale:20261102:ol:OL4321136W"},"author":{"id":987334001,"name":"Donna Tartt","open_library_id":"OL841112A"}}],"authorCorpora":[{"author_id":978300038,"rows":[{"id":978100058,"title":"Twilight","cover_id":null,"author_id":978300038,"work_type":null,"source_type":"open_library","open_library_id":"OL5720023W","first_publish_year":2005,"native_identity_key":null}]},{"author_id":987334001,"rows":[{"id":987134002,"title":"The Little Friend","cover_id":null,"author_id":987334001,"work_type":"novel","source_type":"open_library","open_library_id":"OL4321136W","first_publish_year":2002,"native_identity_key":"nlscale:20261102:ol:OL4321136W"}]}]}'::jsonb;a jsonb;b jsonb;actual jsonb;oldrow jsonb;nextrow jsonb;k jsonb;kv record;ids jsonb:='{}';cols text;vals text;predicate text;v_id bigint;i integer:=0;n integer;begin
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
 if n not in (0,7) then raise exception 'Partial install/replay; expected zero or all actions, got %',n;end if;
end;$release$;
select jsonb_build_object('project','hlvujbrmfdlrfxdjwsmb','batch','nl-scale-20261102-056-fixture','rows',coalesce(jsonb_agg(to_jsonb(r) order by seq),'[]')) as receipt from catalog_release_receipt r;
commit;
