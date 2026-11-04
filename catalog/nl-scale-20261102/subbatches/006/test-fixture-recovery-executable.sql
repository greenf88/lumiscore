select set_config('lumiscore.catalog_release_receipt','{"rows":[{"key":{"open_library_id":"OL24837A"},"seq":1,"relation":"authors","after_row":{"id":987305001,"name":"Tess Gerritsen","open_library_id":"OL24837A"},"before_row":null},{"key":{"open_library_id":"OL18865A"},"seq":2,"relation":"authors","after_row":{"id":987305002,"name":"Megan McDonald","open_library_id":"OL18865A"},"before_row":null},{"key":{"native_identity_key":"nlscale:fixture006:282"},"seq":3,"relation":"works","after_row":{"id":987105001,"title":"Eaters of the Dead","cover_id":null,"author_id":987304002,"work_type":null,"source_type":"open_library","open_library_id":"OL46873W","first_publish_year":1976,"native_identity_key":"nlscale:fixture006:282"},"before_row":null},{"key":{"native_identity_key":"nlscale:fixture006:562"},"seq":4,"relation":"works","after_row":{"id":987105002,"title":"Honeymoon","cover_id":null,"author_id":946300342,"work_type":null,"source_type":"open_library","open_library_id":"OL167160W","first_publish_year":2001,"native_identity_key":"nlscale:fixture006:562"},"before_row":null},{"key":{"native_identity_key":"nlscale:fixture006:607"},"seq":5,"relation":"works","after_row":{"id":987105003,"title":"The Surgeon","cover_id":null,"author_id":987305001,"work_type":null,"source_type":"open_library","open_library_id":"OL14871640W","first_publish_year":2001,"native_identity_key":"nlscale:fixture006:607"},"before_row":null},{"key":{"native_identity_key":"nlscale:fixture006:5654"},"seq":6,"relation":"works","after_row":{"id":987105004,"title":"Judy Moody","cover_id":null,"author_id":987305002,"work_type":null,"source_type":null,"open_library_id":"OL443606W","first_publish_year":2000,"native_identity_key":"nlscale:fixture006:5654"},"before_row":null},{"key":{"open_library_edition_id":"OL10686520M"},"seq":7,"relation":"editions","after_row":{"id":987205001,"title":"Eaters of the Dead/13th Warrior (15M/Troll Associates)","isbn_10":null,"isbn_13":"9780345917270","work_id":987105001,"cover_id":null,"language":null,"publisher":"Ballantine Books","publish_date":null,"open_library_edition_id":"OL10686520M"},"before_row":null},{"key":{"open_library_edition_id":"OL10263160M"},"seq":8,"relation":"editions","after_row":{"id":987205002,"title":"Honeymoon","isbn_10":null,"isbn_13":"9780446694216","work_id":987105002,"cover_id":null,"language":null,"publisher":"Warner Books","publish_date":null,"open_library_edition_id":"OL10263160M"},"before_row":null},{"key":{"open_library_edition_id":"OL10658842M"},"seq":9,"relation":"editions","after_row":{"id":987205003,"title":"The Surgeon","isbn_10":null,"isbn_13":"9780739420416","work_id":987105003,"cover_id":null,"language":null,"publisher":"The Ballantine Publishing Group","publish_date":null,"open_library_edition_id":"OL10658842M"},"before_row":null},{"key":{"open_library_edition_id":"OL35611866M"},"seq":10,"relation":"editions","after_row":{"id":987205004,"title":"Judy Moody Geliyor 1","isbn_10":"6054482548","isbn_13":"9786054482542","work_id":987105004,"cover_id":null,"language":"dut","publisher":"Artemis Yaynlar","publish_date":null,"open_library_edition_id":"OL35611866M"},"before_row":null}],"batch":"nl-scale-20261102-006-fixture","project":"hlvujbrmfdlrfxdjwsmb"}',false);
-- REVIEW ONLY. Receipt from FIRST successful COMMIT required; a dry-run receipt is forbidden.
-- Load the exact approved receipt via parameterized set_config('lumiscore.catalog_release_receipt',$1,false).
-- Only receipt rows; full-row CAS, parent locks, every incoming FK including CASCADE; later changes abort all.
begin;set local lock_timeout='3s';set local statement_timeout='30s';
lock table public.authors,public.works,public.editions,public.catalog_work_descriptions,public.catalog_edition_metadata in share row exclusive mode;
do $undo$ declare receipt jsonb;r jsonb;actual jsonb;dep record;n bigint;cols text;begin
 receipt:=nullif(current_setting('lumiscore.catalog_release_receipt',true),'')::jsonb;
 if receipt->>'project' is distinct from 'hlvujbrmfdlrfxdjwsmb' or receipt->>'batch' is distinct from 'nl-scale-20261102-006-fixture' or jsonb_typeof(receipt->'rows') is distinct from 'array' or jsonb_array_length(receipt->'rows')<>10 then raise exception 'Exact first committed receipt required';end if;
 for r in select value from jsonb_array_elements(receipt->'rows') order by (value->>'seq')::integer desc loop
  if r->>'relation' not in ('authors','works','editions','catalog_work_descriptions','catalog_edition_metadata') then raise exception 'Unreviewed receipt relation';end if;
  execute format('select to_jsonb(t) from public.%I t where to_jsonb(t) @> $1 for update',r->>'relation') into actual using r->'key';
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
   execute format('delete from public.%I t where to_jsonb(t) @> $1',r->>'relation') using r->'key';
  else
   select string_agg(format('%I=(jsonb_populate_record(null::public.%I,$1)).%I',key,r->>'relation',key),',') into cols from jsonb_each(r->'before_row') where value is distinct from r->'after_row'->key;
   execute format('update public.%I t set %s where to_jsonb(t) @> $2',r->>'relation',cols) using r->'before_row',r->'key';
  end if;
 end loop;
end;$undo$;commit;
