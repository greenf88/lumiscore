-- TEST ONLY hlvujbrmfdlrfxdjwsmb. Proposal only, not executed.
begin;
DO $guard$ declare ref record; dependent boolean; begin
 if not exists(select 1 from public.works where id=91021001 and open_library_id='OL893414W') then raise exception 'Wrong target'; end if;
 if exists(select 1 from public.works where id in(929100014,929100022) and not((id=929100014 and open_library_id='OL450063W' and author_id=929300014 and title='Frankenstein; or, The Modern Prometheus' and first_publish_year=1818) or (id=929100022 and open_library_id='OL59798W' and author_id=921300017 and title='A Wizard of Earthsea' and first_publish_year=1968))) then raise exception 'Later Work change'; end if;
 if exists(select 1 from public.editions where work_id in(929100014,929100022) and id not in(929200014,929200022)) then raise exception 'Later edition added; retain it'; end if;
 if exists(select 1 from public.editions where id in(929200014,929200022) and not((id=929200014 and work_id=929100014 and open_library_edition_id='OL26385062M' and isbn_13='9788415089452' and language is null) or (id=929200022 and work_id=929100022 and open_library_edition_id='OL10635933M' and isbn_13='9780563389163' and language is null))) then raise exception 'Later edition change'; end if;
 for ref in select c.conrelid::regclass relation,a.attname column_name from pg_constraint c join pg_attribute a on a.attrelid=c.conrelid and a.attnum=c.conkey[1] where c.contype='f' and c.confrelid='public.works'::regclass and c.conrelid<>'public.editions'::regclass
 loop execute format('select exists(select 1 from %s where %I in(929100014,929100022))',ref.relation,ref.column_name) into dependent; if dependent then raise exception 'Later dependent data in %; stop',ref.relation; end if; end loop;
end $guard$;
delete from public.editions where id in(929200014,929200022);
delete from public.works where id in(929100014,929100022);
delete from public.authors a where a.id=929300014 and a.name='Mary Shelley' and a.open_library_id='OL25342A' and not exists(select 1 from public.works w where w.author_id=a.id);
-- Reused Ursula K. Le Guin never deleted. FK restrictions remain in force.
rollback;
