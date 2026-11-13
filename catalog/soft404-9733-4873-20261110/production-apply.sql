-- REVIEW ONLY. Exact target qvplwejffhjvxaypmjut. Separate production approval required.
-- No accounts, ratings, progress, collections, taxonomy or taste-inventory DML.
-- COMMIT: securely retain FIRST non-empty full receipt, never substitute a replay receipt.
begin;set local lock_timeout='3s';set local statement_timeout='30s';
lock table public.authors,public.works,public.editions,public.catalog_work_descriptions,public.catalog_edition_metadata in share row exclusive mode;
do $parents$ declare expected jsonb; actual jsonb; begin
  for expected in select value from jsonb_array_elements('[{"id":5032,"title":"Domain-driven design","isbn_10":"0321125215","isbn_13":"9780321125217","work_id":4873,"language":"eng","publisher":"Addison-Wesley","created_at":"2026-10-03T14:36:16.743524+00:00","open_library_edition_id":"OL17094759M"},{"id":9892,"title":"Dark Heritage","isbn_10":"0373106300","isbn_13":"9780373106301","work_id":9733,"language":"eng","publisher":"harlequin","created_at":"2026-10-03T17:13:22.654831+00:00","open_library_edition_id":"OL10738237M"}]'::jsonb) loop
    select to_jsonb(e) into actual from public.editions e where id=(expected->>'id')::bigint;
    if actual is distinct from expected then raise exception 'Exact edition drift; stop'; end if;
  end loop;
end;$parents$;
create temporary table catalog_release_receipt(seq integer,relation text,key jsonb,before_row jsonb,after_row jsonb) on commit drop;
do $release$ declare payload jsonb:='{"batch":"soft404-9733-4873-20261110","project":"qvplwejffhjvxaypmjut","actions":[{"relation":"catalog_work_descriptions","ref":"summary-4873","key":{"work_id":4873,"language":"en"},"before":null,"after":{"work_id":4873,"language":"en","bound_author_id":2545,"text":"Eric Evans shows how teams can design software around the business problems it needs to solve. He describes how developers and domain experts build a shared vocabulary and express their understanding in the code. With examples, he introduces entities, value objects and aggregates, then turns to the boundaries between models in larger systems. The book also explains how teams can refine a design as their understanding of the domain changes.","source_type":"official_publisher","source_name":"Pearson / Addison-Wesley (InformIT)","source_url":"https://www.informit.com/store/domain-driven-design-tackling-complexity-in-the-heart-9780321125217","evidence":[{"url":"https://www.pearson.com/en-gb/subject-catalog/p/domain-driven-design-tackling-complexity-in-the-heart-of-software/P200000009375/9780321125217","facts":["Publisher confirms author, English first-edition ISBN and the book’s focus on modelling complex domains."],"checkedAt":"2026-11-10T07:40:00.000Z"},{"url":"https://www.informit.com/store/domain-driven-design-tackling-complexity-in-the-heart-9780321125217","facts":["Publisher contents identify the shared language, building blocks, refactoring and bounded contexts."],"checkedAt":"2026-11-10T07:40:00.000Z"}],"provenance":"original_source_reviewed_summary","review_status":"approved","reviewed_at":"2026-11-10T07:40:00.000Z","review_batch":"soft404-9733-4873-20261110"}},{"relation":"catalog_work_descriptions","ref":"summary-9733","key":{"work_id":9733,"language":"en"},"before":null,"after":{"work_id":9733,"language":"en","bound_author_id":5148,"text":"Dale Palmer grows up at a convent school, largely apart from her parents. When they die, their lawyer takes responsibility for her, and she moves in with him and his mother after leaving school. In her new home, Dale begins to find her footing and develops feelings for her guardian. A secret from her past makes her hesitate to get closer to him.","source_type":"official_catalog","source_name":"Open Library catalogue","source_url":"https://openlibrary.org/works/OL4225431W/Dark_heritage","evidence":[{"url":"https://openlibrary.org/works/OL4225431W/Dark_heritage","facts":["The catalogue synopsis establishes Dale’s upbringing, her guardian’s household and the secret that complicates their relationship."],"checkedAt":"2026-11-10T07:40:00.000Z"},{"url":"https://www.fictiondb.com/book/dark-heritage~yvonne-whittal~38128.htm","facts":["Bibliography confirms author, title, Harlequin Presents series position and the same opening premise."],"checkedAt":"2026-11-10T07:40:00.000Z"},{"url":"https://www.thriftbooks.com/w/dark-heritage_yvonne-whittal/715685/","facts":["Independently confirms the 1983 English Harlequin paperback, ISBN 9780373106301."],"checkedAt":"2026-11-10T07:40:00.000Z"}],"provenance":"original_source_reviewed_summary","review_status":"approved","reviewed_at":"2026-11-10T07:40:00.000Z","review_batch":"soft404-9733-4873-20261110"}}],"bindings":[{"work":{"id":4873,"title":"Domain-Driven Design","cover_id":null,"subjects":null,"subtitle":null,"author_id":2545,"work_type":null,"created_at":"2026-10-03T14:36:16.743524+00:00","source_type":null,"open_library_id":"OL4464385W","first_publish_year":2003,"native_identity_key":null},"author":{"id":2545,"name":"Eric Evans","created_at":"2026-10-03T14:36:16.743524+00:00","open_library_id":"OL5205508A"}},{"work":{"id":9733,"title":"Dark heritage","cover_id":null,"subjects":null,"subtitle":null,"author_id":5148,"work_type":null,"created_at":"2026-10-03T17:13:22.654831+00:00","source_type":null,"open_library_id":"OL4225431W","first_publish_year":1983,"native_identity_key":null},"author":{"id":5148,"name":"Yvonne Whittal","created_at":"2026-10-03T17:13:22.654831+00:00","open_library_id":"OL808883A"}}],"authorCorpora":[]}'::jsonb;a jsonb;b jsonb;actual jsonb;oldrow jsonb;nextrow jsonb;k jsonb;kv record;ids jsonb:='{}';cols text;vals text;predicate text;v_id bigint;i integer:=0;n integer;begin
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
 if n not in (0,2) then raise exception 'Partial install/replay; expected zero or all actions, got %',n;end if;
end;$release$;
select jsonb_build_object('project','qvplwejffhjvxaypmjut','batch','soft404-9733-4873-20261110','rows',coalesce(jsonb_agg(to_jsonb(r) order by seq),'[]')) as receipt from catalog_release_receipt r;
commit;
