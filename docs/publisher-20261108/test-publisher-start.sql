-- TEST ONLY. This is a synthetic event date, NOT claimed content history/backfill.
-- No catalogue, controlled text, ratings, account or progress mutations.
begin;
do $$ begin
 if exists(select 1 from catalog_public_revision_events) or exists(select 1 from catalog_public_page_revisions) then raise exception 'Expected empty TEST-only publisher state; stop';end if;
 if exists(select 1 from cron.job where jobname='lumiscore-publisher-acceptance-20261108') then raise exception 'Own test job occupied';end if;
end $$;
select enqueue_catalog_public_revision(8800306,'nl',null,'631c6bc17334982ff809488959c5438bffe6a707fc167a5aa86297d0bab5c4ab','2000-01-01T12:00:00Z',encode(sha256(convert_to('TEST publisher fixture 20261108: synthetic date; no production backfill','UTF8')),'hex'));
select cron.schedule('lumiscore-publisher-acceptance-20261108','* * * * *',$cmd$set statement_timeout='5s';select public.publish_catalog_public_revisions(50);$cmd$);
commit;
select json_build_object('events',(select json_agg(to_jsonb(e)) from catalog_public_revision_events e),'own_job',(select json_agg(row(jobid,jobname,schedule,command)) from cron.job where jobname='lumiscore-publisher-acceptance-20261108')) receipt;
