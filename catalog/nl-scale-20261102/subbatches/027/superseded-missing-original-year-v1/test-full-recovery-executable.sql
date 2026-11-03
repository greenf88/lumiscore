begin;
select set_config('lumiscore.catalog_release_receipt','{"rows":[{"key":{"open_library_edition_id":"OL47139255M"},"seq":1,"relation":"editions","after_row":{"id":987226002,"title":"In naam van de vader","isbn_10":null,"isbn_13":"9789046113639","work_id":987126001,"cover_id":null,"language":"dut","publisher":"Bruna Uitgevers, a.W.","publish_date":null,"open_library_edition_id":"OL47139255M"},"before_row":null},{"key":{"work_id":987126001,"language":"nl"},"seq":2,"relation":"catalog_work_descriptions","after_row":{"text":"Tijdens een vakantie met zijn gezin wordt Alex Cross opgeroepen voor het onderzoek naar de moord op een actrice. Een krant ontvangt kort daarna een bericht waarin de dader de gebeurtenis beschrijft. Het blijkt niet om een op zichzelf staande zaak te gaan. Nieuwe bedreigingen brengen bekende personen in Hollywood in paniek. Cross en de plaatselijke politie moeten een patroon zien te vinden voordat opnieuw iemand wordt gedood, terwijl de berichten het onderzoek steeds nadrukkelijker proberen te sturen.","work_id":987126001,"evidence":[{"note":"ExactDutch9789046113639/KBp320421678 canonical title is Innaamvandevader. Remove source retail /druk1 suffix and extra de, preserve ISBN/OLkey/language/format/cover. AlexCross#11/MaryMary2005, authorJamesPatterson canonicalJamesBrendan; no newWork.","type":"reviewed_identity_and_bibliography","sources":["http://data.bibliotheken.nl/id/nbt/p320421678"],"reference":"work:629","checked_at":"2026-11-02T22:34:17.806Z","supplemental":{"review":"ExactDutch9789046113639/KBp320421678 canonical title is Innaamvandevader. Remove source retail /druk1 suffix and extra de, preserve ISBN/OLkey/language/format/cover. AlexCross#11/MaryMary2005, authorJamesPatterson canonicalJamesBrendan; no newWork.","formatSource":"https://boekenbalie.nl/in-de-naam-van-de-vader-zwarte-beertjes/9789046113639","reviewSources":["https://data.bibliotheken.nl/id/nbt/p320421678","https://boekenbalie.nl/in-de-naam-van-de-vader-zwarte-beertjes/9789046113639"],"originalEditionSha256":"74ba91a12c2ce44330d67dc051f3d7beceea1eb7923d52a251cfe734b5a414ad"},"existingAlternativeReview":null},{"type":"original_substantive_source_review","review":"content-review-018.json","sources":["https://data.bibliotheken.nl/id/nbt/p320421678","https://boekenbalie.nl/in-de-naam-van-de-vader-zwarte-beertjes/9789046113639","https://openlibrary.org/works/OL167173W"]},{"type":"cover_front_review","sha256":"8ca226f927c483bcaf0157e52f72a26de4fdc0a627c8c7b5771394d026a322fc","cover_id":13536449,"reference":"cover-semantic-review-002.json","limitation":"Front title/author and source-edition binding; no barcode assertion."}],"language":"nl","provenance":"original_source_reviewed_summary","source_url":"https://data.bibliotheken.nl/id/nbt/p320421678","reviewed_at":"2026-11-02T22:34:17.806+00:00","source_name":"Gecontroleerde boek- en catalogusbronnen","source_type":"official_catalog","review_batch":"nl-scale-20261102-027","review_status":"approved","bound_author_id":946300342},"before_row":null},{"key":{"edition_id":987226002},"seq":3,"relation":"catalog_edition_metadata","after_row":{"format":"paperback","work_id":987126001,"evidence":[{"note":"ExactDutch9789046113639/KBp320421678 canonical title is Innaamvandevader. Remove source retail /druk1 suffix and extra de, preserve ISBN/OLkey/language/format/cover. AlexCross#11/MaryMary2005, authorJamesPatterson canonicalJamesBrendan; no newWork.","type":"reviewed_identity_and_bibliography","sources":["http://data.bibliotheken.nl/id/nbt/p320421678"],"reference":"work:629","checked_at":"2026-11-02T22:34:17.806Z","supplemental":{"review":"ExactDutch9789046113639/KBp320421678 canonical title is Innaamvandevader. Remove source retail /druk1 suffix and extra de, preserve ISBN/OLkey/language/format/cover. AlexCross#11/MaryMary2005, authorJamesPatterson canonicalJamesBrendan; no newWork.","formatSource":"https://boekenbalie.nl/in-de-naam-van-de-vader-zwarte-beertjes/9789046113639","reviewSources":["https://data.bibliotheken.nl/id/nbt/p320421678","https://boekenbalie.nl/in-de-naam-van-de-vader-zwarte-beertjes/9789046113639"],"originalEditionSha256":"74ba91a12c2ce44330d67dc051f3d7beceea1eb7923d52a251cfe734b5a414ad"},"existingAlternativeReview":null},{"type":"original_substantive_source_review","review":"content-review-018.json","sources":["https://data.bibliotheken.nl/id/nbt/p320421678","https://boekenbalie.nl/in-de-naam-van-de-vader-zwarte-beertjes/9789046113639","https://openlibrary.org/works/OL167173W"]},{"type":"cover_front_review","sha256":"8ca226f927c483bcaf0157e52f72a26de4fdc0a627c8c7b5771394d026a322fc","cover_id":13536449,"reference":"cover-semantic-review-002.json","limitation":"Front title/author and source-edition binding; no barcode assertion."}],"cover_url":"https://covers.openlibrary.org/b/id/13536449-L.jpg?default=false","edition_id":987226002,"bound_title":"In naam van de vader","reviewed_at":"2026-11-02T22:34:17.806+00:00","bound_isbn13":"9789046113639","evidence_url":"https://data.bibliotheken.nl/id/nbt/p320421678","review_batch":"nl-scale-20261102-027","review_status":"approved","bound_language":"dut","card_cover_url":"https://covers.openlibrary.org/b/id/13536449-M.jpg?default=false","bound_author_id":946300342},"before_row":null}],"batch":"nl-scale-20261102-027","project":"hlvujbrmfdlrfxdjwsmb"}',false);
-- REVIEW ONLY. Receipt from FIRST successful COMMIT required; a dry-run receipt is forbidden.
-- Load the exact approved receipt via parameterized set_config('lumiscore.catalog_release_receipt',$1,false).
-- Only receipt rows; full-row CAS, parent locks, every incoming FK including CASCADE; later changes abort all.
set local lock_timeout='3s';set local statement_timeout='30s';
lock table public.authors,public.works,public.editions,public.catalog_work_descriptions,public.catalog_edition_metadata in share row exclusive mode;
do $undo$ declare receipt jsonb;r jsonb;actual jsonb;dep record;n bigint;cols text;k jsonb;predicate text;allowed_keys text[];begin
 receipt:=nullif(current_setting('lumiscore.catalog_release_receipt',true),'')::jsonb;
 if receipt->>'project' is distinct from 'hlvujbrmfdlrfxdjwsmb' or receipt->>'batch' is distinct from 'nl-scale-20261102-027' or jsonb_typeof(receipt->'rows') is distinct from 'array' or jsonb_array_length(receipt->'rows')<>3 then raise exception 'Exact first committed receipt required';end if;
 for r in select value from jsonb_array_elements(receipt->'rows') order by (value->>'seq')::integer desc loop
  if r->>'relation' not in ('authors','works','editions','catalog_work_descriptions','catalog_edition_metadata') then raise exception 'Unreviewed receipt relation';end if;
  k:=r->'key';allowed_keys:=case r->>'relation' when 'authors' then array['id','open_library_id'] when 'works' then array['id','native_identity_key','open_library_id'] when 'editions' then array['id','open_library_edition_id','isbn_13','isbn_10'] when 'catalog_work_descriptions' then array['work_id','language'] else array['edition_id'] end;
  if jsonb_typeof(k)<>'object' or not exists(select 1 from jsonb_each(k)) or exists(select 1 from jsonb_each(k) where not key=any(allowed_keys) or value='null'::jsonb) then raise exception 'Invalid receipt identity key';end if;
  select string_agg(format('t.%I=(jsonb_populate_record(null::public.%I,$1)).%I',key,r->>'relation',key),' and ' order by key) into predicate from jsonb_each(k);
  execute format('select to_jsonb(t) from public.%I t where %s for update',r->>'relation',predicate) into actual using k;
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
   execute format('delete from public.%I t where %s',r->>'relation',predicate) using k;
  else
   select string_agg(format('%I=(jsonb_populate_record(null::public.%I,$1)).%I',key,r->>'relation',key),',') into cols from jsonb_each(r->'before_row') where value is distinct from r->'after_row'->key;
   execute format('update public.%I t set %s where %s',r->>'relation',cols,replace(predicate,'$1','$2')) using r->'before_row',k;
  end if;
 end loop;
end;$undo$;
select set_config('lumiscore.catalog_release_receipt','{"rows":[{"key":{"native_identity_key":"nlscale:fixture027:629"},"seq":1,"relation":"works","after_row":{"id":987126001,"title":"Mary, Mary","cover_id":null,"author_id":946300342,"work_type":null,"source_type":"open_library","open_library_id":"OL167173W","first_publish_year":1857,"native_identity_key":"nlscale:fixture027:629"},"before_row":null},{"key":{"open_library_edition_id":"OL22235932M"},"seq":2,"relation":"editions","after_row":{"id":987226001,"title":"Mary, Mary","isbn_10":null,"isbn_13":"9780466619035","work_id":987126001,"cover_id":null,"language":null,"publisher":"Warner Books","publish_date":null,"open_library_edition_id":"OL22235932M"},"before_row":null}],"batch":"nl-scale-20261102-027-fixture","project":"hlvujbrmfdlrfxdjwsmb"}',false);
-- REVIEW ONLY. Receipt from FIRST successful COMMIT required; a dry-run receipt is forbidden.
-- Load the exact approved receipt via parameterized set_config('lumiscore.catalog_release_receipt',$1,false).
-- Only receipt rows; full-row CAS, parent locks, every incoming FK including CASCADE; later changes abort all.
set local lock_timeout='3s';set local statement_timeout='30s';
lock table public.authors,public.works,public.editions,public.catalog_work_descriptions,public.catalog_edition_metadata in share row exclusive mode;
do $undo$ declare receipt jsonb;r jsonb;actual jsonb;dep record;n bigint;cols text;k jsonb;predicate text;allowed_keys text[];begin
 receipt:=nullif(current_setting('lumiscore.catalog_release_receipt',true),'')::jsonb;
 if receipt->>'project' is distinct from 'hlvujbrmfdlrfxdjwsmb' or receipt->>'batch' is distinct from 'nl-scale-20261102-027-fixture' or jsonb_typeof(receipt->'rows') is distinct from 'array' or jsonb_array_length(receipt->'rows')<>2 then raise exception 'Exact first committed receipt required';end if;
 for r in select value from jsonb_array_elements(receipt->'rows') order by (value->>'seq')::integer desc loop
  if r->>'relation' not in ('authors','works','editions','catalog_work_descriptions','catalog_edition_metadata') then raise exception 'Unreviewed receipt relation';end if;
  k:=r->'key';allowed_keys:=case r->>'relation' when 'authors' then array['id','open_library_id'] when 'works' then array['id','native_identity_key','open_library_id'] when 'editions' then array['id','open_library_edition_id','isbn_13','isbn_10'] when 'catalog_work_descriptions' then array['work_id','language'] else array['edition_id'] end;
  if jsonb_typeof(k)<>'object' or not exists(select 1 from jsonb_each(k)) or exists(select 1 from jsonb_each(k) where not key=any(allowed_keys) or value='null'::jsonb) then raise exception 'Invalid receipt identity key';end if;
  select string_agg(format('t.%I=(jsonb_populate_record(null::public.%I,$1)).%I',key,r->>'relation',key),' and ' order by key) into predicate from jsonb_each(k);
  execute format('select to_jsonb(t) from public.%I t where %s for update',r->>'relation',predicate) into actual using k;
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
   execute format('delete from public.%I t where %s',r->>'relation',predicate) using k;
  else
   select string_agg(format('%I=(jsonb_populate_record(null::public.%I,$1)).%I',key,r->>'relation',key),',') into cols from jsonb_each(r->'before_row') where value is distinct from r->'after_row'->key;
   execute format('update public.%I t set %s where %s',r->>'relation',cols,replace(predicate,'$1','$2')) using r->'before_row',k;
  end if;
 end loop;
end;$undo$;
commit;
