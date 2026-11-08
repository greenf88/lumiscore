-- TEST ONLY: correct the intentionally non-descriptive probe, not real content.
begin;
do $$begin
 if not exists(select from public.catalog_description_snapshots where work_id=979999991 and edition_id=979999992 and locale='en'
 and binding_hash='a0afe5de325bf242a5a86b6f3a7d732e64a69cef14bb2da624647ee988ce4547'
 and fetched_at='2026-11-08T12:45:11.827618Z' and checked_at=fetched_at and md5(text)='75700b213e86be189f968b744cfde027') then raise exception 'Probe differs from first receipt';end if;
end$$;
update public.catalog_description_snapshots set text='The synthetic test text describes no real book. The test reader uses this fixture to verify that a valid stored description survives a process restart and that the provider is not called again. This is isolated test data and must never be imported into the production catalogue.',fetched_at=transaction_timestamp(),checked_at=transaction_timestamp() where work_id=979999991 and edition_id=979999992 and locale='en';
commit;
select json_build_object('snapshot',(select json_build_object('binding',binding_hash,'fetched',fetched_at,'checked',checked_at,'textHash',md5(text)) from public.catalog_description_snapshots where work_id=979999991),'revision',(select json_build_object('hash',presentation_hash,'changedAt',content_changed_at,'receipt',receipt_sha256) from public.catalog_public_page_revisions where work_id=979999991));
