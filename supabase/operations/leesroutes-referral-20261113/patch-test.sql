-- Leesroutes referral allowlist patch; no table, policy, trigger, grant or retention changes.
-- Synthetic test only. Review against a read-only baseline; set lumiscore.metrics.release_target first.
begin;
set local lock_timeout='1s';
set local statement_timeout='5s';
do $patch$
declare r record; oid_value oid; body text; definition text;
begin
 if current_setting('lumiscore.metrics.release_target',true) is distinct from 'hlvujbrmfdlrfxdjwsmb' then raise exception 'WRONG_METRICS_TARGET';end if;
 for r in select * from (values
  ('product_metrics_test.valid_context(jsonb)','0313e1ecf9ba7b34709e9b136e710d90','a12845f5d78a46df784b7cfe471011e6','(p->>''source''=''direct_unknown'' and p->>''medium''=''unknown'' and p->>''campaign''=''none'')','(p->>''source''=''leesroutes'' and p->>''medium''=''referral'' and p->>''campaign''=''none'') or (p->>''source''=''direct_unknown'' and p->>''medium''=''unknown'' and p->>''campaign''=''none'')'),
  ('product_metrics_test.record_event(uuid,text,jsonb)','67c79487a391c693ae29f2a34e5c02c9','5bbbe7faf7d3f8c159cf8b15040d9d8d','''taste_result_opened'',''sign_in_succeeded'') then raise exception ''invalid event''','''taste_result_opened'',''sign_in_succeeded'',''referral_arrival'') then raise exception ''invalid event'''),
  ('product_metrics_test.record_event(uuid,text,jsonb)','5bbbe7faf7d3f8c159cf8b15040d9d8d','3a59ece16188acc616eb516a85c72820','if not product_metrics_test.valid_context(c) then raise exception ''invalid context'' using errcode=''22023'';end if;','if not product_metrics_test.valid_context(c) then raise exception ''invalid context'' using errcode=''22023'';end if;
 if p_event=''referral_arrival'' and p_dimensions->>''source'' is distinct from ''leesroutes'' then raise exception ''invalid referral'' using errcode=''22023'';end if;'),
  ('public.record_product_event_test_v1(uuid,text,jsonb)','8c373b1093031520d683a1bdcf626572','ed4fe09c6001c82f0cadeabe12d2253e','''book_detail_opened'',''taste_result_opened'') then raise exception ''browser event required''','''book_detail_opened'',''taste_result_opened'',''referral_arrival'') then raise exception ''browser event required''')
 ) as changes(signature,before_hash,after_hash,before_fragment,after_fragment) loop
  oid_value:=to_regprocedure(r.signature);
  if oid_value is null then raise exception 'MISSING_METRICS_FUNCTION %',r.signature;end if;
  select prosrc into body from pg_proc where oid=oid_value;
  if md5(body)<>r.before_hash then raise exception 'UNEXPECTED_METRICS_BASELINE %',r.signature;end if;
  if (length(body)-length(replace(body,r.before_fragment,'')))/length(r.before_fragment)<>1 then raise exception 'UNEXPECTED_METRICS_FRAGMENT %',r.signature;end if;
  definition:=pg_get_functiondef(oid_value);
  execute replace(definition,r.before_fragment,r.after_fragment);
  select prosrc into body from pg_proc where oid=oid_value;
  if md5(body)<>r.after_hash then raise exception 'UNEXPECTED_METRICS_RESULT %',r.signature;end if;
 end loop;
end $patch$;
commit;
