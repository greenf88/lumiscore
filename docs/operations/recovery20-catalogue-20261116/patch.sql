-- Target: qvplwejffhjvxaypmjut. One atomic correction; fail on any identity/value drift.
-- No schema, author, reader, rating or permissions changes.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
do $correction$
declare affected integer;
begin
update public.works set title='Koppensnellers, uitrangeerders en selecteurs' where id is not distinct from 5297 and open_library_id is not distinct from 'OL26414790W' and author_id is not distinct from 2726 and title is not distinct from 'Koppensnellers, uitrangeerders en selecteurs (Headhunters and selectors)';
get diagnostics affected=row_count;
if affected<>1 then raise exception 'works 5297: correction drift';end if;
update public.editions set title='Koppensnellers, uitrangeerders en selecteurs' where id is not distinct from 5456 and work_id is not distinct from 5297 and open_library_edition_id is not distinct from 'OL35663776M' and isbn_13 is not distinct from '9789034105974' and language is not distinct from 'dut' and title is not distinct from 'Koppensnellers, uitrangeerders en selecteurs (Jeadhunters and selectors)';
get diagnostics affected=row_count;
if affected<>1 then raise exception 'editions 5456: correction drift';end if;
update public.works set title='Viglius van Aytta als hoogleraar te Ingolstadt' where id is not distinct from 5566 and open_library_id is not distinct from 'OL13845580W' and author_id is not distinct from 2979 and title is not distinct from 'Viglius van Aytta als hoogleeraar te Ingolstadt';
get diagnostics affected=row_count;
if affected<>1 then raise exception 'works 5566: correction drift';end if;
update public.editions set title='Viglius van Aytta als hoogleraar te Ingolstadt' where id is not distinct from 5725 and work_id is not distinct from 5566 and open_library_edition_id is not distinct from 'OL23648916M' and isbn_13 is not distinct from '9789071478772' and language is not distinct from 'dut' and title is not distinct from 'Viglius van Aytta als hoogleeraar te Ingolstadt';
get diagnostics affected=row_count;
if affected<>1 then raise exception 'editions 5725: correction drift';end if;
update public.works set title='Diego Rivera: Illustrious Words, 1886–1921',first_publish_year=2007 where id is not distinct from 7434 and open_library_id is not distinct from 'OL2156995W' and author_id is not distinct from 4323 and title is not distinct from 'Diego Rivera' and first_publish_year is not distinct from 1929;
get diagnostics affected=row_count;
if affected<>1 then raise exception 'works 7434: correction drift';end if;
update public.editions set title='Diego Rivera: Illustrious Words, 1886–1921' where id is not distinct from 7593 and work_id is not distinct from 7434 and open_library_edition_id is not distinct from 'OL23167065M' and isbn_13 is not distinct from '9789708021128' and language is not distinct from 'eng' and title is not distinct from 'Diego Rivera';
get diagnostics affected=row_count;
if affected<>1 then raise exception 'editions 7593: correction drift';end if;
update public.works set first_publish_year=1978 where id is not distinct from 9937 and title is not distinct from 'The Broken Link' and open_library_id is not distinct from 'OL15714082W' and author_id is not distinct from 5148 and first_publish_year is not distinct from 1979;
get diagnostics affected=row_count;
if affected<>1 then raise exception 'works 9937: correction drift';end if;
update public.editions set isbn_13='9780263726503',publisher='Mills & Boon Limited' where id is not distinct from 10096 and work_id is not distinct from 9937 and title is not distinct from 'The Broken Link' and open_library_edition_id is not distinct from 'OL24228997M' and isbn_10 is not distinct from '0263726509' and language is not distinct from 'eng' and isbn_13 is not distinct from '9780373708185' and publisher is not distinct from 'Harlequin Books';
get diagnostics affected=row_count;
if affected<>1 then raise exception 'editions 10096: correction drift';end if;
update public.works set first_publish_year=2005 where id is not distinct from 7666 and title is not distinct from 'Fertility, Food and Fever' and open_library_id is not distinct from 'OL8464207W' and author_id is not distinct from 4519 and first_publish_year is not distinct from 2004;
get diagnostics affected=row_count;
if affected<>1 then raise exception 'works 7666: correction drift';end if;
update public.editions set isbn_13='9789067182096',isbn_10='9067182095' where id is not distinct from 7825 and work_id is not distinct from 7666 and title is not distinct from 'Fertility, Food and Fever' and open_library_edition_id is not distinct from 'OL9456769M' and language is not distinct from 'eng' and isbn_13 is not distinct from '9789067181655' and isbn_10 is not distinct from '906718165X';
get diagnostics affected=row_count;
if affected<>1 then raise exception 'editions 7825: correction drift';end if;
end $correction$;
commit;
