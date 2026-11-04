-- REVIEW ONLY. Receipt from FIRST successful COMMIT required; a dry-run receipt is forbidden.
-- Load the exact approved receipt via parameterized set_config('lumiscore.catalog_release_receipt',$1,false).
-- Only receipt rows; full-row CAS, parent locks, every incoming FK including CASCADE; later changes abort all.
begin;set local lock_timeout='3s';set local statement_timeout='30s';
lock table public.authors,public.works,public.editions,public.catalog_work_descriptions,public.catalog_edition_metadata in share row exclusive mode;
do $parents$ declare b jsonb;a jsonb;begin
for b in select value from jsonb_array_elements('[{"id":10,"name":"Paulo Coelho","created_at":"2026-09-01T06:02:09.376053+00:00","open_library_id":"OL66700A"},{"id":125,"name":"Sarah J. Maas","created_at":"2026-09-02T08:25:06.499577+00:00","open_library_id":"OL7115219A"},{"id":129,"name":"Franz Kafka","created_at":"2026-09-02T08:25:14.657323+00:00","open_library_id":"OL33146A"},{"id":5216,"name":"Bertrice Small","created_at":"2026-10-03T17:13:22.654831+00:00","open_library_id":"OL192030A"}]'::jsonb) loop
select to_jsonb(t) into a from public.authors t where id=(b->>'id')::bigint;
if a is distinct from b then raise exception 'Retained author drift; stop';end if;end loop;
for b in select value from jsonb_array_elements('[{"id":6431,"title":"De heks van Portobello","isbn_10":"9029564733","isbn_13":"9789029564731","work_id":6272,"language":"dut","publisher":"De Arbeiderspers","created_at":"2026-10-03T17:13:22.654831+00:00","open_library_edition_id":"OL35326067M"},{"id":2191,"title":"Crown of Midnight","isbn_10":"1619630621","isbn_13":"9781619630628","work_id":1995,"language":"eng","publisher":"Bloomsbury","created_at":"2026-09-16T20:27:51.329297+00:00","open_library_edition_id":"OL25434819M"},{"id":1976,"title":"The Castle","isbn_10":"0679417354","isbn_13":"9780679417354","work_id":1824,"language":"eng","publisher":"Everyman''s Library","created_at":"2026-09-16T15:20:39.218272+00:00","open_library_edition_id":"OL7698685M"},{"id":8942,"title":"Skye O''Malley","isbn_10":"0345292561","isbn_13":"9780345292568","work_id":8783,"language":"eng","publisher":"Ballantine Books","created_at":"2026-10-03T17:13:22.654831+00:00","open_library_edition_id":"OL10683537M"}]'::jsonb) loop
select to_jsonb(e) into a from public.editions e where id=(b->>'id')::bigint;
if a is distinct from b then raise exception 'Exact edition drift; stop';end if;end loop;
for b in select value from jsonb_array_elements('[{"text":"Landmeter K. komt aan in een dorp dat onder het gezag van een slot staat. Hij probeert toegang te krijgen tot de autoriteiten, maar raakt verstrikt in onduidelijke boodschappen, tussenpersonen en tegenstrijdige verwachtingen. Ook de dorpsbewoners bieden hem geen vaste plaats. Hoe meer K. zijn positie probeert op te helderen, hoe moeilijker de verhoudingen te begrijpen lijken. In deze onvoltooide roman onderzoekt Kafka een bestaan waarin het verlangen naar erkenning steeds stuit op een bestuur dat onbereikbaar blijft.","work_id":1824,"evidence":[{"note":"Kafka’s unfinished DasSchloss novel. Querido hardback is explicit print; summary explicitly retains unfinished status. Exact current source-edition key is already present; fill its absent ISBN from bound independent KB records, never insert a duplicate edition. Only Pijpelijntjes additionally needs NULL-language→dut based on exact KB language evidence.","type":"reviewed_identity_and_bibliography","sources":["http://data.bibliotheken.nl/id/nbt/p830918485"],"reference":"work:1824","checked_at":"2026-11-02T19:45:00.000Z","canonical_name_resolution":null},{"type":"original_substantive_source_review","review":"content-review-021.json","sources":["https://openlibrary.org/works/OL498434W","https://data.bibliotheken.nl/id/nbt/p830918485"]},{"type":"cover_front_review","sha256":"af55d27f8cbbe31bc7c1bd05896ac1b09ef35976932dad9e6132c20f5f813047","cover_id":6765467,"reference":"cover-semantic-review-010.json","limitation":"Actually read cover-large/sheet-001.jpg. Franz Kafka; Het slot; Querido. Front identity and source-edition attachment are corroboration, not proof of a visible barcode, printing year, language or complete contents. Bibliographic checks remain separate."}],"language":"nl","provenance":"original_source_reviewed_summary","source_url":"https://openlibrary.org/works/OL498434W","reviewed_at":"2026-11-02T19:45:00+00:00","source_name":"Gecontroleerde boek- en catalogusbronnen","source_type":"official_catalog","review_batch":"nl-scale-20261102-011","review_status":"approved","bound_author_id":129}]'::jsonb) loop
select to_jsonb(d) into a from public.catalog_work_descriptions d where work_id=(b->>'work_id')::bigint and language=b->>'language';
if a is distinct from b then raise exception 'Retained summary drift; stop';end if;end loop;
end;$parents$;
do $undo$ declare receipt jsonb;r jsonb;actual jsonb;dep record;n bigint;cols text;k jsonb;predicate text;allowed_keys text[];begin
 receipt:=nullif(current_setting('lumiscore.catalog_release_receipt',true),'')::jsonb;
 if receipt->>'project' is distinct from 'qvplwejffhjvxaypmjut' or receipt->>'batch' is distinct from 'description-recovery-20261104' or jsonb_typeof(receipt->'rows') is distinct from 'array' or jsonb_array_length(receipt->'rows')<>4 then raise exception 'Exact first committed receipt required';end if;
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
end;$undo$;commit;
