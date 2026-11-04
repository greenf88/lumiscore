-- REVIEW ONLY. Exact target hlvujbrmfdlrfxdjwsmb. Isolated disposable test canary.
-- No accounts, ratings, progress, collections, taxonomy or taste-inventory DML.
-- COMMIT: securely retain FIRST non-empty full receipt, never substitute a replay receipt.
begin;set local lock_timeout='3s';set local statement_timeout='30s';
lock table public.authors,public.works,public.editions,public.catalog_work_descriptions,public.catalog_edition_metadata in share row exclusive mode;
create temporary table catalog_release_receipt(seq integer,relation text,key jsonb,before_row jsonb,after_row jsonb) on commit drop;
do $release$ declare payload jsonb:='{"batch":"nl-scale-20261102-006-fixture","project":"hlvujbrmfdlrfxdjwsmb","actions":[{"ref":"a1","relation":"authors","key":{"open_library_id":"OL24837A"},"before":null,"after":{"id":987305001,"name":"Tess Gerritsen","open_library_id":"OL24837A"}},{"ref":"a2","relation":"authors","key":{"open_library_id":"OL18865A"},"before":null,"after":{"id":987305002,"name":"Megan McDonald","open_library_id":"OL18865A"}},{"ref":"w1","relation":"works","key":{"native_identity_key":"nlscale:fixture006:282"},"before":null,"after":{"id":987105001,"title":"Eaters of the Dead","author_id":987304002,"first_publish_year":1976,"open_library_id":"OL46873W","cover_id":null,"source_type":"open_library","work_type":null,"native_identity_key":"nlscale:fixture006:282"}},{"ref":"w2","relation":"works","key":{"native_identity_key":"nlscale:fixture006:562"},"before":null,"after":{"id":987105002,"title":"Honeymoon","author_id":946300342,"first_publish_year":2001,"open_library_id":"OL167160W","cover_id":null,"source_type":"open_library","work_type":null,"native_identity_key":"nlscale:fixture006:562"}},{"ref":"w3","relation":"works","key":{"native_identity_key":"nlscale:fixture006:607"},"before":null,"after":{"id":987105003,"title":"The Surgeon","author_id":"@a1","first_publish_year":2001,"open_library_id":"OL14871640W","cover_id":null,"source_type":"open_library","work_type":null,"native_identity_key":"nlscale:fixture006:607"}},{"ref":"w4","relation":"works","key":{"native_identity_key":"nlscale:fixture006:5654"},"before":null,"after":{"id":987105004,"title":"Judy Moody","author_id":"@a2","first_publish_year":2000,"open_library_id":"OL443606W","cover_id":null,"source_type":null,"work_type":null,"native_identity_key":"nlscale:fixture006:5654"}},{"ref":"e1","relation":"editions","key":{"open_library_edition_id":"OL10686520M"},"before":null,"after":{"id":987205001,"work_id":"@w1","title":"Eaters of the Dead/13th Warrior (15M/Troll Associates)","language":null,"open_library_edition_id":"OL10686520M","isbn_10":null,"isbn_13":"9780345917270","publisher":"Ballantine Books","publish_date":null,"cover_id":null}},{"ref":"e2","relation":"editions","key":{"open_library_edition_id":"OL10263160M"},"before":null,"after":{"id":987205002,"work_id":"@w2","title":"Honeymoon","language":null,"open_library_edition_id":"OL10263160M","isbn_10":null,"isbn_13":"9780446694216","publisher":"Warner Books","publish_date":null,"cover_id":null}},{"ref":"e3","relation":"editions","key":{"open_library_edition_id":"OL10658842M"},"before":null,"after":{"id":987205003,"work_id":"@w3","title":"The Surgeon","language":null,"open_library_edition_id":"OL10658842M","isbn_10":null,"isbn_13":"9780739420416","publisher":"The Ballantine Publishing Group","publish_date":null,"cover_id":null}},{"ref":"e4","relation":"editions","key":{"open_library_edition_id":"OL35611866M"},"before":null,"after":{"id":987205004,"work_id":"@w4","title":"Judy Moody Geliyor 1","language":"dut","open_library_edition_id":"OL35611866M","isbn_10":"6054482548","isbn_13":"9786054482542","publisher":"Artemis Yaynlar","publish_date":null,"cover_id":null}}],"bindings":[{"work":{"id":946103532,"title":"Deadly Cross","cover_id":null,"author_id":946300342,"work_type":null,"source_type":null,"open_library_id":"OL20978085W","first_publish_year":2010,"native_identity_key":null},"author":{"id":946300342,"name":"James Patterson","open_library_id":"OL22258A"}},{"work":{"id":987101013,"title":"The Big Bad Wolf","cover_id":null,"author_id":946300342,"work_type":null,"source_type":"open_library","open_library_id":"OL167179W","first_publish_year":2003,"native_identity_key":"nlscale:fixture002:557"},"author":{"id":946300342,"name":"James Patterson","open_library_id":"OL22258A"}},{"work":{"id":987104014,"title":"Sphere","cover_id":null,"author_id":987304002,"work_type":null,"source_type":null,"open_library_id":"OL46917W","first_publish_year":1987,"native_identity_key":"nlscale:fixture005:3335"},"author":{"id":987304002,"name":"Michael Crichton","open_library_id":"OL28257A"}}],"authorCorpora":[{"author_id":946300342,"rows":[{"id":946103532,"title":"Deadly Cross","cover_id":null,"author_id":946300342,"work_type":null,"source_type":null,"open_library_id":"OL20978085W","first_publish_year":2010,"native_identity_key":null},{"id":987101013,"title":"The Big Bad Wolf","cover_id":null,"author_id":946300342,"work_type":null,"source_type":"open_library","open_library_id":"OL167179W","first_publish_year":2003,"native_identity_key":"nlscale:fixture002:557"}]},{"author_id":987304002,"rows":[{"id":987104014,"title":"Sphere","cover_id":null,"author_id":987304002,"work_type":null,"source_type":null,"open_library_id":"OL46917W","first_publish_year":1987,"native_identity_key":"nlscale:fixture005:3335"}]}]}'::jsonb;a jsonb;b jsonb;actual jsonb;oldrow jsonb;nextrow jsonb;k jsonb;kv record;ids jsonb:='{}';cols text;vals text;v_id bigint;i integer:=0;n integer;begin
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
 if n not in (0,10) then raise exception 'Partial install/replay; expected zero or all actions, got %',n;end if;
end;$release$;
select jsonb_build_object('project','hlvujbrmfdlrfxdjwsmb','batch','nl-scale-20261102-006-fixture','rows',coalesce(jsonb_agg(to_jsonb(r) order by seq),'[]')) as receipt from catalog_release_receipt r;
commit;
