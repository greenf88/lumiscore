-- PENDING PRODUCTION APPROVAL: two language corrections +two exact edition additions.
-- PROPOSAL ONLY. Not applied to production or test. No build/import hook.
-- Default is dry-run ROLLBACK. Requires exact target and separately reviewed release.
begin;
create temporary table editorial_language_plan(id bigint,work_id bigint,title text,isbn13 text,olid text,new_language text) on commit drop;
insert into editorial_language_plan values
(179,179,'Divergent','9780062024022','OL24914469M','eng'),
(199,199,'The Testaments','9780385543781','OL27306829M','eng');
do $$ begin
 if exists(select 1 from editorial_language_plan p left join public.editions e on e.id=p.id where e.id is null or e.work_id<>p.work_id or e.title is distinct from p.title or e.isbn_13 is distinct from p.isbn13 or e.open_library_edition_id is distinct from p.olid or (e.language is not null and e.language<>p.new_language)) then raise exception 'Edition preimage mismatch; no partial correction'; end if;
 if not exists(select 1 from public.works where id=2600 and title='Oryx and Crake' and open_library_id='OL675722W') then raise exception 'Oryx Work identity mismatch'; end if;
 if exists(select 1 from public.editions where (isbn_13='9780385721677' or open_library_edition_id='OL39470791M') and (work_id<>2600 or title is distinct from 'Oryx and Crake' or isbn_13 is distinct from '9780385721677' or open_library_edition_id is distinct from 'OL39470791M' or language is distinct from 'eng')) then raise exception 'Oryx edition collision; review instead of overwrite'; end if;
 if not exists(select 1 from public.works where id=100 and title='The Giver' and open_library_id='OL1846076W') then raise exception 'Giver Work mismatch'; end if;
 if exists(select 1 from public.editions where (isbn_13='9780385732550' or open_library_edition_id='OL7441983M') and (work_id<>100 or title is distinct from 'The Giver' or language is distinct from 'eng')) then raise exception 'Giver edition collision'; end if;
end $;
update public.editions e set language=p.new_language from editorial_language_plan p where e.id=p.id and e.language is null returning e.id,e.work_id,e.language;
insert into public.editions(work_id,title,isbn_10,isbn_13,language,publisher,open_library_edition_id) select 2600,'Oryx and Crake','0385721676','9780385721677','eng','Anchor Books','OL39470791M' where not exists(select 1 from public.editions where isbn_13='9780385721677' or open_library_edition_id='OL39470791M') returning id,work_id;
-- Capture RETURNING receipts before any separately approved COMMIT. Repeating
-- after a successful apply changes zero languages and adds zero editions.
insert into public.editions(work_id,title,isbn_10,isbn_13,language,publisher,open_library_edition_id) select 100,'The Giver','0385732554','9780385732550','eng','Delacorte Books for Young Readers','OL7441983M' where not exists(select 1 from public.editions where isbn_13='9780385732550' or open_library_edition_id='OL7441983M') returning id,work_id;
rollback;
-- Rollback after a future apply: use its receipt only. Restore NULL solely on
-- receipt language IDs whose exact identity/current language is unchanged;
-- remove only the newly receipt-created Oryx edition if no dependent rows exist.
-- Never delete a pre-existing edition, Work, rating, status, membership or round.
