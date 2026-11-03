-- REVIEW ONLY. Exact target qvplwejffhjvxaypmjut. Separate production approval required.
-- No accounts, ratings, progress, collections, taxonomy or taste-inventory DML.
-- COMMIT: securely retain FIRST non-empty full receipt, never substitute a replay receipt.
begin;set local lock_timeout='3s';set local statement_timeout='30s';
lock table public.authors,public.works,public.editions,public.catalog_work_descriptions,public.catalog_edition_metadata in share row exclusive mode;
create temporary table catalog_release_receipt(seq integer,relation text,key jsonb,before_row jsonb,after_row jsonb) on commit drop;
do $release$ declare payload jsonb:='{"batch":"nl-scale-20261102-022","project":"qvplwejffhjvxaypmjut","actions":[{"ref":"e0","relation":"editions","key":{"open_library_edition_id":"OL42371583M"},"before":null,"after":{"work_id":3094,"title":"De Fluisterman","language":"dut","open_library_edition_id":"OL42371583M","isbn_13":"9789049807368","isbn_10":null,"publisher":"Dwarsligger"}},{"ref":"d0","relation":"catalog_work_descriptions","key":{"work_id":3094,"language":"nl"},"before":null,"after":{"work_id":3094,"language":"nl","bound_author_id":1516,"text":"Na de dood van zijn vrouw verhuist Tom Kennedy met zijn jonge zoon Jake naar Featherbank. Hij hoopt er opnieuw te kunnen beginnen, maar het stadje draagt de herinnering aan een reeks kindermoorden met zich mee. Een nieuwe verdwijning vertoont verontrustende overeenkomsten met die oude zaken. Terwijl rechercheurs naar het vermiste kind zoeken, merkt Tom dat ook Jake zich anders gedraagt. De jongen zegt gefluister bij zijn raam te horen, waardoor de veilige nieuwe omgeving steeds minder geruststellend wordt.","source_type":"official_catalog","source_name":"Gecontroleerde boek- en catalogusbronnen","source_url":"https://www.alexnorth.co.uk/","evidence":[{"type":"reviewed_identity_and_bibliography","sources":["http://data.bibliotheken.nl/id/nbt/p421924489"],"reference":"work:3094","checked_at":"2026-11-02T21:52:43.735Z","note":"Author official website explicitly states he published ten crime novels as SteveMosby before writing TheWhisperMan as AlexNorth. Same verified person, no name-only equivalence or author merge. Exact9789049807368 Dutch Dwarsligger print bound by KBp421924489; display public author model is retained and pseudonym credit documented.","supplemental":null,"existingAlternativeReview":null},{"type":"original_substantive_source_review","review":"content-review-019.json","sources":["https://www.alexnorth.co.uk/","https://openlibrary.org/works/OL20094468W","https://data.bibliotheken.nl/id/nbt/p421924489"]},{"type":"cover_front_review","cover_id":13784395,"sha256":"92a5cac5ca2232ea764dc769008775a5b902fbeaaa335bf663b00f5916e9dfac","reference":"cover-semantic-review-003.json","limitation":"Front title/author and source-edition binding; no barcode assertion."}],"provenance":"original_source_reviewed_summary","review_status":"approved","reviewed_at":"2026-11-02T21:52:43.735Z","review_batch":"nl-scale-20261102-022"}},{"ref":"m0","relation":"catalog_edition_metadata","key":{"edition_id":"@e0"},"before":null,"after":{"edition_id":"@e0","work_id":3094,"bound_author_id":1516,"bound_title":"De Fluisterman","bound_language":"dut","bound_isbn13":"9789049807368","format":"paperback","cover_url":"https://covers.openlibrary.org/b/id/13784395-L.jpg?default=false","card_cover_url":"https://covers.openlibrary.org/b/id/13784395-M.jpg?default=false","evidence_url":"https://data.bibliotheken.nl/id/nbt/p421924489","evidence":[{"type":"reviewed_identity_and_bibliography","sources":["http://data.bibliotheken.nl/id/nbt/p421924489"],"reference":"work:3094","checked_at":"2026-11-02T21:52:43.735Z","note":"Author official website explicitly states he published ten crime novels as SteveMosby before writing TheWhisperMan as AlexNorth. Same verified person, no name-only equivalence or author merge. Exact9789049807368 Dutch Dwarsligger print bound by KBp421924489; display public author model is retained and pseudonym credit documented.","supplemental":null,"existingAlternativeReview":null},{"type":"original_substantive_source_review","review":"content-review-019.json","sources":["https://www.alexnorth.co.uk/","https://openlibrary.org/works/OL20094468W","https://data.bibliotheken.nl/id/nbt/p421924489"]},{"type":"cover_front_review","cover_id":13784395,"sha256":"92a5cac5ca2232ea764dc769008775a5b902fbeaaa335bf663b00f5916e9dfac","reference":"cover-semantic-review-003.json","limitation":"Front title/author and source-edition binding; no barcode assertion."}],"review_status":"approved","reviewed_at":"2026-11-02T21:52:43.735Z","review_batch":"nl-scale-20261102-022"}}],"bindings":[{"work":{"id":3094,"title":"The Whisper Man","cover_id":null,"subjects":null,"subtitle":null,"author_id":1516,"work_type":null,"created_at":"2026-10-03T10:24:08.04548+00:00","source_type":null,"open_library_id":"OL20094468W","first_publish_year":2019,"native_identity_key":null},"author":{"id":1516,"name":"Steve Mosby","created_at":"2026-10-03T10:24:08.04548+00:00","open_library_id":"OL2829179A"}}],"authorCorpora":[]}'::jsonb;a jsonb;b jsonb;actual jsonb;oldrow jsonb;nextrow jsonb;k jsonb;kv record;ids jsonb:='{}';cols text;vals text;predicate text;v_id bigint;i integer:=0;n integer;begin
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
 if n not in (0,3) then raise exception 'Partial install/replay; expected zero or all actions, got %',n;end if;
end;$release$;
select jsonb_build_object('project','qvplwejffhjvxaypmjut','batch','nl-scale-20261102-022','rows',coalesce(jsonb_agg(to_jsonb(r) order by seq),'[]')) as receipt from catalog_release_receipt r;
commit;
