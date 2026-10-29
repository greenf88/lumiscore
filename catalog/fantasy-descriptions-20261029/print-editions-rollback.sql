-- REVIEW ONLY. Production qvplwejffhjvxaypmjut. Default ROLLBACK.
-- Replace [] below with the FULL two-row COMMIT receipt from production.
-- Never use the dry-run receipt: rolled-back sequence IDs are intentionally consumed.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
lock table public.editions in share row exclusive mode;
create temporary table print_saved_receipt on commit drop as
 select value row_data from jsonb_array_elements('[]'::jsonb);
do $restore$
declare row record; dependency record; referenced boolean; existing_count integer;
begin
 if not exists(select 1 from public.works where id=14 and open_library_id='OL450063W')
 or not exists(select 1 from public.works where id=22 and open_library_id='OL59798W')
 then raise exception 'Wrong target';end if;
 if(select count(*) from print_saved_receipt)<>2
 or(select count(distinct row_data->>'edition_id') from print_saved_receipt)<>2
 or(select count(distinct row_data->>'isbn13') from print_saved_receipt)<>2
 or exists(select 1 from print_saved_receipt where row_data->>'action'<>'added English print edition'
 or row_data->>'isbn13' not in('9780141439471','9780553383041')
 or (row_data->>'edition_id')::bigint in(14,22)
 or (row_data->>'work_id')::bigint not in(14,22)) then raise exception 'Actual two-row COMMIT receipt required';end if;
 for row in select row_data from print_saved_receipt loop
  if exists(select 1 from public.editions e where e.id=(row.row_data->>'edition_id')::bigint
    and to_jsonb(e) is distinct from row.row_data->'after_row')
  then raise exception 'Later legitimate edition change; retain row and stop';end if;
  if exists(select 1 from public.editions e where e.isbn_13=row.row_data->>'isbn13'
    and e.id<>(row.row_data->>'edition_id')::bigint) then raise exception 'Later ISBN identity; stop';end if;
 end loop;
 select count(*) into existing_count from public.editions e join print_saved_receipt r on e.id=(r.row_data->>'edition_id')::bigint;
 if existing_count not in(0,2) then raise exception 'Partial rollback state; stop';end if;
 for dependency in select c.conrelid::regclass relation,a.attname column_name from pg_constraint c
 join pg_attribute a on a.attrelid=c.conrelid and a.attnum=any(c.conkey)
 where c.contype='f' and c.confrelid='public.editions'::regclass loop
  execute format('select exists(select 1 from %s where %I in(select (row_data->>''edition_id'')::bigint from print_saved_receipt))',dependency.relation,dependency.column_name) into referenced;
  if referenced then raise exception 'Later edition dependency in %; retain edition',dependency.relation;end if;
 end loop;
end $restore$;
delete from public.editions e using print_saved_receipt r where e.id=(r.row_data->>'edition_id')::bigint;
-- Never delete/restore Works, authors, ratings, accounts or reading progress; never reset sequence.
rollback;
