-- PROPOSAL ONLY. Run on qvplwejffhjvxaypmjut only after release approval.
-- Fresh installation only; stop on existing objects. Never rename the TEST schema.
begin;
set local lock_timeout='2s';
set local statement_timeout='30s';
do $$begin
 if current_setting('lumiscore.metrics.release_target',true) is distinct from 'qvplwejffhjvxaypmjut' then raise exception 'EXPLICIT_PRODUCTION_TARGET_REQUIRED';end if;
 if to_regnamespace('discovery_test_private') is not null then raise exception 'TEST_DATABASE_FORBIDDEN';end if;
 if to_regnamespace('product_metrics') is not null
 or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('record_product_event_v1','record_product_events_v1','record_product_sign_in_v1','product_analysis_consent_v3'))
 or exists(select 1 from pg_trigger where not tgisinternal and tgname like 'product_metric%')
 then raise exception 'EXISTING_METRICS_STOP_CAPTURE_BASELINE';end if;
end$$;
create schema if not exists product_metrics;
comment on schema product_metrics is 'lumiscore-product-metrics-v3-production';
revoke all on schema product_metrics from public,anon,authenticated;
create table if not exists product_metrics.daily_counters(day date not null,event text not null,dimensions jsonb not null,n bigint not null check(n>0),expires_at timestamptz not null,primary key(day,event,dimensions));
create table if not exists product_metrics.receipts(event_id uuid primary key,recorded_at timestamptz not null,expires_at timestamptz not null);
create table if not exists product_metrics.budgets(minute timestamptz primary key,n integer not null,expires_at timestamptz not null);
create table if not exists product_metrics.consent_grants(token uuid primary key,version int not null check(version=1),created_at timestamptz not null,expires_at timestamptz not null,revoked_at timestamptz);
create table if not exists product_metrics.grant_budgets(grant_id uuid,minute timestamptz,n int not null,expires_at timestamptz not null,primary key(grant_id,minute));
create table if not exists product_metrics.operational_counts(minute timestamptz,reason text,n bigint not null,expires_at timestamptz not null,primary key(minute,reason));
create table if not exists product_metrics.maintenance_state(task text primary key check(task='cleanup'),last_attempt_at timestamptz,last_success_at timestamptz,last_error_code text,deleted jsonb,backlog boolean);
do $$declare name text;begin
 foreach name in array array['daily_counters','receipts','budgets','consent_grants','grant_budgets','operational_counts'] loop
  execute format('create index if not exists %I on product_metrics.%I(expires_at)',name||'_expiry',name);
 end loop;
 foreach name in array array['daily_counters','receipts','budgets','consent_grants','grant_budgets','operational_counts','maintenance_state'] loop
  execute format('alter table product_metrics.%I enable row level security',name);
  execute format('alter table product_metrics.%I force row level security',name);
 end loop;
end$$;
alter table product_metrics.daily_counters enable row level security;
alter table product_metrics.daily_counters force row level security;
alter table product_metrics.receipts enable row level security;
alter table product_metrics.receipts force row level security;
alter table product_metrics.budgets enable row level security;
alter table product_metrics.budgets force row level security;
revoke all on all tables in schema product_metrics from public,anon,authenticated;

create or replace function product_metrics.current_time() returns timestamptz language sql volatile set search_path='' as $$select clock_timestamp()$$;
-- Operational service health only: fixed reason, minute, count; no event content,
-- identity, grant, address or client-provided necessity classification.
create or replace function product_metrics.operational(p_reason text) returns void language plpgsql security definer set search_path='' set lock_timeout='5ms' as $$
declare t timestamptz:=product_metrics.current_time();begin
 if p_reason not in ('accepted','duplicate','consent_denied','project_rate_limited','grant_rate_limited','busy','storage_error','invalid_payload') then return;end if;
 insert into product_metrics.operational_counts values(date_trunc('minute',t),p_reason,1,date_trunc('minute',t)+interval '7 days') on conflict(minute,reason) do update set n=product_metrics.operational_counts.n+1;
exception when query_canceled or others then return;end$$;
create or replace function product_metrics.request_grant() returns uuid language plpgsql stable set search_path='' as $$
declare h jsonb;begin
 h:=nullif(current_setting('request.headers',true),'')::jsonb;
 if h->>'dnt'='1' or h->>'sec-gpc'='1' then return null;end if;
 return (h->>'x-lumiscore-analysis-grant')::uuid;
exception when others then return null;end$$;
create or replace function product_metrics.consent(p_action text,p_token uuid,p_until timestamptz) returns jsonb language plpgsql security definer set search_path='' set lock_timeout='1s' as $$
declare t timestamptz:=product_metrics.current_time();g product_metrics.consent_grants;issued int;id uuid;until_at timestamptz;begin
 if p_action not in ('accept','revoke','status') or p_action is null then raise exception 'invalid consent action';end if;
 if p_action='status' then
  select * into g from product_metrics.consent_grants where token=p_token;
  return jsonb_build_object('active',coalesce(g.revoked_at is null and g.version=1 and g.expires_at>t,false),'expires',coalesce(floor(extract(epoch from g.expires_at)*1000),0));
 end if;
 if p_token is not null then update product_metrics.consent_grants set revoked_at=t where token=p_token and revoked_at is null;end if;
 if p_action='revoke' then return jsonb_build_object('active',false,'expires',0,'revoked',true);end if;
 until_at:=least(coalesce(p_until,t+interval '30 minutes'),t+interval '30 minutes');
 if until_at<=t then return jsonb_build_object('active',false,'expires',0);end if;
 insert into product_metrics.operational_counts values(date_trunc('minute',t),'grant_issued',1,date_trunc('minute',t)+interval '7 days') on conflict(minute,reason) do update set n=product_metrics.operational_counts.n+1 where product_metrics.operational_counts.n<60 returning n into issued;
 if issued is null then return jsonb_build_object('active',false,'expires',0);end if;
 id:=gen_random_uuid();insert into product_metrics.consent_grants values(id,1,t,until_at,null);
 return jsonb_build_object('active',true,'token',id,'expires',floor(extract(epoch from until_at)*1000));
end$$;
create or replace function public.product_analysis_consent_v3(p_action text,p_token uuid default null,p_until timestamptz default null) returns jsonb language sql security invoker set search_path='' as $$select product_metrics.consent(p_action,p_token,p_until)$$;

create or replace function product_metrics.valid_context(p jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(p)='object' and p->>'locale' in ('nl','en') and p->>'surface' in ('home','recommendations','taste_result','book_detail','collection','editorial','browse','login','taste_test','other') and p->>'traffic'='production'
 and (p-array['locale','surface','source','medium','campaign','traffic'])='{}'::jsonb and
 ((p->>'source'='facebook' and p->>'medium'='organic_social' and p->>'campaign'='dystopie_202610') or (p->>'source' in ('google','bing','other_search') and p->>'medium'='organic_search' and p->>'campaign'='none') or (p->>'source'='direct_unknown' and p->>'medium'='unknown' and p->>'campaign'='none')),false)
$$;
create or replace function product_metrics.request_context() returns jsonb language plpgsql stable set search_path='' as $$
declare h jsonb;c jsonb;
begin
 h:=nullif(current_setting('request.headers',true),'')::jsonb;
 if product_metrics.request_grant() is null then return null;end if;
 if h->>'sec-gpc'='1' or h->>'dnt'='1' or octet_length(h->>'x-lumiscore-product-context')>512 then return null;end if;
 c:=(h->>'x-lumiscore-product-context')::jsonb;
 if not product_metrics.valid_context(c) then return null;end if;
 return c;
exception when others then return null;
end$$;
create or replace function product_metrics.record_event(p_event_id uuid,p_event text,p_dimensions jsonb) returns text language plpgsql security definer set search_path='' set lock_timeout='25ms' as $$
declare minute_count integer;allowed text[];is_round boolean;is_rec boolean;c jsonb;t timestamptz;g product_metrics.consent_grants;receipt uuid;event_day date;
begin
 if p_event_id is null or p_event is null or p_event not in ('recommendation_impression','recommendation_open','want_to_read_saved','taste_round_started','taste_round_completed','page_opened','editorial_list_opened','book_card_opened','book_detail_opened','rating_saved','taste_result_opened','sign_in_succeeded') then raise exception 'invalid event' using errcode='22023';end if;
 if p_event in ('rating_saved','want_to_read_saved','taste_round_started','taste_round_completed') and pg_trigger_depth()=0 then raise exception 'server transition required' using errcode='42501';end if;
 if p_event='sign_in_succeeded' and (auth.uid() is null or nullif(auth.jwt()->>'session_id','') is null or p_event_id is distinct from md5('login:'||(auth.jwt()->>'session_id'))::uuid) then raise exception 'verified session required' using errcode='42501';end if;
 if jsonb_typeof(p_dimensions) is distinct from 'object' or octet_length(p_dimensions::text)>768 then raise exception 'invalid dimensions' using errcode='22023';end if;
 c:=jsonb_build_object('locale',p_dimensions->'locale','surface',p_dimensions->'surface','source',p_dimensions->'source','medium',p_dimensions->'medium','campaign',p_dimensions->'campaign','traffic',p_dimensions->'traffic');
 if not product_metrics.valid_context(c) then raise exception 'invalid context' using errcode='22023';end if;
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
 -- Serialize with revocation on this SHORT-LIVED consent row, never a visitor ID.
 select * into g from product_metrics.consent_grants where token=product_metrics.request_grant() for update;
 t:=product_metrics.current_time();event_day:=(t at time zone 'UTC')::date;
 if not found or g.revoked_at is not null or g.version<>1 or g.expires_at<=t then perform product_metrics.operational('consent_denied');return 'consent_denied';end if;
 if exists(select 1 from product_metrics.receipts where event_id=p_event_id and expires_at>t) then perform product_metrics.operational('duplicate');return 'duplicate';end if;
 insert into product_metrics.grant_budgets values(g.token,date_trunc('minute',t),1,t+interval '1 hour') on conflict(grant_id,minute) do update set n=product_metrics.grant_budgets.n+1 where product_metrics.grant_budgets.n<60 returning n into minute_count;
 if minute_count is null then perform product_metrics.operational('grant_rate_limited');return 'grant_rate_limited';end if;
 insert into product_metrics.budgets values(date_trunc('minute',t),1,t+interval '1 hour') on conflict(minute) do update set n=product_metrics.budgets.n+1 where product_metrics.budgets.n<600 returning n into minute_count;
 if minute_count is null then perform product_metrics.operational('project_rate_limited');return 'project_rate_limited';end if;
 delete from product_metrics.receipts where event_id=p_event_id and expires_at<=t;
 insert into product_metrics.receipts values(p_event_id,t,t+case when p_event in ('taste_round_started','taste_round_completed','sign_in_succeeded') then interval '90 days' else interval '1 day' end) on conflict(event_id) do nothing returning event_id into receipt;
 if receipt is null then perform product_metrics.operational('duplicate');return 'duplicate';end if;
 insert into product_metrics.daily_counters values(event_day,p_event,p_dimensions,1,(event_day::timestamp at time zone 'UTC')+interval '90 days') on conflict(day,event,dimensions) do update set n=product_metrics.daily_counters.n+1;
 perform product_metrics.operational('accepted');
 return 'counted';
exception when lock_not_available then perform product_metrics.operational('busy');return 'busy';
 when invalid_parameter_value or insufficient_privilege then perform product_metrics.operational('invalid_payload');return 'invalid_payload';
 when query_canceled or others then perform product_metrics.operational('storage_error');return 'storage_error';
end$$;

-- Preserve the original narrow receipt RPC, restricted to browser observations.
create or replace function public.record_product_event_v1(p_event_id uuid,p_event text,p_dimensions jsonb) returns text language plpgsql security invoker set search_path='' as $$
begin
 if p_event not in ('recommendation_impression','recommendation_open','page_opened','editorial_list_opened','book_card_opened','book_detail_opened','taste_result_opened') then raise exception 'browser event required' using errcode='42501';end if;
 return product_metrics.record_event(p_event_id,p_event,p_dimensions);
end$$;
create or replace function public.record_product_events_v1(p_events jsonb) returns jsonb language plpgsql security invoker set search_path='' as $$
declare e jsonb;outcomes jsonb:='[]'::jsonb;
begin
 if jsonb_typeof(p_events) is distinct from 'array' or jsonb_array_length(p_events) not between 1 and 10 or octet_length(p_events::text)>8192 then raise exception 'invalid batch' using errcode='22023';end if;
 for e in select value from jsonb_array_elements(p_events) loop
  if jsonb_typeof(e) is distinct from 'object' or (e-array['event_id','event','properties'])<>'{}'::jsonb then raise exception 'invalid envelope' using errcode='22023';end if;
  outcomes:=outcomes||jsonb_build_array(public.record_product_event_v1((e->>'event_id')::uuid,e->>'event',e->'properties'));
 end loop;
 return outcomes;
end$$;
create or replace function public.record_product_sign_in_v1(p_dimensions jsonb) returns text language plpgsql security invoker set search_path='' as $$
begin
 if auth.uid() is null or nullif(auth.jwt()->>'session_id','') is null then raise exception 'verified session required' using errcode='42501';end if;
 return product_metrics.record_event(md5('login:'||(auth.jwt()->>'session_id'))::uuid,'sign_in_succeeded',p_dimensions);
end$$;

create or replace function product_metrics.observe_transition() returns trigger language plpgsql security definer set search_path='' as $$
declare c jsonb;event_name text;receipt uuid;dims jsonb;
begin
 -- Only the signed-in actor's confirmed transition, with opt-in bounded context.
 if new.user_id is distinct from auth.uid() then return new;end if;
 c:=product_metrics.request_context();if c is null then return new;end if;
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
 perform product_metrics.record_event(receipt,event_name,dims);
 return new;
exception when others then return new; -- Metrics never roll back the business write.
end$$;

-- Scheduled maintenance; never called from event ingestion. Privileged only.
create or replace function product_metrics.cleanup(p_at timestamptz default null,p_batch int default 5000) returns jsonb language plpgsql security definer set search_path='' set lock_timeout='100ms' as $$
declare t timestamptz:=coalesce(p_at,product_metrics.current_time());name text;deleted_n int;counts jsonb:='{}';has_backlog boolean:=false;remaining boolean;code text;
begin
 if p_batch<1 or p_batch>5000 or p_batch is null then raise exception 'invalid cleanup batch';end if;
 insert into product_metrics.maintenance_state(task,last_attempt_at) values('cleanup',t) on conflict(task) do update set last_attempt_at=t;
 begin
  foreach name in array array['daily_counters','receipts','budgets','consent_grants','grant_budgets','operational_counts'] loop
   execute format('delete from product_metrics.%I where ctid in(select ctid from product_metrics.%I where expires_at<=$1 order by expires_at limit $2 for update skip locked)',name,name) using t,p_batch;
   get diagnostics deleted_n=row_count;counts:=counts||jsonb_build_object(name,deleted_n);
   execute format('select exists(select 1 from product_metrics.%I where expires_at<=$1)',name) into remaining using t;has_backlog:=has_backlog or remaining;
  end loop;
  if to_regclass('cron.job_run_details') is not null then
   execute 'delete from cron.job_run_details where runid in(select d.runid from cron.job_run_details d join cron.job j on j.jobid=d.jobid where j.jobname=''lumiscore-product-metrics-cleanup-v3'' and j.username=current_user and j.database=current_database() and d.end_time<=$1-interval ''7 days'' order by d.end_time limit $2)' using t,p_batch;
  end if;
  update product_metrics.maintenance_state set last_success_at=t,last_error_code=null,deleted=counts,backlog=has_backlog where task='cleanup';
  return jsonb_build_object('status','ok','deleted',counts,'backlog',has_backlog);
 exception when query_canceled or others then
  get stacked diagnostics code=returned_sqlstate;
  update product_metrics.maintenance_state set last_error_code=code,backlog=true where task='cleanup';
  return jsonb_build_object('status','failed','sqlstate',code);
 end;
end$$;

-- All installation ACLs explicit; no dependency on default Supabase grants.
revoke all on all functions in schema product_metrics from public,anon,authenticated;
grant usage on schema product_metrics to anon,authenticated;
grant execute on function product_metrics.valid_context(jsonb) to anon,authenticated;
grant execute on function product_metrics.record_event(uuid,text,jsonb) to anon,authenticated;
grant execute on function product_metrics.consent(text,uuid,timestamptz) to anon,authenticated;
revoke all on function public.product_analysis_consent_v3(text,uuid,timestamptz) from public,anon,authenticated,service_role;
grant execute on function public.product_analysis_consent_v3(text,uuid,timestamptz) to anon,authenticated;
revoke all on function public.record_product_event_v1(uuid,text,jsonb),public.record_product_events_v1(jsonb),public.record_product_sign_in_v1(jsonb) from public,anon,authenticated,service_role;
grant execute on function public.record_product_event_v1(uuid,text,jsonb),public.record_product_events_v1(jsonb) to anon,authenticated;
grant execute on function public.record_product_sign_in_v1(jsonb) to authenticated;
-- Canonical events require trigger depth (or a verified session for sign-in),
-- even if the invoker can execute the private helper; table reads stay denied.
drop trigger if exists product_metric_rating_v1 on public.ratings;
create trigger product_metric_rating_v1 after insert or update of rating on public.ratings for each row execute function product_metrics.observe_transition();
drop trigger if exists product_metric_status_v1 on public.user_book_status;
create trigger product_metric_status_v1 after insert or update of status on public.user_book_status for each row execute function product_metrics.observe_transition();
drop trigger if exists product_metric_round_v1 on public.taste_rating_rounds;
create trigger product_metric_round_v1 after insert or update of completed_at on public.taste_rating_rounds for each row execute function product_metrics.observe_transition();
-- Explicitly exclude Supabase service_role defaults; not needed by the app.
revoke all on schema product_metrics from service_role;
revoke all on all tables in schema product_metrics from service_role;
revoke all on all functions in schema product_metrics from service_role;
commit;
