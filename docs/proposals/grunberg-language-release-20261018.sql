-- Sole approved catalog correction. No schema, ratings, status or progress writes.
-- Sources reviewed previously:
-- https://openlibrary.org/books/OL28188774M.json (contains the erroneous dut code)
-- https://www.rebuy.de/i%2C9050286/buecher/der-mann-der-nie-krank-war (exact ISBN)
-- https://www.kiwi-verlag.de/buch/arnon-gruenberg-der-mann-der-nie-krank-war-9783462308211
-- Publisher corroborates German translation; publisher ebook ISBN is NOT inserted.
begin;
set local lock_timeout = '3s';
set local statement_timeout = '10s';
do $$
begin
  if not exists (select 1 from public.editions where id=1462 and work_id=1410
    and open_library_edition_id='OL28188774M' and isbn_13='9783462046601'
    and title='Der Mann, der nie krank war' and language in ('dut','ger')) then
    raise exception 'Grunberg identity/preimage mismatch; no update authorized';
  end if;
end $$;
update public.editions set language='ger'
where id=1462 and work_id=1410 and open_library_edition_id='OL28188774M'
  and isbn_13='9783462046601' and title='Der Mann, der nie krank war' and language='dut'
returning id,work_id,open_library_edition_id,isbn_13,title,language;
commit;
-- Application rollback: redeploy the captured previous main deployment.
-- Retain the correct ger metadata; reverting the app does not justify restoring
-- known-false Dutch metadata. Never restore a database snapshot or ratings.
