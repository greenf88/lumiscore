-- Explicit reviewed correction only. The request adapter never invokes this.
begin;
create or replace function public.reinstate_catalog_description_snapshot(p_work_id bigint,p_edition_id bigint,p_locale text,p_expected_withdrawn_sha256 text,p_snapshot jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare prior public.catalog_description_snapshots%rowtype; revised public.catalog_description_snapshots%rowtype;
begin
 select * into prior from public.catalog_description_snapshots where work_id=p_work_id and edition_id=p_edition_id and locale=p_locale for update;
 if not found then raise exception 'Reviewed correction expected snapshot absent';end if;
 revised:=jsonb_populate_record(null::public.catalog_description_snapshots,p_snapshot);
 if revised.work_id is distinct from p_work_id or revised.edition_id is distinct from p_edition_id or revised.locale is distinct from p_locale
  or revised.provider_status is distinct from 'resolved' or revised.withdrawn_at is not null or revised.withdrawn_text_sha256 is not null or revised.withdrawal_receipt_sha256 is not null
 then raise exception 'Invalid reviewed correction identity/state';end if;
 if to_jsonb(prior)=to_jsonb(revised) then return false;end if;
 if prior.provider_status<>'withdrawn' or p_expected_withdrawn_sha256 is null
  or encode(sha256(convert_to(to_jsonb(prior)::text,'UTF8')),'hex')<>p_expected_withdrawn_sha256 then raise exception 'Reviewed correction CAS mismatch';end if;
 if revised.text is null or encode(sha256(convert_to(revised.text,'UTF8')),'hex')=prior.withdrawn_text_sha256 or (revised.fetched_at<=prior.fetched_at or revised.checked_at<prior.checked_at) then raise exception 'Correction must be a new reviewed response, not the withdrawn body';end if;
 delete from public.catalog_description_snapshots where work_id=p_work_id and edition_id=p_edition_id and locale=p_locale;
 -- Same normal insert guard validates current author, exact edition, ISBN, language,
 -- source identities, length and dates. A failure rolls back the entire correction.
 insert into public.catalog_description_snapshots select revised.*;
 return true;
end $$;
revoke all on function public.reinstate_catalog_description_snapshot(bigint,bigint,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.reinstate_catalog_description_snapshot(bigint,bigint,text,text,jsonb) to service_role;
commit;
