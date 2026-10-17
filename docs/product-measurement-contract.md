# LumiScore product measurements — implementation contract

Status: designed, not collecting events. No tracking SDK, cookies, user/session ID,
production endpoint or database schema is added by this operations package.

## Events and definitions

| Event | Actual trigger | Allowed properties |
| --- | --- | --- |
| recommendation_impression | Card >=50% visible for >=1s; once per mounted card | locale, surface, work_id, position, ranker_version |
| recommendation_open | Native book link activated from an impressed card | same fields |
| want_to_read_saved | Server confirms a new saved status, not optimistic click | locale, surface, work_id, ranker_version if present |
| taste_round_started | Server confirms actual new round | locale, goal |
| taste_round_completed | Server confirms the first incomplete-to-complete transition | locale, goal |

All event names and property keys/values use an allowlist. Do not collect names,
emails, user IDs, cookies, search terms, full URLs, returnTo or free text. Fail closed
on unknown fields. Publication locale is not a user's preferred book language.
Rating writes are already authoritative data; do not duplicate individual scores in
analytics. A skip is not dislike. Clicks are weaker than saves and later ratings.

## Minimal next implementation

Start with aggregate daily counters for events and bounded dimensions; no visitor
profiling, IP logging or persistent identifier in the application collector. Decide
whether the provider's operational logs fit this before activation. Public counters
are vulnerable to bots: validate request origin/type/size, rate limit and keep metrics
out of authorization, scores and public popularity claims.

Aggregate counts can describe event ratios, not unique-person conversion or retention.
Do not report weekly returning users without a separately designed and reviewed
identity/consent model. Until then use voluntary tester feedback for return reasons.

Dashboard: impressions -> opens -> confirmed saves by surface/ranker version;
round starts/completions by goal and locale; source-data classification coverage;
new catalog/cover exceptions. Show denominator, reporting period and sparse data.
Mark missing instrumentation unavailable, not zero. No significance/A-B uplift claims
at the current sample size. A display affinity is not a calibrated probability.

Acceptance: synthetic successful/failed saves, duplicate component renders, keyboard
and native navigation, locale switch, retries/offline, denied properties and no
personal-data leakage. Roll out on the retained isolated test project first.
