-- REVIEW ONLY; never restore users/ratings/progress from a snapshot.
-- FIRST revert the PR48 callers if also removing catalog_browse_page_v2.
-- Review all inbound edition references and retain later additions/changes.
-- Fill the TWO receipt IDs from the approved import; no guessed/global IDs.
-- Default rollback. This is NOT authorization to remove later referenced data.
begin;
set local lock_timeout='3s';
lock table public.editions in share row exclusive mode;
do $recover$
declare crawdads_added_id bigint := null; animal_added_id bigint := null;
begin
  if crawdads_added_id is null or animal_added_id is null then
    raise exception 'Supply actual added edition IDs from retained import receipt';
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
  -- No CASCADE. If any later dependency exists: stop and retain the edition.
  -- Do not run until referencing tables (including ON DELETE CASCADE FKs) have
  -- been reviewed read-only and confirmed empty for these two edition IDs.
  delete from public.editions where id in (crawdads_added_id,animal_added_id);
  update public.editions set language=null where id=114;
  update public.editions set isbn_13=null where id=1421;
end $recover$;
rollback;
