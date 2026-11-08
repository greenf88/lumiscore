-- TEST ONLY: hlvujbrmfdlrfxdjwsmb. Synthetic, unclassified, temporary parents.
-- Never put this file in the production execution set.
begin;
do $$begin
 if exists(select from public.works where id=979999991) or exists(select from public.editions where id=979999992) then raise exception 'Probe ID collision';end if;
 if not exists(select from public.authors where id=735) then raise exception 'Expected existing fixture author absent';end if;
end$$;
insert into public.works(id,title,author_id,open_library_id,source_type) values(979999991,'TEST ONLY Metadata probe',735,'OL979999991W','open_library');
insert into public.editions(id,work_id,title,language,open_library_edition_id) values(979999992,979999991,'TEST ONLY Metadata probe','eng','OL979999992M');
set local role service_role;
insert into public.catalog_description_snapshots values(979999991,979999992,'en',repeat('a',64),735,'TEST ONLY Metadata probe','eng',null,'OL979999991W',
 'Synthetic test content for isolated validation only. This text is not a real book synopsis, editorial approval or a production proposal.','OL979999992M',transaction_timestamp(),transaction_timestamp(),'resolved','identity_and_language_verified');
select public.record_catalog_public_revision(979999991,'en',null,repeat('a',64),transaction_timestamp(),repeat('c',64));
reset role;
commit;
select json_build_object('committed',true,'snapshotRows',(select count(*) from public.catalog_description_snapshots where work_id=979999991),'revisionRows',(select count(*) from public.catalog_public_page_revisions where work_id=979999991),'snapshot',(select json_build_object('binding',binding_hash,'fetched',fetched_at,'checked',checked_at,'textHash',md5(text)) from public.catalog_description_snapshots where work_id=979999991),'revision',(select json_build_object('hash',presentation_hash,'changedAt',content_changed_at,'receipt',receipt_sha256) from public.catalog_public_page_revisions where work_id=979999991));
