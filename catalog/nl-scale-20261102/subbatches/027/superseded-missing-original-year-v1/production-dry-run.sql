-- REVIEW ONLY. Exact target qvplwejffhjvxaypmjut. Separate production approval required.
-- No accounts, ratings, progress, collections, taxonomy or taste-inventory DML.
-- Dry-run: catalogue rows ROLLBACK; generated sequence values are NOT reset.
begin;set local lock_timeout='3s';set local statement_timeout='30s';
lock table public.authors,public.works,public.editions,public.catalog_work_descriptions,public.catalog_edition_metadata in share row exclusive mode;
create temporary table catalog_release_receipt(seq integer,relation text,key jsonb,before_row jsonb,after_row jsonb) on commit drop;
do $release$ declare payload jsonb:='{"batch":"nl-scale-20261102-027","project":"qvplwejffhjvxaypmjut","actions":[{"ref":"e0","relation":"editions","key":{"open_library_edition_id":"OL47139255M"},"before":null,"after":{"work_id":629,"title":"In naam van de vader","language":"dut","open_library_edition_id":"OL47139255M","isbn_13":"9789046113639","isbn_10":null,"publisher":"Bruna Uitgevers, a.W."}},{"ref":"d0","relation":"catalog_work_descriptions","key":{"work_id":629,"language":"nl"},"before":null,"after":{"work_id":629,"language":"nl","bound_author_id":342,"text":"Tijdens een vakantie met zijn gezin wordt Alex Cross opgeroepen voor het onderzoek naar de moord op een actrice. Een krant ontvangt kort daarna een bericht waarin de dader de gebeurtenis beschrijft. Het blijkt niet om een op zichzelf staande zaak te gaan. Nieuwe bedreigingen brengen bekende personen in Hollywood in paniek. Cross en de plaatselijke politie moeten een patroon zien te vinden voordat opnieuw iemand wordt gedood, terwijl de berichten het onderzoek steeds nadrukkelijker proberen te sturen.","source_type":"official_catalog","source_name":"Gecontroleerde boek- en catalogusbronnen","source_url":"https://data.bibliotheken.nl/id/nbt/p320421678","evidence":[{"type":"reviewed_identity_and_bibliography","sources":["http://data.bibliotheken.nl/id/nbt/p320421678"],"reference":"work:629","checked_at":"2026-11-02T22:34:17.806Z","note":"ExactDutch9789046113639/KBp320421678 canonical title is Innaamvandevader. Remove source retail /druk1 suffix and extra de, preserve ISBN/OLkey/language/format/cover. AlexCross#11/MaryMary2005, authorJamesPatterson canonicalJamesBrendan; no newWork.","supplemental":{"originalEditionSha256":"74ba91a12c2ce44330d67dc051f3d7beceea1eb7923d52a251cfe734b5a414ad","review":"ExactDutch9789046113639/KBp320421678 canonical title is Innaamvandevader. Remove source retail /druk1 suffix and extra de, preserve ISBN/OLkey/language/format/cover. AlexCross#11/MaryMary2005, authorJamesPatterson canonicalJamesBrendan; no newWork.","reviewSources":["https://data.bibliotheken.nl/id/nbt/p320421678","https://boekenbalie.nl/in-de-naam-van-de-vader-zwarte-beertjes/9789046113639"],"formatSource":"https://boekenbalie.nl/in-de-naam-van-de-vader-zwarte-beertjes/9789046113639"},"existingAlternativeReview":null},{"type":"original_substantive_source_review","review":"content-review-018.json","sources":["https://data.bibliotheken.nl/id/nbt/p320421678","https://boekenbalie.nl/in-de-naam-van-de-vader-zwarte-beertjes/9789046113639","https://openlibrary.org/works/OL167173W"]},{"type":"cover_front_review","cover_id":13536449,"sha256":"8ca226f927c483bcaf0157e52f72a26de4fdc0a627c8c7b5771394d026a322fc","reference":"cover-semantic-review-002.json","limitation":"Front title/author and source-edition binding; no barcode assertion."}],"provenance":"original_source_reviewed_summary","review_status":"approved","reviewed_at":"2026-11-02T22:34:17.806Z","review_batch":"nl-scale-20261102-027"}},{"ref":"m0","relation":"catalog_edition_metadata","key":{"edition_id":"@e0"},"before":null,"after":{"edition_id":"@e0","work_id":629,"bound_author_id":342,"bound_title":"In naam van de vader","bound_language":"dut","bound_isbn13":"9789046113639","format":"paperback","cover_url":"https://covers.openlibrary.org/b/id/13536449-L.jpg?default=false","card_cover_url":"https://covers.openlibrary.org/b/id/13536449-M.jpg?default=false","evidence_url":"https://data.bibliotheken.nl/id/nbt/p320421678","evidence":[{"type":"reviewed_identity_and_bibliography","sources":["http://data.bibliotheken.nl/id/nbt/p320421678"],"reference":"work:629","checked_at":"2026-11-02T22:34:17.806Z","note":"ExactDutch9789046113639/KBp320421678 canonical title is Innaamvandevader. Remove source retail /druk1 suffix and extra de, preserve ISBN/OLkey/language/format/cover. AlexCross#11/MaryMary2005, authorJamesPatterson canonicalJamesBrendan; no newWork.","supplemental":{"originalEditionSha256":"74ba91a12c2ce44330d67dc051f3d7beceea1eb7923d52a251cfe734b5a414ad","review":"ExactDutch9789046113639/KBp320421678 canonical title is Innaamvandevader. Remove source retail /druk1 suffix and extra de, preserve ISBN/OLkey/language/format/cover. AlexCross#11/MaryMary2005, authorJamesPatterson canonicalJamesBrendan; no newWork.","reviewSources":["https://data.bibliotheken.nl/id/nbt/p320421678","https://boekenbalie.nl/in-de-naam-van-de-vader-zwarte-beertjes/9789046113639"],"formatSource":"https://boekenbalie.nl/in-de-naam-van-de-vader-zwarte-beertjes/9789046113639"},"existingAlternativeReview":null},{"type":"original_substantive_source_review","review":"content-review-018.json","sources":["https://data.bibliotheken.nl/id/nbt/p320421678","https://boekenbalie.nl/in-de-naam-van-de-vader-zwarte-beertjes/9789046113639","https://openlibrary.org/works/OL167173W"]},{"type":"cover_front_review","cover_id":13536449,"sha256":"8ca226f927c483bcaf0157e52f72a26de4fdc0a627c8c7b5771394d026a322fc","reference":"cover-semantic-review-002.json","limitation":"Front title/author and source-edition binding; no barcode assertion."}],"review_status":"approved","reviewed_at":"2026-11-02T22:34:17.806Z","review_batch":"nl-scale-20261102-027"}}],"bindings":[{"work":{"id":629,"title":"Mary, Mary","cover_id":null,"subjects":null,"subtitle":null,"author_id":342,"work_type":null,"created_at":"2026-09-02T08:41:16.021419+00:00","source_type":"open_library","open_library_id":"OL167173W","first_publish_year":1857,"native_identity_key":null},"author":{"id":342,"name":"James Patterson","created_at":"2026-09-02T08:38:35.235714+00:00","open_library_id":"OL22258A"}}],"authorCorpora":[]}'::jsonb;a jsonb;b jsonb;actual jsonb;oldrow jsonb;nextrow jsonb;k jsonb;kv record;ids jsonb:='{}';cols text;vals text;predicate text;v_id bigint;i integer:=0;n integer;begin
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
select jsonb_build_object('project','qvplwejffhjvxaypmjut','batch','nl-scale-20261102-027','rows',coalesce(jsonb_agg(to_jsonb(r) order by seq),'[]')) as receipt from catalog_release_receipt r;
rollback;
