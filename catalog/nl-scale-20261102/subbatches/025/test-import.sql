-- REVIEW ONLY. Exact target hlvujbrmfdlrfxdjwsmb. Isolated disposable test canary.
-- No accounts, ratings, progress, collections, taxonomy or taste-inventory DML.
-- COMMIT: securely retain FIRST non-empty full receipt, never substitute a replay receipt.
begin;set local lock_timeout='3s';set local statement_timeout='30s';
lock table public.authors,public.works,public.editions,public.catalog_work_descriptions,public.catalog_edition_metadata in share row exclusive mode;
create temporary table catalog_release_receipt(seq integer,relation text,key jsonb,before_row jsonb,after_row jsonb) on commit drop;
do $release$ declare payload jsonb:='{"batch":"nl-scale-20261102-025","project":"hlvujbrmfdlrfxdjwsmb","actions":[{"ref":"a1","relation":"authors","key":{"open_library_id":"OL228968A"},"before":null,"after":{"name":"John Wyndham","open_library_id":"OL228968A","id":987324001}},{"ref":"w0","relation":"works","key":{"native_identity_key":"nlscale:20261102:ol:OL1911336W"},"before":null,"after":{"title":"The Day of the Triffids","author_id":"@a1","first_publish_year":1951,"open_library_id":"OL1911336W","cover_id":13119475,"source_type":"open_library","work_type":"novel","native_identity_key":"nlscale:20261102:ol:OL1911336W","id":987124001}},{"ref":"e0","relation":"editions","key":{"open_library_edition_id":"OL45002848M"},"before":null,"after":{"work_id":"@w0","open_library_edition_id":"OL45002848M","isbn_13":"9789027432858","isbn_10":null,"title":"De Triffids Komen","language":"dut","publisher":"Het Spectrum","id":987224001,"publish_date":null,"cover_id":13119475}},{"ref":"d0","relation":"catalog_work_descriptions","key":{"work_id":"@w0","language":"nl"},"before":null,"after":{"work_id":"@w0","language":"nl","bound_author_id":"@a1","text":"Tijdens een ziekenhuisopname mist Bill Masen een hemelverschijnsel waar bijna iedereen naar kijkt. Wanneer zijn verband afgaat, blijkt een groot deel van de bevolking blind te zijn geworden. De samenleving valt uiteen, terwijl de triffids, planten die zich kunnen verplaatsen en een giftige aanval kunnen uitvoeren, een steeds groter gevaar vormen. Bill probeert zich in deze veranderde wereld staande te houden. Het verhaal onderzoekt hoe mensen zich organiseren wanneer vertrouwde bescherming en regels wegvallen.","source_type":"official_catalog","source_name":"Gecontroleerde boek- en catalogusbronnen","source_url":"https://www.bol.com/nl/nl/f/de-triffids-komen/33724439/","evidence":[{"type":"reviewed_identity_and_bibliography","sources":["https://data.bibliotheken.nl/id/nbt/p107631296"],"reference":"new-work-dossier-readings-025.json#12","checked_at":"2026-11-02T22:25:40.674Z","note":"ExactDutchSpectrumprint9789027432858/294p full1951novel. JohnWyndham sole originalnovelist; MarcelBattin translator/othereditioncredit and AndyBridge designer not coauthors. No adaptation/film or anthology substitution."},{"type":"original_substantive_source_review","sources":["https://www.bol.com/nl/nl/f/de-triffids-komen/33724439/","https://www.booksinbelgium.be/nl/b/wyndham-triffids-komen-9789027432858","https://openlibrary.org/works/OL1911336W","https://data.bibliotheken.nl/id/nbt/p107631296"],"review":"content-review-001.json"},{"type":"explicit_contributor_roles","credits":[{"name":"Marcel Battin","role":"translator/other-edition credit; not original novelist","source":"https://openlibrary.org/authors/OL8007250A"},{"name":"Andy Bridge","role":"cover designer on source; not novelist","source":"https://openlibrary.org/authors/OL8007853A"}],"limitation":"Existing schema has one primary Work author; no synthetic combined-author identity or author merge."},{"type":"cover_front_review","cover_id":13119475,"sha256":"9f876d5b51b9e641b94ea74a0fae19b9074100a4d238aea21e2079d426e3d11c","reference":"cover-semantic-review-011.json","limitation":"Front title/author and source-edition binding; no barcode or exact printing-year claim."}],"provenance":"original_source_reviewed_summary","review_status":"approved","reviewed_at":"2026-11-02T22:25:40.674Z","review_batch":"nl-scale-20261102-025"}},{"ref":"m0","relation":"catalog_edition_metadata","key":{"edition_id":"@e0"},"before":null,"after":{"edition_id":"@e0","work_id":"@w0","bound_author_id":"@a1","bound_title":"De Triffids Komen","bound_language":"dut","bound_isbn13":"9789027432858","format":"paperback","cover_url":"https://covers.openlibrary.org/b/id/13119475-L.jpg?default=false","card_cover_url":"https://covers.openlibrary.org/b/id/13119475-M.jpg?default=false","evidence_url":"https://data.bibliotheken.nl/id/nbt/p107631296","evidence":[{"type":"reviewed_identity_and_bibliography","sources":["https://data.bibliotheken.nl/id/nbt/p107631296"],"reference":"new-work-dossier-readings-025.json#12","checked_at":"2026-11-02T22:25:40.674Z","note":"ExactDutchSpectrumprint9789027432858/294p full1951novel. JohnWyndham sole originalnovelist; MarcelBattin translator/othereditioncredit and AndyBridge designer not coauthors. No adaptation/film or anthology substitution."},{"type":"original_substantive_source_review","sources":["https://www.bol.com/nl/nl/f/de-triffids-komen/33724439/","https://www.booksinbelgium.be/nl/b/wyndham-triffids-komen-9789027432858","https://openlibrary.org/works/OL1911336W","https://data.bibliotheken.nl/id/nbt/p107631296"],"review":"content-review-001.json"},{"type":"explicit_contributor_roles","credits":[{"name":"Marcel Battin","role":"translator/other-edition credit; not original novelist","source":"https://openlibrary.org/authors/OL8007250A"},{"name":"Andy Bridge","role":"cover designer on source; not novelist","source":"https://openlibrary.org/authors/OL8007853A"}],"limitation":"Existing schema has one primary Work author; no synthetic combined-author identity or author merge."},{"type":"cover_front_review","cover_id":13119475,"sha256":"9f876d5b51b9e641b94ea74a0fae19b9074100a4d238aea21e2079d426e3d11c","reference":"cover-semantic-review-011.json","limitation":"Front title/author and source-edition binding; no barcode or exact printing-year claim."}],"review_status":"approved","reviewed_at":"2026-11-02T22:25:40.674Z","review_batch":"nl-scale-20261102-025"}}],"bindings":[],"authorCorpora":[]}'::jsonb;a jsonb;b jsonb;actual jsonb;oldrow jsonb;nextrow jsonb;k jsonb;kv record;ids jsonb:='{}';cols text;vals text;predicate text;v_id bigint;i integer:=0;n integer;begin
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
 if n not in (0,5) then raise exception 'Partial install/replay; expected zero or all actions, got %',n;end if;
end;$release$;
select jsonb_build_object('project','hlvujbrmfdlrfxdjwsmb','batch','nl-scale-20261102-025','rows',coalesce(jsonb_agg(to_jsonb(r) order by seq),'[]')) as receipt from catalog_release_receipt r;
commit;
