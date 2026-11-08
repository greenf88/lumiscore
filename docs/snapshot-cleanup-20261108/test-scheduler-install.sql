begin;set local statement_timeout='10s';
do $$ begin
 if exists(select 1 from editions where id=979999981) then raise exception 'Owned retention edition ID occupied';end if;
 if exists(select 1 from catalog_description_snapshots where provider_status<>'withdrawn' and fetched_at<now()-interval '90 days') then raise exception 'Unexpected pre-existing expired snapshots; stop';end if;
 if exists(select 1 from catalog_description_snapshots where work_id=1372) then raise exception 'Own snapshot slot occupied';end if;
end $$;
insert into editions(id,work_id,title,language,open_library_edition_id) values(979999981,1372,'Iron Gold','eng','OL979999981M');
insert into catalog_description_snapshots(work_id,edition_id,locale,binding_hash,bound_author_id,bound_title,bound_language,bound_isbn13,bound_open_library_work_id,text,source_key,fetched_at,checked_at,provider_status,validation)
values(1372,979999981,'en',repeat('b',64),924300157,'Iron Gold','eng',null,'OL19726995W','Isolated synthetic retention text; this is not a proposed synopsis or public catalogue addition.','OL979999981M',now()-interval '100 days',now(),'resolved','identity_and_language_verified'),
(1372,1407,'en',repeat('c',64),924300157,'Iron Gold','eng','9781473646568','OL19726995W','Isolated synthetic current-cache fixture; the reviewed summary must remain the displayed book text.','OL45300336M',now(),now(),'resolved','identity_and_language_verified');
-- Real pg_cron execution on TEST only. Stop after first successful run.
do $$ begin
 if exists(select 1 from cron.job where jobname='lumiscore-source-cleanup-acceptance-20261108') then raise exception 'Own acceptance job already exists';end if;
 perform cron.schedule('lumiscore-source-cleanup-acceptance-20261108','* * * * *',$cmd$set statement_timeout='5s';select public.cleanup_catalog_description_snapshots(100);$cmd$);
end $$;
commit;
select jobid,jobname,schedule,command,active from cron.job where jobname='lumiscore-source-cleanup-acceptance-20261108';
