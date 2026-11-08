-- Restore only the exact committed synthetic probe from its first receipt.
begin;
do $$begin
 if not exists(select from public.catalog_description_snapshots where work_id=979999991 and edition_id=979999992 and locale='en'
 and binding_hash=repeat('a',64) and fetched_at='2026-11-08T12:25:55.924017Z' and checked_at=fetched_at and provider_status='resolved'
 and md5(text)='75700b213e86be189f968b744cfde027') then raise exception 'Snapshot changed after probe receipt';end if;
 if not exists(select from public.catalog_public_page_revisions where work_id=979999991 and locale='en' and presentation_hash=repeat('a',64)
 and content_changed_at='2026-11-08T12:25:55.924017Z' and receipt_sha256=repeat('c',64)) then raise exception 'Revision changed after probe receipt';end if;
 if not exists(select from public.editions where id=979999992 and work_id=979999991 and title='TEST ONLY Metadata probe' and language='eng' and open_library_edition_id='OL979999992M' and isbn_13 is null)
 or not exists(select from public.works where id=979999991 and title='TEST ONLY Metadata probe' and author_id=735 and open_library_id='OL979999991W') then raise exception 'Probe parent changed';end if;
end$$;
select public.withdraw_catalog_description_snapshot(979999991,979999992,'en',repeat('a',64),'2026-11-08T12:25:55.924017Z');
delete from public.catalog_public_page_revisions where work_id=979999991 and locale='en';
-- Restrictive foreign keys stop unexpected dependencies; no CASCADE or sequences.
delete from public.editions where id=979999992;
delete from public.works where id=979999991;
commit;
select json_build_object('committedRestore',true,'workAbsent',not exists(select from public.works where id=979999991),'editionAbsent',not exists(select from public.editions where id=979999992),'snapshotsEmpty',not exists(select from public.catalog_description_snapshots),'revisionsEmpty',not exists(select from public.catalog_public_page_revisions));
