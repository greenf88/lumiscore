-- READ ONLY. Privileged operator/reporting connection; never expose as public RPC.
-- On the isolated test project only: traffic='synthetic' is explicit.
-- No user, session, IP, rating value or private reader table is accessed.
select day,event,dimensions,n from product_metrics_test.daily_counters
where day between date '2026-10-22' and date '2026-10-22'
and dimensions->>'traffic'='synthetic' order by day,event,dimensions::text;

-- Campaign event counts. These are NOT unique visitors or a linked funnel.
select event,dimensions->>'surface' as surface,dimensions->>'operation' as operation,sum(n) as event_count
from product_metrics_test.daily_counters
where day between date '2026-10-22' and date '2026-10-22'
and dimensions->>'traffic'='synthetic' and dimensions->>'source'='facebook'
and dimensions->>'campaign'='dystopie_202610'
group by event,surface,operation order by event,surface,operation;

-- Show exclusion explicitly. Production reports must select production traffic,
-- and say UNAVAILABLE while production instrumentation has not been activated.
select coalesce(dimensions->>'traffic','unknown') as traffic,sum(n) as events
from product_metrics_test.daily_counters group by traffic order by traffic;
