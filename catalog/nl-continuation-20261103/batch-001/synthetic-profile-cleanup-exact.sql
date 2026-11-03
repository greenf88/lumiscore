-- Disposable PR72 synthetic-profile cleanup ONLY hlvujbrmfdlrfxdjwsmb.
-- Two own ratings + two auto-created own read statuses + one empty own round.
-- No auth deletion, catalogue writes or sequence reset. Full-row drift aborts.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
do $body$
declare uid constant uuid:='c0bf5eb8-8f4f-41d8-b518-7f41645ea8f9'; expected constant jsonb:=$pr72${"ratings":[{"id":"ff78fa8e-b1c4-46de-9774-2f6f6d7cedae","rating":9,"user_id":"c0bf5eb8-8f4f-41d8-b518-7f41645ea8f9","work_id":8800306,"created_at":"2026-11-03T18:30:06.090563+00:00","updated_at":"2026-11-03T18:30:06.090563+00:00"},{"id":"299eba8d-5b45-46c8-a967-3a39d4c712da","rating":4,"user_id":"c0bf5eb8-8f4f-41d8-b518-7f41645ea8f9","work_id":8800307,"created_at":"2026-11-03T18:30:23.72449+00:00","updated_at":"2026-11-03T18:30:23.72449+00:00"}],"statuses":[{"status":"read","user_id":"c0bf5eb8-8f4f-41d8-b518-7f41645ea8f9","work_id":8800306,"created_at":"2026-11-03T18:30:06.090563+00:00","updated_at":"2026-11-03T18:30:06.090563+00:00"},{"status":"read","user_id":"c0bf5eb8-8f4f-41d8-b518-7f41645ea8f9","work_id":8800307,"created_at":"2026-11-03T18:30:23.72449+00:00","updated_at":"2026-11-03T18:30:23.72449+00:00"}],"rounds":[{"id":"345af8ce-5a69-4e98-be43-175e584a30a1","goal":10,"user_id":"c0bf5eb8-8f4f-41d8-b518-7f41645ea8f9","language":"nl","created_at":"2026-11-03T18:28:57.383957+00:00","completed_at":null,"round_number":1,"revisit_prior_skips":false}]}$pr72$::jsonb; actual jsonb; affected integer;
begin
 if not exists(select 1 from auth.users where id=uid and lower(email)='pr72-catalogue-20261103@example.test') then raise exception 'Synthetic account identity drift'; end if;
 perform 1 from public.ratings where user_id=uid for update;
 perform 1 from public.user_book_status where user_id=uid for update;
 perform 1 from public.taste_rating_rounds where user_id=uid for update;
 select jsonb_build_object('ratings',coalesce((select jsonb_agg(to_jsonb(r) order by work_id) from public.ratings r where user_id=uid),'[]'::jsonb),'statuses',coalesce((select jsonb_agg(to_jsonb(r) order by work_id) from public.user_book_status r where user_id=uid),'[]'::jsonb),'rounds',coalesce((select jsonb_agg(to_jsonb(r)) from public.taste_rating_rounds r where user_id=uid),'[]'::jsonb)) into actual;
 if actual<>expected then raise exception 'Synthetic row drift; cleanup refused'; end if;
 if exists(select 1 from public.taste_rating_offers where user_id=uid) or exists(select 1 from public.taste_test_responses where user_id=uid) or exists(select 1 from public.user_reading_preferences where user_id=uid) then raise exception 'Unexpected synthetic dependencies'; end if;
 if exists(select 1 from pg_constraint where contype='f' and confrelid in('public.ratings'::regclass,'public.user_book_status'::regclass,'public.taste_rating_rounds'::regclass) and not(conrelid='public.taste_rating_offers'::regclass and conname='taste_rating_offers_round_id_user_id_fkey')) then raise exception 'Incoming FK schema drift; inspect before cleanup'; end if;
 delete from public.ratings where user_id=uid and work_id in(8800306,8800307);
 get diagnostics affected=row_count; if affected<>2 then raise exception 'Unexpected rating count'; end if;
 delete from public.user_book_status where user_id=uid and work_id in(8800306,8800307);
 get diagnostics affected=row_count; if affected<>2 then raise exception 'Unexpected status count'; end if;
 delete from public.taste_rating_rounds where user_id=uid;
 get diagnostics affected=row_count; if affected<>1 then raise exception 'Unexpected round count'; end if;
end $body$;
commit;
select 'PR72 own synthetic profile rows removed' as result,(select count(*) from public.ratings) as ratings,(select count(*) from public.user_book_status) as statuses;
