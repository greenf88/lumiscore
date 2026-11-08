-- Separate process/connection reads the committed probe; not transaction-local proof.
begin;
do $$declare before_date timestamptz;before_receipt text;changed boolean;
begin
 if (select count(*) from public.catalog_description_snapshots where work_id=979999991)<>1 then raise exception 'Missing committed snapshot';end if;
 select content_changed_at,receipt_sha256 into before_date,before_receipt from public.catalog_public_page_revisions where work_id=979999991 and locale='en';
 changed:=public.record_catalog_public_revision(979999991,'en',repeat('a',64),repeat('a',64),clock_timestamp(),repeat('d',64));
 if changed or not exists(select from public.catalog_public_page_revisions where work_id=979999991 and content_changed_at=before_date and receipt_sha256=before_receipt) then raise exception 'No-op changed revision';end if;
 begin perform public.record_catalog_public_revision(979999991,'en',repeat('b',64),repeat('b',64),clock_timestamp(),repeat('c',64));raise exception 'CAS did not reject';exception when raise_exception then if sqlerrm not like '%changed since manifest%' then raise;end if;end;
 begin update public.catalog_description_snapshots set text=text||' late changed text' where work_id=979999991;raise exception 'Same revision did not reject';exception when raise_exception then if sqlerrm not like '%same fetch revision%' then raise;end if;end;
 begin perform public.withdraw_catalog_description_snapshot(979999991,979999992,'en',repeat('b',64),(select fetched_at from public.catalog_description_snapshots where work_id=979999991));raise exception 'Withdrawal CAS did not reject';exception when raise_exception then if sqlerrm not like '%CAS mismatch%' then raise;end if;end;
end$$;
set local role anon;
do $$begin
 if (select count(*) from public.catalog_description_snapshots where work_id=979999991)<>1 then raise exception 'Public bounded read failed';end if;
 begin update public.catalog_description_snapshots set provider_status='confirmed_missing' where work_id=979999991;raise exception 'Browser write allowed';exception when insufficient_privilege then null;end;
 begin perform public.withdraw_catalog_description_snapshot(979999991,979999992,'en',repeat('a',64),now());raise exception 'Browser withdrawal allowed';exception when insufficient_privilege then null;end;
end$$;
reset role;
set local role authenticated;
do $$begin
 begin delete from public.catalog_public_page_revisions where work_id=979999991;raise exception 'Authenticated write allowed';exception when insufficient_privilege then null;end;
end$$;
reset role;
commit;
explain (format json) select * from public.catalog_description_snapshots where work_id=979999991 and edition_id=979999992 and locale='en';
select json_build_object('committedRead',true,'noopPreservedDateAndReceipt',true,'CASRejected',true,'sameRevisionPayloadRejected',true,'anonRead',true,'anonAndAuthenticatedWriteDenied',true,'withdrawalDeniedForBrowser',true);
