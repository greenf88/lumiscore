-- REVIEW ONLY. Not applied to production in this task.
-- Target qvplwejffhjvxaypmjut; one edition language, no new Work or user data.
-- Evidence: https://metadata.isbn.nl/1140933/nee-heb-je.html
-- Exact paperback 9789022585979, language Nederlands, 04-02-2019.
-- Publisher copyright page confirms author/title/ISBN:
-- https://www.boekerij.nl/sites/default/files/books/issuu/9789022585979.pdf
begin;
set local lock_timeout='3s';
do $$
declare current_language text;
begin
 select e.language into current_language from public.editions e
 join public.works w on w.id=e.work_id join public.authors a on a.id=w.author_id
 where e.id=1191 and w.id=1191 and w.open_library_id='OL24326852W'
 and e.open_library_edition_id='OL32196483M' and e.isbn_13='9789022585979'
 and e.title='Nee heb je' and w.title='Nee heb je' and a.open_library_id='OL9150900A'
 for update of e;
 if not found then raise exception 'Exact identity changed; stop'; end if;
 if current_language is not null and current_language<>'nld' then raise exception 'Unexpected current language; stop'; end if;
 update public.editions set language='nld' where id=1191 and language is null;
end $$;
select id,work_id,isbn_13,language from public.editions where id=1191;
commit;
-- Repeat is zero-write. Initial expected changes: one NULL -> nld.
-- Guarded recovery, ONLY if this receipt was applied and identity is unchanged:
-- update public.editions set language=null where id=1191 and work_id=1191
-- and isbn_13='9789022585979' and open_library_edition_id='OL32196483M' and language='nld';
-- Stop if a later review has changed the row; never restore whole tables.
