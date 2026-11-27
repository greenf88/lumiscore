-- Fixed reading-guide dimensions within PR51; no table, trigger, scheduler, ACL or retention changes.
begin;
set local lock_timeout='1s';
set local statement_timeout='5s';
do $patch$
declare r record; target oid; body text; definition text;
begin
 if current_setting('lumiscore.metrics.release_target',true) is distinct from 'hlvujbrmfdlrfxdjwsmb' then raise exception 'WRONG_METRICS_TARGET';end if;
 for r in select * from (values
 ('public.record_product_event_test_v1(uuid,text,jsonb)','585001236fd4ca133a1f2a48bf9af33d','168bb0d44c9d30af8a43f47254a991e5','
begin
 if p_event not in (''recommendation_impression'',''recommendation_open'',''page_opened'',''editorial_list_opened'',''book_card_opened'',''book_detail_opened'',''taste_result_opened'',''referral_arrival'',''search_started'',''search_results'',''search_empty'',''search_failed'',''search_book_opened'',''guest_round_started'',''guest_round_completed'',''guest_book_saved'',''guest_save_failed'',''guest_suggestions_empty'',''guest_suggestions_failed'') then raise exception ''browser event required'' using errcode=''42501'';end if;
 return product_metrics_test.record_event(p_event_id,p_event,p_dimensions);
end','
begin
 if p_event not in (''recommendation_impression'',''recommendation_open'',''page_opened'',''editorial_list_opened'',''reading_guide_opened'',''book_card_opened'',''book_detail_opened'',''taste_result_opened'',''referral_arrival'',''search_started'',''search_results'',''search_empty'',''search_failed'',''search_book_opened'',''guest_round_started'',''guest_round_completed'',''guest_book_saved'',''guest_save_failed'',''guest_suggestions_empty'',''guest_suggestions_failed'') then raise exception ''browser event required'' using errcode=''42501'';end if;
 return product_metrics_test.record_event(p_event_id,p_event,p_dimensions);
end'),
 ('product_metrics_test.record_event(uuid,text,jsonb)','f1f220220c049129596357f6f07155e3','71a3ada5664fb2a50154a97a0c79a964','
declare minute_count integer;allowed text[];is_round boolean;is_rec boolean;c jsonb;t timestamptz;g product_metrics_test.consent_grants;receipt uuid;event_day date;
begin
 if p_event_id is null or p_event is null or p_event not in (''recommendation_impression'',''recommendation_open'',''want_to_read_saved'',''taste_round_started'',''taste_round_completed'',''page_opened'',''editorial_list_opened'',''book_card_opened'',''book_detail_opened'',''rating_saved'',''taste_result_opened'',''sign_in_succeeded'',''referral_arrival'',''search_started'',''search_results'',''search_empty'',''search_failed'',''search_book_opened'',''guest_round_started'',''guest_round_completed'',''guest_book_saved'',''guest_save_failed'',''guest_suggestions_empty'',''guest_suggestions_failed'') then raise exception ''invalid event'' using errcode=''22023'';end if;
 if p_event in (''rating_saved'',''want_to_read_saved'',''taste_round_started'',''taste_round_completed'') and pg_trigger_depth()=0 then raise exception ''server transition required'' using errcode=''42501'';end if;
 if p_event=''sign_in_succeeded'' and (auth.uid() is null or nullif(auth.jwt()->>''session_id'','''') is null or p_event_id is distinct from md5(''login:''||(auth.jwt()->>''session_id''))::uuid) then raise exception ''verified session required'' using errcode=''42501'';end if;
 if jsonb_typeof(p_dimensions) is distinct from ''object'' or octet_length(p_dimensions::text)>768 then raise exception ''invalid dimensions'' using errcode=''22023'';end if;
 c:=jsonb_build_object(''locale'',p_dimensions->''locale'',''surface'',p_dimensions->''surface'',''source'',p_dimensions->''source'',''medium'',p_dimensions->''medium'',''campaign'',p_dimensions->''campaign'',''traffic'',p_dimensions->''traffic'');
 if not product_metrics_test.valid_context(c) then raise exception ''invalid context'' using errcode=''22023'';end if;
 if p_event=''referral_arrival'' and p_dimensions->>''source'' is distinct from ''leesroutes'' then raise exception ''invalid referral'' using errcode=''22023'';end if;
 is_round:=p_event like ''taste_round_%'';is_rec:=p_event like ''recommendation_%'';
 allowed:=array[''locale'',''surface'',''source'',''medium'',''campaign'',''traffic'',''device''];
 if p_dimensions ? ''device'' and (jsonb_typeof(p_dimensions->''device'') is distinct from ''string'' or p_dimensions->>''device'' not in (''mobile'',''desktop'')) then raise exception ''invalid device'' using errcode=''22023'';end if;
 if is_round then allowed:=allowed||array[''goal''];end if;
 if is_rec or p_event in (''want_to_read_saved'',''book_card_opened'',''book_detail_opened'',''rating_saved'',''search_book_opened'',''guest_book_saved'',''guest_save_failed'') then allowed:=allowed||array[''work_id''];
  if jsonb_typeof(p_dimensions->''work_id'') is distinct from ''number'' or (p_dimensions->>''work_id'')!~''^[1-9][0-9]{0,14}$'' then raise exception ''invalid work'' using errcode=''22023'';end if;
 end if;
 if is_rec then allowed:=allowed||array[''position'',''ranker_version''];
  if p_dimensions->>''ranker_version'' is distinct from ''8f337dd'' or jsonb_typeof(p_dimensions->''position'') is distinct from ''number'' or (p_dimensions->>''position'')!~''^[1-9][0-9]?$|^100$'' then raise exception ''invalid ranking dimensions'' using errcode=''22023'';end if;
 end if;
 if p_event=''want_to_read_saved'' then allowed:=allowed||array[''ranker_version''];end if;
 if p_dimensions ? ''ranker_version'' and p_dimensions->>''ranker_version'' is distinct from ''8f337dd'' then raise exception ''invalid ranker'' using errcode=''22023'';end if;
 if is_round and (jsonb_typeof(p_dimensions->''goal'') is distinct from ''number'' or p_dimensions->>''goal'' not in (''10'',''15'',''20'',''30'')) then raise exception ''invalid goal'' using errcode=''22023'';end if;
 if p_event in (''book_card_opened'',''editorial_list_opened'') then allowed:=allowed||array[''list_id''];end if;
 if p_dimensions ? ''list_id'' and p_dimensions->>''list_id'' not in (''dystopie-vanaf-1990'',''other'') then raise exception ''invalid list'' using errcode=''22023'';end if;
 if p_event=''rating_saved'' then allowed:=allowed||array[''operation''];if p_dimensions->>''operation'' is null or p_dimensions->>''operation'' not in (''new'',''updated'') then raise exception ''invalid operation'' using errcode=''22023'';end if;end if;
 if exists(select 1 from jsonb_object_keys(p_dimensions) k where not(k=any(allowed))) then raise exception ''denied property'' using errcode=''22023'';end if;
 -- Serialize with revocation on this SHORT-LIVED consent row, never a visitor ID.
 select * into g from product_metrics_test.consent_grants where token=product_metrics_test.request_grant() for update;
 t:=product_metrics_test.current_time();event_day:=(t at time zone ''UTC'')::date;
 if not found or g.revoked_at is not null or g.version<>1 or g.expires_at<=t then perform product_metrics_test.operational(''consent_denied'');return ''consent_denied'';end if;
 if exists(select 1 from product_metrics_test.receipts where event_id=p_event_id and expires_at>t) then perform product_metrics_test.operational(''duplicate'');return ''duplicate'';end if;
 insert into product_metrics_test.grant_budgets values(g.token,date_trunc(''minute'',t),1,t+interval ''1 hour'') on conflict(grant_id,minute) do update set n=product_metrics_test.grant_budgets.n+1 where product_metrics_test.grant_budgets.n<60 returning n into minute_count;
 if minute_count is null then perform product_metrics_test.operational(''grant_rate_limited'');return ''grant_rate_limited'';end if;
 insert into product_metrics_test.budgets values(date_trunc(''minute'',t),1,t+interval ''1 hour'') on conflict(minute) do update set n=product_metrics_test.budgets.n+1 where product_metrics_test.budgets.n<600 returning n into minute_count;
 if minute_count is null then perform product_metrics_test.operational(''project_rate_limited'');return ''project_rate_limited'';end if;
 delete from product_metrics_test.receipts where event_id=p_event_id and expires_at<=t;
 insert into product_metrics_test.receipts values(p_event_id,t,t+case when p_event in (''taste_round_started'',''taste_round_completed'',''sign_in_succeeded'') then interval ''90 days'' else interval ''1 day'' end) on conflict(event_id) do nothing returning event_id into receipt;
 if receipt is null then perform product_metrics_test.operational(''duplicate'');return ''duplicate'';end if;
 insert into product_metrics_test.daily_counters values(event_day,p_event,p_dimensions,1,(event_day::timestamp at time zone ''UTC'')+interval ''90 days'') on conflict(day,event,dimensions) do update set n=product_metrics_test.daily_counters.n+1;
 perform product_metrics_test.operational(''accepted'');
 return ''counted'';
exception when lock_not_available then perform product_metrics_test.operational(''busy'');return ''busy'';
 when invalid_parameter_value or insufficient_privilege then perform product_metrics_test.operational(''invalid_payload'');return ''invalid_payload'';
 when query_canceled or others then perform product_metrics_test.operational(''storage_error'');return ''storage_error'';
end','
declare minute_count integer;allowed text[];is_round boolean;is_rec boolean;c jsonb;t timestamptz;g product_metrics_test.consent_grants;receipt uuid;event_day date;
begin
 if p_event_id is null or p_event is null or p_event not in (''recommendation_impression'',''recommendation_open'',''want_to_read_saved'',''taste_round_started'',''taste_round_completed'',''page_opened'',''editorial_list_opened'',''reading_guide_opened'',''book_card_opened'',''book_detail_opened'',''rating_saved'',''taste_result_opened'',''sign_in_succeeded'',''referral_arrival'',''search_started'',''search_results'',''search_empty'',''search_failed'',''search_book_opened'',''guest_round_started'',''guest_round_completed'',''guest_book_saved'',''guest_save_failed'',''guest_suggestions_empty'',''guest_suggestions_failed'') then raise exception ''invalid event'' using errcode=''22023'';end if;
 if p_event in (''rating_saved'',''want_to_read_saved'',''taste_round_started'',''taste_round_completed'') and pg_trigger_depth()=0 then raise exception ''server transition required'' using errcode=''42501'';end if;
 if p_event=''sign_in_succeeded'' and (auth.uid() is null or nullif(auth.jwt()->>''session_id'','''') is null or p_event_id is distinct from md5(''login:''||(auth.jwt()->>''session_id''))::uuid) then raise exception ''verified session required'' using errcode=''42501'';end if;
 if jsonb_typeof(p_dimensions) is distinct from ''object'' or octet_length(p_dimensions::text)>768 then raise exception ''invalid dimensions'' using errcode=''22023'';end if;
 c:=jsonb_build_object(''locale'',p_dimensions->''locale'',''surface'',p_dimensions->''surface'',''source'',p_dimensions->''source'',''medium'',p_dimensions->''medium'',''campaign'',p_dimensions->''campaign'',''traffic'',p_dimensions->''traffic'');
 if not product_metrics_test.valid_context(c) then raise exception ''invalid context'' using errcode=''22023'';end if;
 if p_event=''referral_arrival'' and p_dimensions->>''source'' is distinct from ''leesroutes'' then raise exception ''invalid referral'' using errcode=''22023'';end if;
 is_round:=p_event like ''taste_round_%'';is_rec:=p_event like ''recommendation_%'';
 allowed:=array[''locale'',''surface'',''source'',''medium'',''campaign'',''traffic'',''device''];
 if p_dimensions ? ''device'' and (jsonb_typeof(p_dimensions->''device'') is distinct from ''string'' or p_dimensions->>''device'' not in (''mobile'',''desktop'')) then raise exception ''invalid device'' using errcode=''22023'';end if;
 if is_round then allowed:=allowed||array[''goal''];end if;
 if is_rec or p_event in (''want_to_read_saved'',''book_card_opened'',''book_detail_opened'',''rating_saved'',''search_book_opened'',''guest_book_saved'',''guest_save_failed'') then allowed:=allowed||array[''work_id''];
  if jsonb_typeof(p_dimensions->''work_id'') is distinct from ''number'' or (p_dimensions->>''work_id'')!~''^[1-9][0-9]{0,14}$'' then raise exception ''invalid work'' using errcode=''22023'';end if;
 end if;
 if is_rec then allowed:=allowed||array[''position'',''ranker_version''];
  if p_dimensions->>''ranker_version'' is distinct from ''8f337dd'' or jsonb_typeof(p_dimensions->''position'') is distinct from ''number'' or (p_dimensions->>''position'')!~''^[1-9][0-9]?$|^100$'' then raise exception ''invalid ranking dimensions'' using errcode=''22023'';end if;
 end if;
 if p_event=''want_to_read_saved'' then allowed:=allowed||array[''ranker_version''];end if;
 if p_dimensions ? ''ranker_version'' and p_dimensions->>''ranker_version'' is distinct from ''8f337dd'' then raise exception ''invalid ranker'' using errcode=''22023'';end if;
 if is_round and (jsonb_typeof(p_dimensions->''goal'') is distinct from ''number'' or p_dimensions->>''goal'' not in (''10'',''15'',''20'',''30'')) then raise exception ''invalid goal'' using errcode=''22023'';end if;
 if p_event in (''book_card_opened'',''editorial_list_opened'',''reading_guide_opened'') then allowed:=allowed||array[''list_id''];end if;
 if p_event=''reading_guide_opened'' and (p_dimensions->>''locale'' is distinct from ''nl'' or p_dimensions->>''list_id'' is null or p_dimensions->>''list_id'' not in (''suzanne-vermeer'',''fantasy-om-mee-te-beginnen'',''na-project-hail-mary'')) then raise exception ''invalid guide'' using errcode=''22023'';end if;
 if p_dimensions ? ''list_id'' and p_dimensions->>''list_id'' not in (''dystopie-vanaf-1990'',''other'',''suzanne-vermeer'',''fantasy-om-mee-te-beginnen'',''na-project-hail-mary'') then raise exception ''invalid list'' using errcode=''22023'';end if;
 if p_event=''rating_saved'' then allowed:=allowed||array[''operation''];if p_dimensions->>''operation'' is null or p_dimensions->>''operation'' not in (''new'',''updated'') then raise exception ''invalid operation'' using errcode=''22023'';end if;end if;
 if exists(select 1 from jsonb_object_keys(p_dimensions) k where not(k=any(allowed))) then raise exception ''denied property'' using errcode=''22023'';end if;
 -- Serialize with revocation on this SHORT-LIVED consent row, never a visitor ID.
 select * into g from product_metrics_test.consent_grants where token=product_metrics_test.request_grant() for update;
 t:=product_metrics_test.current_time();event_day:=(t at time zone ''UTC'')::date;
 if not found or g.revoked_at is not null or g.version<>1 or g.expires_at<=t then perform product_metrics_test.operational(''consent_denied'');return ''consent_denied'';end if;
 if exists(select 1 from product_metrics_test.receipts where event_id=p_event_id and expires_at>t) then perform product_metrics_test.operational(''duplicate'');return ''duplicate'';end if;
 insert into product_metrics_test.grant_budgets values(g.token,date_trunc(''minute'',t),1,t+interval ''1 hour'') on conflict(grant_id,minute) do update set n=product_metrics_test.grant_budgets.n+1 where product_metrics_test.grant_budgets.n<60 returning n into minute_count;
 if minute_count is null then perform product_metrics_test.operational(''grant_rate_limited'');return ''grant_rate_limited'';end if;
 insert into product_metrics_test.budgets values(date_trunc(''minute'',t),1,t+interval ''1 hour'') on conflict(minute) do update set n=product_metrics_test.budgets.n+1 where product_metrics_test.budgets.n<600 returning n into minute_count;
 if minute_count is null then perform product_metrics_test.operational(''project_rate_limited'');return ''project_rate_limited'';end if;
 delete from product_metrics_test.receipts where event_id=p_event_id and expires_at<=t;
 insert into product_metrics_test.receipts values(p_event_id,t,t+case when p_event in (''taste_round_started'',''taste_round_completed'',''sign_in_succeeded'') then interval ''90 days'' else interval ''1 day'' end) on conflict(event_id) do nothing returning event_id into receipt;
 if receipt is null then perform product_metrics_test.operational(''duplicate'');return ''duplicate'';end if;
 insert into product_metrics_test.daily_counters values(event_day,p_event,p_dimensions,1,(event_day::timestamp at time zone ''UTC'')+interval ''90 days'') on conflict(day,event,dimensions) do update set n=product_metrics_test.daily_counters.n+1;
 perform product_metrics_test.operational(''accepted'');
 return ''counted'';
exception when lock_not_available then perform product_metrics_test.operational(''busy'');return ''busy'';
 when invalid_parameter_value or insufficient_privilege then perform product_metrics_test.operational(''invalid_payload'');return ''invalid_payload'';
 when query_canceled or others then perform product_metrics_test.operational(''storage_error'');return ''storage_error'';
end'),
 ('product_metrics_test.valid_context(jsonb)','a12845f5d78a46df784b7cfe471011e6','97a1523388352128e1e947b1b5124ecd','
 select coalesce(jsonb_typeof(p)=''object'' and p->>''locale'' in (''nl'',''en'') and p->>''surface'' in (''home'',''recommendations'',''taste_result'',''book_detail'',''collection'',''editorial'',''browse'',''login'',''taste_test'',''other'') and p->>''traffic''=''synthetic''
 and (p-array[''locale'',''surface'',''source'',''medium'',''campaign'',''traffic''])=''{}''::jsonb and
 ((p->>''source''=''facebook'' and p->>''medium''=''organic_social'' and p->>''campaign''=''dystopie_202610'') or (p->>''source'' in (''google'',''bing'',''other_search'') and p->>''medium''=''organic_search'' and p->>''campaign''=''none'') or (p->>''source''=''leesroutes'' and p->>''medium''=''referral'' and p->>''campaign''=''none'') or (p->>''source''=''direct_unknown'' and p->>''medium''=''unknown'' and p->>''campaign''=''none'')),false)
','
 select coalesce(jsonb_typeof(p)=''object'' and p->>''locale'' in (''nl'',''en'') and p->>''surface'' in (''home'',''recommendations'',''taste_result'',''book_detail'',''collection'',''editorial'',''browse'',''login'',''taste_test'',''other'') and p->>''traffic''=''synthetic''
 and (p-array[''locale'',''surface'',''source'',''medium'',''campaign'',''traffic''])=''{}''::jsonb and
 ((p->>''medium''=''organic_social'' and ((p->>''source''=''facebook'' and p->>''campaign''=''dystopie_202610'') or (p->>''source'' in (''facebook'',''instagram'') and p->>''campaign''=''leesroutes_202611''))) or (p->>''source'' in (''google'',''bing'',''other_search'') and p->>''medium''=''organic_search'' and p->>''campaign''=''none'') or (p->>''source''=''leesroutes'' and p->>''medium''=''referral'' and p->>''campaign''=''none'') or (p->>''source''=''direct_unknown'' and p->>''medium''=''unknown'' and p->>''campaign''=''none'')),false)
')
 ) as changes(signature,before_hash,after_hash,before_body,after_body) loop
  target:=to_regprocedure(r.signature);select prosrc into body from pg_proc where oid=target;
  if target is null then raise exception 'MISSING_METRICS_FUNCTION %',r.signature;end if;
  if md5(body)=r.after_hash then continue;end if;
  if md5(body)<>r.before_hash then raise exception 'UNEXPECTED_METRICS_BASELINE %',r.signature;end if;
  definition:=pg_get_functiondef(target);
  execute replace(definition,r.before_body,r.after_body);
  select prosrc into body from pg_proc where oid=target;
  if md5(body)<>r.after_hash then raise exception 'UNEXPECTED_METRICS_RESULT';end if;
 end loop;
end $patch$;
commit;
