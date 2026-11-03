-- REVIEW ONLY. Exact target qvplwejffhjvxaypmjut. Separate production approval required.
-- No accounts, ratings, progress, collections, taxonomy or taste-inventory DML.
-- Dry-run: catalogue rows ROLLBACK; generated sequence values are NOT reset.
begin;set local lock_timeout='3s';set local statement_timeout='30s';
lock table public.authors,public.works,public.editions,public.catalog_work_descriptions,public.catalog_edition_metadata in share row exclusive mode;
create temporary table catalog_release_receipt(seq integer,relation text,key jsonb,before_row jsonb,after_row jsonb) on commit drop;
do $release$ declare payload jsonb:='{"batch":"nl-scale-20261102-064","project":"qvplwejffhjvxaypmjut","actions":[{"ref":"y0","relation":"works","key":{"id":816},"before":{"id":816,"title":"Brief Answers to the Big Questions","cover_id":null,"subjects":null,"subtitle":null,"author_id":73,"work_type":null,"created_at":"2026-09-02T08:47:05.576561+00:00","source_type":"open_library","open_library_id":"OL19552275W","first_publish_year":2014,"native_identity_key":null},"after":{"id":816,"title":"Brief Answers to the Big Questions","cover_id":null,"subjects":null,"subtitle":null,"author_id":73,"work_type":null,"created_at":"2026-09-02T08:47:05.576561+00:00","source_type":"open_library","open_library_id":"OL19552275W","first_publish_year":2018,"native_identity_key":null}},{"ref":"e0","relation":"editions","key":{"open_library_edition_id":"OL46531174M"},"before":null,"after":{"work_id":816,"title":"De antwoorden op de grote vragen","language":"dut","open_library_edition_id":"OL46531174M","isbn_13":"9789000365043","isbn_10":null,"publisher":"Spectrum"}},{"ref":"d0","relation":"catalog_work_descriptions","key":{"work_id":816,"language":"nl"},"before":null,"after":{"work_id":816,"language":"nl","bound_author_id":73,"text":"Stephen Hawking onderzoekt grote vragen over het heelal en de toekomst van de mens. Kan de mensheid op aarde blijven voortbestaan, wat betekent kunstmatige intelligentie en heeft het zin om andere planeten te bewonen? Hij verbindt zulke vragen met zijn natuurkundige werk en zijn overtuiging dat wetenschap ook bij maatschappelijke problemen een rol kan spelen. De teksten gaan over mogelijkheden en risico’s, zonder overal een definitief antwoord te bieden. Deze postuum verschenen bundel brengt zijn laatste beschouwingen voor een breed publiek samen.","source_type":"official_catalog","source_name":"Gecontroleerde boek- en catalogusbronnen","source_url":"https://www.penguinrandomhouse.com/books/600621/brief-answers-to-the-big-questions-by-stephen-hawking/","evidence":[{"type":"reviewed_identity_and_bibliography","sources":["http://data.bibliotheken.nl/id/nbt/p418241082"],"reference":"work:816","checked_at":"2026-11-03T12:40:25.561Z","note":"ExactDutchHardcoverISBN9789000365043 andKBoriginalBriefAnswers2018 plusprimaryBantampublisher matchexistingWork816; current2014predatesactualbook. RetainWork/author, newDutchedition notnewWork. SourceHawkingcanonicalfullnameindependentlybound byexactISBN.","supplemental":null,"existingAlternativeReview":null},{"type":"original_substantive_source_review","review":"content-amendment-029.json","sources":["https://www.penguinrandomhouse.com/books/600621/brief-answers-to-the-big-questions-by-stephen-hawking/","https://openlibrary.org/works/OL19552275W","https://data.bibliotheken.nl/id/nbt/p418241082"]},{"type":"cover_front_review","cover_id":13189253,"sha256":"7fa0c5166659b6afa751df326a0d3577ddea98c56d86ea8a6e324b3eae7f5515","reference":"cover-semantic-review-063.json","limitation":"Actually viewed black starfield front, StephenHawking andDutch Deantwoordenopdegrotevragen, wireframeface andgoldtitle. ExactselectedDutch2018hardcoverISBNsource."}],"provenance":"original_source_reviewed_summary","review_status":"approved","reviewed_at":"2026-11-03T12:40:25.561Z","review_batch":"nl-scale-20261102-064"}},{"ref":"m0","relation":"catalog_edition_metadata","key":{"edition_id":"@e0"},"before":null,"after":{"edition_id":"@e0","work_id":816,"bound_author_id":73,"bound_title":"De antwoorden op de grote vragen","bound_language":"dut","bound_isbn13":"9789000365043","format":"hardcover","cover_url":"https://covers.openlibrary.org/b/id/13189253-L.jpg?default=false","card_cover_url":"https://covers.openlibrary.org/b/id/13189253-M.jpg?default=false","evidence_url":"https://data.bibliotheken.nl/id/nbt/p418241082","evidence":[{"type":"reviewed_identity_and_bibliography","sources":["http://data.bibliotheken.nl/id/nbt/p418241082"],"reference":"work:816","checked_at":"2026-11-03T12:40:25.561Z","note":"ExactDutchHardcoverISBN9789000365043 andKBoriginalBriefAnswers2018 plusprimaryBantampublisher matchexistingWork816; current2014predatesactualbook. RetainWork/author, newDutchedition notnewWork. SourceHawkingcanonicalfullnameindependentlybound byexactISBN.","supplemental":null,"existingAlternativeReview":null},{"type":"original_substantive_source_review","review":"content-amendment-029.json","sources":["https://www.penguinrandomhouse.com/books/600621/brief-answers-to-the-big-questions-by-stephen-hawking/","https://openlibrary.org/works/OL19552275W","https://data.bibliotheken.nl/id/nbt/p418241082"]},{"type":"cover_front_review","cover_id":13189253,"sha256":"7fa0c5166659b6afa751df326a0d3577ddea98c56d86ea8a6e324b3eae7f5515","reference":"cover-semantic-review-063.json","limitation":"Actually viewed black starfield front, StephenHawking andDutch Deantwoordenopdegrotevragen, wireframeface andgoldtitle. ExactselectedDutch2018hardcoverISBNsource."}],"review_status":"approved","reviewed_at":"2026-11-03T12:40:25.561Z","review_batch":"nl-scale-20261102-064"}}],"bindings":[{"work":{"id":816,"title":"Brief Answers to the Big Questions","cover_id":null,"subjects":null,"subtitle":null,"author_id":73,"work_type":null,"created_at":"2026-09-02T08:47:05.576561+00:00","source_type":"open_library","open_library_id":"OL19552275W","first_publish_year":2014,"native_identity_key":null},"author":{"id":73,"name":"Stephen Hawking","created_at":"2026-09-01T15:20:43.380344+00:00","open_library_id":"OL2675573A"}}],"authorCorpora":[]}'::jsonb;a jsonb;b jsonb;actual jsonb;oldrow jsonb;nextrow jsonb;k jsonb;kv record;ids jsonb:='{}';cols text;vals text;predicate text;v_id bigint;i integer:=0;n integer;begin
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
 if n not in (0,4) then raise exception 'Partial install/replay; expected zero or all actions, got %',n;end if;
end;$release$;
select jsonb_build_object('project','qvplwejffhjvxaypmjut','batch','nl-scale-20261102-064','rows',coalesce(jsonb_agg(to_jsonb(r) order by seq),'[]')) as receipt from catalog_release_receipt r;
rollback;
