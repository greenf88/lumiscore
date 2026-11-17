-- Discovery UX rollback: bounded events/device class only. No schema, ACL, trigger or retention changes.
begin;
set local lock_timeout='1s';
set local statement_timeout='5s';
do $patch$
declare r record; target oid; definition text; body text;
begin
 if current_setting('lumiscore.metrics.release_target',true) is distinct from 'qvplwejffhjvxaypmjut' then raise exception 'WRONG_METRICS_TARGET';end if;
 for r in select * from (values
 ('public.record_product_event_v1(uuid,text,jsonb)','ec0e9251180f97987d4c4cf6a424533f','a852385b3d380935a2d424376d223979','''referral_arrival'',''search_started'',''search_results'',''search_empty'',''search_failed'',''search_book_opened'',''guest_round_started'',''guest_round_completed'',''guest_book_saved'',''guest_save_failed'',''guest_suggestions_empty'',''guest_suggestions_failed'') then raise exception','''referral_arrival'') then raise exception'),
 ('product_metrics.record_event(uuid,text,jsonb)','97e255286994dcaba045d68977b2c665','fbb71eff876040bb9478eda802f407cd','if is_rec or p_event in (''want_to_read_saved'',''book_card_opened'',''book_detail_opened'',''rating_saved'',''search_book_opened'',''guest_book_saved'',''guest_save_failed'')','if is_rec or p_event in (''want_to_read_saved'',''book_card_opened'',''book_detail_opened'',''rating_saved'')'),
 ('product_metrics.record_event(uuid,text,jsonb)','fbb71eff876040bb9478eda802f407cd','eb025b69cb8bec42ff39fcfe84196ef2','allowed:=array[''locale'',''surface'',''source'',''medium'',''campaign'',''traffic'',''device''];
 if p_dimensions ? ''device'' and (jsonb_typeof(p_dimensions->''device'') is distinct from ''string'' or p_dimensions->>''device'' not in (''mobile'',''desktop'')) then raise exception ''invalid device'' using errcode=''22023'';end if;','allowed:=array[''locale'',''surface'',''source'',''medium'',''campaign'',''traffic''];'),
 ('product_metrics.record_event(uuid,text,jsonb)','eb025b69cb8bec42ff39fcfe84196ef2','0662b91b51509706d6a76168b5057e15','''referral_arrival'',''search_started'',''search_results'',''search_empty'',''search_failed'',''search_book_opened'',''guest_round_started'',''guest_round_completed'',''guest_book_saved'',''guest_save_failed'',''guest_suggestions_empty'',''guest_suggestions_failed'') then raise exception','''referral_arrival'') then raise exception')
 ) as changes(signature,before_hash,after_hash,before_body,after_body) loop
  target:=to_regprocedure(r.signature);
  select prosrc into body from pg_proc where oid=target;
  if target is null or md5(body)<>r.before_hash then raise exception 'UNEXPECTED_METRICS_BASELINE %',r.signature;end if;
  if (length(body)-length(replace(body,r.before_body,'')))/length(r.before_body)<>1 then raise exception 'AMBIGUOUS_METRICS_FRAGMENT';end if;
  definition:=pg_get_functiondef(target);
  execute replace(definition,r.before_body,r.after_body);
  select prosrc into body from pg_proc where oid=target;
  if md5(body)<>r.after_hash then raise exception 'UNEXPECTED_METRICS_RESULT';end if;
 end loop;
end $patch$;
commit;
