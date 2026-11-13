-- Leesroutes referral allowlist patch; no table, policy, trigger, grant or retention changes.
-- Production only. Review against a read-only baseline; set lumiscore.metrics.release_target first.
begin;
set local lock_timeout='1s';
set local statement_timeout='5s';
do $patch$
declare r record; oid_value oid; body text; definition text;
begin
 if current_setting('lumiscore.metrics.release_target',true) is distinct from 'qvplwejffhjvxaypmjut' then raise exception 'WRONG_METRICS_TARGET';end if;
 for r in select * from (values
  ('product_metrics.valid_context(jsonb)','dbd4208e0de0a22889ca349e182c804a','25eeaebbfce79222d9b2e41191e61ea4','(p->>''source''=''direct_unknown'' and p->>''medium''=''unknown'' and p->>''campaign''=''none'')','(p->>''source''=''leesroutes'' and p->>''medium''=''referral'' and p->>''campaign''=''none'') or (p->>''source''=''direct_unknown'' and p->>''medium''=''unknown'' and p->>''campaign''=''none'')'),
  ('product_metrics.record_event(uuid,text,jsonb)','6defac60d9666fc12a8a55619f95054f','3d84613e0c3fc503458476a1b5c13c10','''taste_result_opened'',''sign_in_succeeded'') then raise exception ''invalid event''','''taste_result_opened'',''sign_in_succeeded'',''referral_arrival'') then raise exception ''invalid event'''),
  ('product_metrics.record_event(uuid,text,jsonb)','3d84613e0c3fc503458476a1b5c13c10','0662b91b51509706d6a76168b5057e15','if not product_metrics.valid_context(c) then raise exception ''invalid context'' using errcode=''22023'';end if;','if not product_metrics.valid_context(c) then raise exception ''invalid context'' using errcode=''22023'';end if;
 if p_event=''referral_arrival'' and p_dimensions->>''source'' is distinct from ''leesroutes'' then raise exception ''invalid referral'' using errcode=''22023'';end if;'),
  ('public.record_product_event_v1(uuid,text,jsonb)','250c772c796fe4fbafff3ce2f8e9b9e3','a852385b3d380935a2d424376d223979','''book_detail_opened'',''taste_result_opened'') then raise exception ''browser event required''','''book_detail_opened'',''taste_result_opened'',''referral_arrival'') then raise exception ''browser event required''')
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
