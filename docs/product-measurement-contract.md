# LumiScore product measurements — implementation contract

Status 22 October 2026: isolated implementation prepared; test installation is
blocked by the connector. Production collection remains disabled. The dated
checkpoints below describe historical evidence, not current hosted proof.

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

## Minimal campaign extension — 22 October 2026

The five existing names and their meaning above are retained. Necessary additions:

| Event | Actual trigger | Extra bounded properties |
| --- | --- | --- |
| page_opened | One hydrated route/document entry; a full reload is another pageview, never a unique visit | surface |
| editorial_list_opened | The corresponding list content is present, including streamed navigation | surface, list_id |
| book_card_opened | Native primary/middle/keyboard activation of an internal book link; repeated activation within 750ms suppressed | surface, list_id, work_id |
| book_detail_opened | The matching Work's detail content is present | surface, work_id |
| rating_saved | Committed insert or actual rating-value change; unchanged upsert/retry emits nothing | surface, work_id, operation=new/updated |
| taste_result_opened | Successful authenticated result content rendered, not loading/error/signed-out state | surface |
| sign_in_succeeded | Successful password sign-in; one receipt per actual verified Auth session | surface |

Result opening does not itself prove completion: a valid existing partial result
may be viewed. Only taste_round_completed proves the actual goal transition.
The separate guest-preferences questionnaire is not an authenticated rating round;
its pageviews must never be reported as taste_round_started/completed successes.

Recommendation opens count once per mounted impressed card. The rating score is
never collected. The canonical database transition, not the score click or a
before/after client guess, produces ratings, want-to-read and round events.
Round start means INSERT of a real round; completion means completed_at changes
NULL->timestamp under the existing goal-completion RPC. Reopening/extending the
same round cannot produce another completion within the 90-day receipt window.
Existing rating/scoring/round SQL and data remain unchanged; optional AFTER
observers on test can neither authorize writes nor roll back a business write.

Common allowed dimensions: locale, surface, source, medium, campaign, traffic.
Only facebook/organic_social/dystopie_202610 is an accepted campaign tuple.
Known Google/Bing/DuckDuckGo referrer hosts map to bounded search-source enums;
absent, private, unrecognized or stripped provenance is direct_unknown/unknown.
No raw referrer, URL, query, utm_term/content or arbitrary campaign text is saved.
The public request URL/canonical/sitemap policy is unchanged.

Only bounded campaign context, no identifier, survives in this tab's sessionStorage
for 30 minutes of inactivity. Storage denial loses cross-route attribution; no
fallback tracking identifier is created. NL/EN switching updates presentation
locale without inventing a preferred book language. No tracking cookies, external
SDK, fingerprinting or user/visitor/session ID is introduced. GPC/DNT disable both
browser events and mutation context. Existing essential Auth/locale/guest state
and Speed Insights are unchanged. There is no existing product-analytics consent
UI in this repository. This synthetic-only test does not settle production consent
or provider access-log policy; those remain explicit production activation gates.

All test events carry traffic=synthetic, enforced by SQL. Reports exclude that
traffic by default and show production unavailable rather than a zero baseline.
UTC day counters and opaque per-event receipts retain a rolling 90-day window;
purging is opportunistic during collection, not a new scheduled job. After that
window, lifetime deduplication/history is unavailable. Receipt hashes are not
shared across different event types and are not visitor join keys.

Retention clarification after the final installation review: the exact predicate
keeps today plus90 previous UTC dates (91 dates) and deletes only on later
collection; idle data has no wall-clock deletion guarantee. Campaign context has
30-minute logical validity but expired sessionStorage is not proactively erased.
Round/login receipt hashes are deterministic pseudonymous derivatives of a
round/Auth-session identity; an operator with the source IDs can recompute them.
They are not raw user/session IDs or a supported funnel key, but must not be
described as guaranteed anonymous. See the separate privacy/capacity review for
actual pre/post-consent behavior and the unimplemented production decision.

The public collector accepts at most ten browser observations/8192 bytes and
batches emissions after hydration, never delaying native navigation. Server
success events cannot be posted through that endpoint. Sign-in delivery runs
after the response with a one-second limit. Mutation observers use the same
database transaction, a nonwaiting metrics lock, exception isolation and no
additional catalog/auth queries. A busy/outage/rate-limit drop is missing data,
not a failed business action. The existing global 120-event/minute cap remains;
it needs explicit capacity review before a real campaign. Public observations
are bot/spoofable and cannot drive ranking, authorization or popularity claims.

Reporting units are pageviews and event counts. Sessions, users, unique people,
linked discover->login->rate conversion, exact abandonment and retention remain
unknown under the intentionally identifier-free contract. Event ratios always
show numerator, denominator, period and the absence of a linked cohort; they may
exceed one. 517 ratings/19 rounds remain unvalidated historical reports.

Current storage proof: local actual PostgreSQL/PGlite only. One new authorized
test installation attempt returned `McpServerError: Invalid or expired requestState`;
readback confirmed no table/RPC/triggers. No alternate write route or repeated
installation attempt is used. Hosted end-to-end counter storage is NOT proven.

Acceptance: synthetic successful/failed saves, duplicate component renders, keyboard
and native navigation, locale switch, retries/offline, denied properties and no
personal-data leakage. Roll out on the retained isolated test project first.

## Isolated implementation checkpoint — 19 October 2026

The original definitions above remain authoritative. A separate local implementation
now hard-gates collection to `hlvujbrmfdlrfxdjwsmb`; production is inactive. Install
SQL is test support, not a production migration. The test connector's DDL requests
failed twice with `Invalid or expired requestState`; readback confirmed no counter
table or RPC exists. Thus this is NOT yet activated or verified on hosted test.

Recommendation cards use continuous 50%-for-1s visibility and native/keyboard link
activation only after an impression. Confirmed saves follow reconciled changed
status, not an optimistic button click. Round events follow a successful server
state transition, with no event on failed writes/resume/already-complete state.
Server events cannot be posted to the browser collector. Metrics failure does not
turn a successful rating/status operation into an application retry.

Transport has a random/opaque per-event UUID receipt (not an event property, user,
visitor or session identifier), discarded after the bounded replay window. Daily
counters retain only the original allowlisted properties. No persistent browser
identifier, score, URL, search text or account metadata is collected. No automatic
offline replay. Unknown properties fail closed, including on the SQL boundary.
The collector checks origin/type/1024-byte actual body size; the DB bounds traffic
globally to120/minute, with no IP/user-based tracking. Public counters remain
susceptible to bots; no authorization/popularity/ranking decisions use these data.

The test schema has deny-client table ACLs/FORCE RLS; only a narrow invoker RPC
calls a private bounded definer helper. No existing private reader table is read
by that helper. Application mutation credentials are never used by the collector.
The unchanged reviewed ranker is identified by base-code `8f337dd`, not advertised
as an improved algorithm. A local report exposes counts, period and denominators;
unavailable instrumentation/storage is not reported as zero. Saves are not given
card-level attribution without evidence; event ratios are not person conversion.

Remaining gates: real test-target storage/browser/action checks, including native
keyboard navigation, negative HTTP cases and repeat delivery; verify operational
log handling before any hosted activation. Local SQL/mocked transition tests are
not substituted for genuine hosted user writes. No new account or existing rating
was changed for this checkpoint. Production activation needs a separate decision.
