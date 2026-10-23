-- REVIEW ONLY. Populate receipt from actual COMMITTED import (not a dry-run).
-- Default rollback; only these introduced editions may be removed after approval.
-- No ratings/status/Work/collection writes. Never restore whole tables.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
lock table public.editions in share row exclusive mode;
do $recover$
declare receipt jsonb:=null; r jsonb; fk record; used boolean; n integer;
begin
  if receipt is null or jsonb_typeof(receipt)<>'array' or jsonb_array_length(receipt)<>3 then
    raise exception 'Supply FULL three-row committed receipt'; end if;
  if (select count(distinct x->>'isbn') from jsonb_array_elements(receipt) x
    where x->>'action'='added edition' and x->'before_row'='null'::jsonb
      and x->>'isbn' in ('9780064471107','9780440418566','9781837901326'))<>3 then
    raise exception 'Receipt does not prove exactly these three introductions'; end if;
  for r in select value from jsonb_array_elements(receipt) loop
    if (r->'after_row'->>'id')::bigint is distinct from (r->>'edition_id')::bigint
      or (r->'after_row'->>'work_id')::bigint is distinct from (r->>'work_id')::bigint
      or r->'after_row'->>'isbn_13' is distinct from r->>'isbn'
      or r->'after_row'->>'language' is distinct from 'eng'
      or not ((r->>'isbn'='9780064471107' and r->>'work_id' in ('148','924100148') and r->'after_row'->>'open_library_edition_id'='OL7292690M')
        or (r->>'isbn'='9780440418566' and r->>'work_id' in ('228','924100228') and r->'after_row'->>'open_library_edition_id'='OL7521619M')
        or (r->>'isbn'='9781837901326' and r->>'work_id' in ('553','924100553') and r->'after_row'->>'open_library_edition_id'='OL46530123M')) then
      raise exception 'Receipt identity outside the three approved candidates'; end if;
    perform 1 from public.editions where id=(r->>'edition_id')::bigint for update;
    if (select to_jsonb(e) from public.editions e where e.id=(r->>'edition_id')::bigint) is distinct from r->'after_row' then
      raise exception 'Later edition changes: keep them and stop'; end if;
    for fk in select c.conrelid::regclass as relation,c.conkey,c.confkey,a.attname from pg_constraint c
      join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1]
      where c.contype='f' and c.confrelid='public.editions'::regclass loop
      if cardinality(fk.conkey)<>1 or cardinality(fk.confkey)<>1
        or fk.confkey[1]<>(select attnum from pg_attribute where attrelid='public.editions'::regclass and attname='id') then
        raise exception 'Unreviewed composite/non-ID edition reference'; end if;
      execute format('select exists(select 1 from %s where %I=$1)',fk.relation,fk.attname) into used using (r->>'edition_id')::bigint;
      if used then raise exception 'New edition reference in %; stop without deleting',fk.relation; end if;
    end loop;
    delete from public.editions where id=(r->>'edition_id')::bigint;
    get diagnostics n=row_count;
    if n<>1 then raise exception 'Expected exactly one introduced edition'; end if;
  end loop;
end $recover$;
rollback;
