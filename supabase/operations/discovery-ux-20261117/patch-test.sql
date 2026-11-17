-- Discovery UX metrics: bounded events/device class only. No schema, ACL, trigger or retention changes.
begin;
set local lock_timeout='1s';
set local statement_timeout='5s';
do $patch$
declare r record; target oid; definition text; body text;
begin
 if current_setting('lumiscore.metrics.release_target',true) is distinct from 'hlvujbrmfdlrfxdjwsmb' then raise exception 'WRONG_METRICS_TARGET';end if;
 for r in select * from (values
 ('public.record_product_event_test_v1(uuid,text,jsonb)','ed4fe09c6001c82f0cadeabe12d2253e','585001236fd4ca133a1f2a48bf9af33d','''referral_arrival'') then raise exception','''referral_arrival'',''search_started'',''search_results'',''search_empty'',''search_failed'',''search_book_opened'',''guest_round_started'',''guest_round_completed'',''guest_book_saved'',''guest_save_failed'',''guest_suggestions_empty'',''guest_suggestions_failed'') then raise exception'),
 ('product_metrics_test.record_event(uuid,text,jsonb)','3a59ece16188acc616eb516a85c72820','96a060d194366ba6319543623c4ea503','''referral_arrival'') then raise exception','''referral_arrival'',''search_started'',''search_results'',''search_empty'',''search_failed'',''search_book_opened'',''guest_round_started'',''guest_round_completed'',''guest_book_saved'',''guest_save_failed'',''guest_suggestions_empty'',''guest_suggestions_failed'') then raise exception'),
 ('product_metrics_test.record_event(uuid,text,jsonb)','96a060d194366ba6319543623c4ea503','b13b874ff8f77b1d71783263b2e1b6cb','allowed:=array[''locale'',''surface'',''source'',''medium'',''campaign'',''traffic''];','allowed:=array[''locale'',''surface'',''source'',''medium'',''campaign'',''traffic'',''device''];
 if p_dimensions ? ''device'' and (jsonb_typeof(p_dimensions->''device'') is distinct from ''string'' or p_dimensions->>''device'' not in (''mobile'',''desktop'')) then raise exception ''invalid device'' using errcode=''22023'';end if;'),
 ('product_metrics_test.record_event(uuid,text,jsonb)','b13b874ff8f77b1d71783263b2e1b6cb','f1f220220c049129596357f6f07155e3','if is_rec or p_event in (''want_to_read_saved'',''book_card_opened'',''book_detail_opened'',''rating_saved'')','if is_rec or p_event in (''want_to_read_saved'',''book_card_opened'',''book_detail_opened'',''rating_saved'',''search_book_opened'',''guest_book_saved'',''guest_save_failed'')')
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
