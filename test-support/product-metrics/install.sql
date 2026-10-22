-- Isolated TEST installation only. No production migration or production data.
begin;
do $$begin
 if not exists(select 1 from discovery_test_private.marker where identity='lumiscore-pr8-synthetic-v1') then raise exception 'TEST_TARGET_REQUIRED';end if;
 if exists(select 1 from pg_namespace where nspname='product_metrics_test') and obj_description(to_regnamespace('product_metrics_test'),'pg_namespace') is distinct from 'lumiscore-product-metrics-v2-test' then raise exception 'UNEXPECTED_EXISTING_METRICS_SCHEMA';end if;
end$$;
create schema if not exists product_metrics_test;
comment on schema product_metrics_test is 'lumiscore-product-metrics-v2-test';
revoke all on schema product_metrics_test from public,anon,authenticated;
create table if not exists product_metrics_test.daily_counters(day date not null,event text not null,dimensions jsonb not null,n bigint not null check(n>0),primary key(day,event,dimensions));
create table if not exists product_metrics_test.receipts(event_id uuid primary key,day date not null);
create index if not exists product_metric_receipt_day on product_metrics_test.receipts(day);
create table if not exists product_metrics_test.budgets(minute timestamptz primary key,n integer not null);
alter table product_metrics_test.daily_counters enable row level security;
alter table product_metrics_test.daily_counters force row level security;
alter table product_metrics_test.receipts enable row level security;
alter table product_metrics_test.receipts force row level security;
alter table product_metrics_test.budgets enable row level security;
alter table product_metrics_test.budgets force row level security;
revoke all on all tables in schema product_metrics_test from public,anon,authenticated;

create or replace function product_metrics_test.valid_context(p jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(p)='object' and p->>'locale' in ('nl','en') and p->>'surface' in ('home','recommendations','taste_result','book_detail','collection','editorial','browse','login','taste_test','other') and p->>'traffic'='synthetic'
 and (p-array['locale','surface','source','medium','campaign','traffic'])='{}'::jsonb and
 ((p->>'source'='facebook' and p->>'medium'='organic_social' and p->>'campaign'='dystopie_202610') or (p->>'source' in ('google','bing','other_search') and p->>'medium'='organic_search' and p->>'campaign'='none') or (p->>'source'='direct_unknown' and p->>'medium'='unknown' and p->>'campaign'='none')),false)
$$;
create or replace function product_metrics_test.request_context() returns jsonb language plpgsql stable set search_path='' as $$
declare h jsonb;c jsonb;
begin
 h:=nullif(current_setting('request.headers',true),'')::jsonb;
 if h->>'sec-gpc'='1' or h->>'dnt'='1' or octet_length(h->>'x-lumiscore-product-context')>512 then return null;end if;
 c:=(h->>'x-lumiscore-product-context')::jsonb;
 if not product_metrics_test.valid_context(c) then return null;end if;
 return c;
exception when others then return null;
end$$;
create or replace function product_metrics_test.record_event(p_event_id uuid,p_event text,p_dimensions jsonb) returns text language plpgsql security definer set search_path='' as $$
declare minute_count integer;allowed text[];is_round boolean;is_rec boolean;c jsonb;event_day date:=(now() at time zone 'UTC')::date;
begin
 if p_event_id is null or p_event is null or p_event not in ('recommendation_impression','recommendation_open','want_to_read_saved','taste_round_started','taste_round_completed','page_opened','editorial_list_opened','book_card_opened','book_detail_opened','rating_saved','taste_result_opened','sign_in_succeeded') then raise exception 'invalid event' using errcode='22023';end if;
 if p_event in ('rating_saved','want_to_read_saved','taste_round_started','taste_round_completed') and pg_trigger_depth()=0 then raise exception 'server transition required' using errcode='42501';end if;
 if p_event='sign_in_succeeded' and (auth.uid() is null or nullif(auth.jwt()->>'session_id','') is null or p_event_id is distinct from md5('login:'||(auth.jwt()->>'session_id'))::uuid) then raise exception 'verified session required' using errcode='42501';end if;
 if jsonb_typeof(p_dimensions) is distinct from 'object' or octet_length(p_dimensions::text)>768 then raise exception 'invalid dimensions' using errcode='22023';end if;
 c:=jsonb_build_object('locale',p_dimensions->'locale','surface',p_dimensions->'surface','source',p_dimensions->'source','medium',p_dimensions->'medium','campaign',p_dimensions->'campaign','traffic',p_dimensions->'traffic');
 if not product_metrics_test.valid_context(c) then raise exception 'invalid context' using errcode='22023';end if;
 is_round:=p_event like 'taste_round_%';is_rec:=p_event like 'recommendation_%';
 allowed:=array['locale','surface','source','medium','campaign','traffic'];
 if is_round then allowed:=allowed||array['goal'];end if;
 if is_rec or p_event in ('want_to_read_saved','book_card_opened','book_detail_opened','rating_saved') then allowed:=allowed||array['work_id'];
  if jsonb_typeof(p_dimensions->'work_id') is distinct from 'number' or (p_dimensions->>'work_id')!~'^[1-9][0-9]{0,14}$' then raise exception 'invalid work' using errcode='22023';end if;
 end if;
 if is_rec then allowed:=allowed||array['position','ranker_version'];
  if p_dimensions->>'ranker_version' is distinct from '8f337dd' or jsonb_typeof(p_dimensions->'position') is distinct from 'number' or (p_dimensions->>'position')!~'^[1-9][0-9]?$|^100$' then raise exception 'invalid ranking dimensions' using errcode='22023';end if;
 end if;
 if p_event='want_to_read_saved' then allowed:=allowed||array['ranker_version'];end if;
 if p_dimensions ? 'ranker_version' and p_dimensions->>'ranker_version' is distinct from '8f337dd' then raise exception 'invalid ranker' using errcode='22023';end if;
 if is_round and (jsonb_typeof(p_dimensions->'goal') is distinct from 'number' or p_dimensions->>'goal' not in ('10','15','20','30')) then raise exception 'invalid goal' using errcode='22023';end if;
 if p_event in ('book_card_opened','editorial_list_opened') then allowed:=allowed||array['list_id'];end if;
 if p_dimensions ? 'list_id' and p_dimensions->>'list_id' not in ('dystopie-vanaf-1990','other') then raise exception 'invalid list' using errcode='22023';end if;
 if p_event='rating_saved' then allowed:=allowed||array['operation'];if p_dimensions->>'operation' is null or p_dimensions->>'operation' not in ('new','updated') then raise exception 'invalid operation' using errcode='22023';end if;end if;
 if exists(select 1 from jsonb_object_keys(p_dimensions) k where not(k=any(allowed))) then raise exception 'denied property' using errcode='22023';end if;
 -- Never wait for the metrics mutex in a rating transaction.
 if not pg_try_advisory_xact_lock(20261019,31) then return 'busy';end if;
 if exists(select 1 from product_metrics_test.receipts where event_id=p_event_id) then return 'duplicate';end if;
 insert into product_metrics_test.budgets values(date_trunc('minute',now()),1) on conflict(minute) do update set n=product_metrics_test.budgets.n+1 returning n into minute_count;
 if minute_count=1 then
  delete from product_metrics_test.receipts where day<event_day-90;
  delete from product_metrics_test.daily_counters where day<event_day-90;
  delete from product_metrics_test.budgets where minute<date_trunc('minute',now())-interval '2 minutes';
 end if;
 if minute_count>120 then return 'rate_limited';end if;
 insert into product_metrics_test.receipts values(p_event_id,event_day);
 insert into product_metrics_test.daily_counters values(event_day,p_event,p_dimensions,1) on conflict(day,event,dimensions) do update set n=product_metrics_test.daily_counters.n+1;
 return 'counted';
end$$;

-- Preserve the original narrow receipt RPC, restricted to browser observations.
create or replace function public.record_product_event_test_v1(p_event_id uuid,p_event text,p_dimensions jsonb) returns text language plpgsql security invoker set search_path='' as $$
begin
 if p_event not in ('recommendation_impression','recommendation_open','page_opened','editorial_list_opened','book_card_opened','book_detail_opened','taste_result_opened') then raise exception 'browser event required' using errcode='42501';end if;
 return product_metrics_test.record_event(p_event_id,p_event,p_dimensions);
end$$;
create or replace function public.record_product_events_test_v1(p_events jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare e jsonb;outcomes jsonb:='[]'::jsonb;
begin
 if jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events) not between 1 and 10 or octet_length(p_events::text)>8192 then raise exception 'invalid batch' using errcode='22023';end if;
 for e in select value from jsonb_array_elements(p_events) loop
  if jsonb_typeof(e) is distinct from 'object' or (e-array['event_id','event','properties'])<>'{}'::jsonb then raise exception 'invalid envelope' using errcode='22023';end if;
  outcomes:=outcomes||jsonb_build_array(public.record_product_event_test_v1((e->>'event_id')::uuid,e->>'event',e->'properties'));
 end loop;
 return outcomes;
end$$;
create or replace function public.record_product_sign_in_test_v1(p_dimensions jsonb) returns text language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or nullif(auth.jwt()->>'session_id','') is null then raise exception 'verified session required' using errcode='42501';end if;
 return product_metrics_test.record_event(md5('login:'||(auth.jwt()->>'session_id'))::uuid,'sign_in_succeeded',p_dimensions);
end$$;

create or replace function product_metrics_test.observe_transition() returns trigger language plpgsql security definer set search_path='' as $$
declare c jsonb;event_name text;receipt uuid;dims jsonb;
begin
 -- Only the signed-in actor's confirmed transition, with opt-in bounded context.
 if new.user_id is distinct from auth.uid() then return new;end if;
 c:=product_metrics_test.request_context();if c is null then return new;end if;
 dims:=c;
 if tg_table_name='ratings' then
  if tg_op='UPDATE' and old.rating is not distinct from new.rating then return new;end if;
  event_name:='rating_saved';dims:=dims||jsonb_build_object('work_id',new.work_id,'operation',case when tg_op='INSERT' then 'new' else 'updated' end);receipt:=gen_random_uuid();
 elsif tg_table_name='user_book_status' then
  if new.status<>'want_to_read' or (tg_op='UPDATE' and old.status is not distinct from new.status) then return new;end if;
  event_name:='want_to_read_saved';dims:=dims||jsonb_build_object('work_id',new.work_id);receipt:=gen_random_uuid();
 elsif tg_table_name='taste_rating_rounds' then
  if tg_op='INSERT' then event_name:='taste_round_started';
  elsif new.completed_at is not null and old.completed_at is null then event_name:='taste_round_completed';
  else return new;end if;
  dims:=dims||jsonb_build_object('goal',new.goal);receipt:=md5(event_name||':'||new.id::text)::uuid;
 else return new;end if;
 perform product_metrics_test.record_event(receipt,event_name,dims);
 return new;
exception when others then return new; -- Metrics never roll back the business write.
end$$;

-- All installation ACLs explicit; no dependency on default Supabase grants.
revoke all on all functions in schema product_metrics_test from public,anon,authenticated;
grant usage on schema product_metrics_test to anon,authenticated;
grant execute on function product_metrics_test.valid_context(jsonb) to anon,authenticated;
grant execute on function product_metrics_test.record_event(uuid,text,jsonb) to anon,authenticated;
revoke all on function public.record_product_event_test_v1(uuid,text,jsonb),public.record_product_events_test_v1(jsonb),public.record_product_sign_in_test_v1(jsonb) from public,anon,authenticated;
grant execute on function public.record_product_event_test_v1(uuid,text,jsonb),public.record_product_events_test_v1(jsonb) to anon,authenticated;
grant execute on function public.record_product_sign_in_test_v1(jsonb) to authenticated;
-- Canonical events require trigger depth (or a verified session for sign-in),
-- even if the invoker can execute the private helper; table reads stay denied.
drop trigger if exists product_metric_rating_v1 on public.ratings;
create trigger product_metric_rating_v1 after insert or update of rating on public.ratings for each row execute function product_metrics_test.observe_transition();
drop trigger if exists product_metric_status_v1 on public.user_book_status;
create trigger product_metric_status_v1 after insert or update of status on public.user_book_status for each row execute function product_metrics_test.observe_transition();
drop trigger if exists product_metric_round_v1 on public.taste_rating_rounds;
create trigger product_metric_round_v1 after insert or update of completed_at on public.taste_rating_rounds for each row execute function product_metrics_test.observe_transition();
commit;
