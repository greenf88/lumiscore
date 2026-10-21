-- REVIEW ONLY; never restore users/ratings/progress from a snapshot.
-- FIRST revert the PR48 callers if also removing catalog_browse_page_v2.
-- Review all inbound edition references and retain later additions/changes.
-- Fill receipt with the complete four-row JSON result of the committed import.
-- A dry-run receipt is not sufficient (new IDs/timestamps can differ).
-- Default rollback. This is NOT authorization to remove later referenced data.
begin;
set local lock_timeout='3s';
lock table public.editions in share row exclusive mode;
do $recover$
declare receipt jsonb := null; row_receipt jsonb; fk record; used boolean; n integer;
  crawdads_added_id bigint; animal_added_id bigint;
begin
  if receipt is null or jsonb_typeof(receipt)<>'array' or jsonb_array_length(receipt)<>4 then
    raise exception 'Supply the four-row FULL before/after receipt from the actual committed import';
  end if;
  select (r->>'edition_id')::bigint into crawdads_added_id from jsonb_array_elements(receipt) r
    where r->>'action'='added edition' and r->>'work_id'='114' and r->>'isbn'='9789041716149';
  select (r->>'edition_id')::bigint into animal_added_id from jsonb_array_elements(receipt) r
    where r->>'action'='added edition' and r->>'work_id'='1381' and r->>'isbn'='9780451526342';
  if crawdads_added_id is null or animal_added_id is null or crawdads_added_id=animal_added_id
    or (select count(distinct r->>'edition_id') from jsonb_array_elements(receipt) r)<>4 then
    raise exception 'Invalid receipt identities';
  end if;
  if exists(select 1 from jsonb_array_elements(receipt) r where r->>'action'='added edition'
    and r->'before_row' is distinct from 'null'::jsonb) then
    raise exception 'Receipt does not prove these editions were introduced by this import';
  end if;
  -- Hold tuple locks before looking for new references (including CASCADE FKs).
  perform 1 from public.editions where id in (114,1421,crawdads_added_id,animal_added_id) for update;
  for row_receipt in select value from jsonb_array_elements(receipt) loop
    if (select to_jsonb(e) from public.editions e where e.id=(row_receipt->>'edition_id')::bigint)
      is distinct from row_receipt->'after_row' then
      raise exception 'Edition changed since import; keep later changes and stop';
    end if;
  end loop;
  if not exists(select 1 from jsonb_array_elements(receipt) r where r->>'edition_id'='114'
      and r->'before_row'->'language'='null'::jsonb
      and (r->'before_row')-'language'=(r->'after_row')-'language')
    or not exists(select 1 from jsonb_array_elements(receipt) r where r->>'edition_id'='1421'
      and r->'before_row'->'isbn_13'='null'::jsonb
      and (r->'before_row')-'isbn_13'=(r->'after_row')-'isbn_13') then
    raise exception 'Receipt does not prove the two original NULL values';
  end if;
  if not exists(select 1 from public.editions where id=crawdads_added_id and work_id=114
    and title='Daar waar de rivierkreeften zingen' and language='nld' and isbn_13='9789041716149'
    and publisher='Uitgeverij Rainbow' and open_library_edition_id is null)
    or not exists(select 1 from public.editions where id=animal_added_id and work_id=1381
    and title='Animal Farm' and language='eng' and isbn_13='9780451526342'
    and isbn_10='0451526341' and publisher='Signet' and open_library_edition_id='OL7577246M') then
    raise exception 'Added identity changed or absent; stop';
  end if;
  if not exists(select 1 from public.editions where id=114 and work_id=114
    and title='Where the Crawdads Sing' and language='eng' and isbn_13='9780735219090'
    and open_library_edition_id='OL26702293M')
    or not exists(select 1 from public.editions where id=1421 and work_id=1381
    and title='Dierenboerderij' and language='dut' and isbn_10='9041330364'
    and isbn_13='9789041330369' and open_library_edition_id='OL18430168M') then
    raise exception 'Corrected identity changed; stop';
  end if;
  for fk in select c.conrelid::regclass as relation,c.conkey,c.confkey,a.attname
    from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
    where c.contype='f' and c.confrelid='public.editions'::regclass loop
    if cardinality(fk.conkey)<>1 or cardinality(fk.confkey)<>1
      or fk.confkey[1]<>(select attnum from pg_attribute where attrelid='public.editions'::regclass and attname='id') then
      raise exception 'Composite or non-ID edition reference requires manual review';
    end if;
    execute format('select exists(select 1 from %s where %I=any($1))',fk.relation,fk.attname)
      into used using array[crawdads_added_id,animal_added_id];
    if used then raise exception 'Later edition reference in %: keep data and stop',fk.relation; end if;
  end loop;
  -- No CASCADE, no user/rating/status table writes.
  delete from public.editions where id in (crawdads_added_id,animal_added_id);
  get diagnostics n=row_count;
  if n<>2 then raise exception 'Expected two introduced editions'; end if;
  update public.editions set language=null where id=114;
  get diagnostics n=row_count;
  if n<>1 then raise exception 'Expected one language restoration'; end if;
  update public.editions set isbn_13=null where id=1421;
  get diagnostics n=row_count;
  if n<>1 then raise exception 'Expected one ISBN restoration'; end if;
end $recover$;
rollback;
