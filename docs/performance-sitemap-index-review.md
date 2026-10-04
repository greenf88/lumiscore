# LumiScore performance sitemap and index review

This review prepares an application-only change after PR #8. The confirmed problems are an unnecessary full recommendation-catalog transfer and the omission of the indexable category overview from the sitemap. Both are corrected locally. No production configuration, schema, data, imports, Auth accounts or deployments were changed. The two foreign-key INFOs were evaluated, not automatically converted into migrations.

## Baseline and measurement limits

Remote `main` was fetched again and remains `02a5d9073d1c93914018945f38c9dbb9d1fd675a`. The authenticated Vercel dashboard independently shows this source commit on the Ready Production deployment `dpl_J7DfaKAkRn1duCzdibE3Bh7hQ4dP`, serving `https://lumisco.re/` through `lumiscore-5j6u7ha0g-rgkgroeneveld-9102.vercel.app`. The isolated branch is `feature/performance-sitemap-index-review-20261004`.

Bounded read-only aggregate queries confirm 10,134 Works, 10,293 Editions, 5,650 Authors, 3,942 current-version evidence rows for 1,283 Works, and 47 taste offers at the final snapshot. The fifteen existing migrations remain present. Effective state-function execution is still denied to `anon` and allowed to `authenticated`. No reader identities or values were retrieved.

The [numeric evidence](performance-review-evidence.json) contains every retained sample, timestamps, URLs, payload sizes, public book counts and query plans. `scripts/measure-performance-review.mjs` performs three sequential HTTP reads per route/device and three read-only anonymous recommendation computations, with no session or cookie. Measurements use Node 24.20.0 on the user's Windows workstation; geographical network egress was not measured. Mobile HTTP measurements change the user agent, **not** the network or CPU. These are not mobile browser LCP measurements.

All retained responses were HTTP 200. CDN headers reported `MISS` and age zero, but internal function and public-catalog caches are unknown. There was no cache purge, production load test or traffic interruption. Header timings include transport, CDN and server work, not isolated server execution. Body sizes are decompressed bytes, not on-wire transfer sizes. The connector's runtime-log and deployment-detail reads returned HTTP 403; no access rights or observability settings were changed. The authorized dashboard confirms the deployment, but no exact runtime query timing is claimed.

An initial filter probe used a noncanonical author parameter and short category labels. It was discarded from the retained filter results and replaced with the actual `author` parameter and stored category IDs. A subsequent reporting-path collision overwrote the first local HTTP artifact; the final production baseline was rerun with distinct production/local output paths. These extra reads remained sequential and read-only. They are not presented as independent repetitions in the retained baseline.

### Public HTTP observations

All numbers below are response-header milliseconds, shown as individual observations followed by median and minimum–maximum. Raw complete-body timings are available in the evidence file.

| Route | Desktop observations | Desktop median and range | Mobile UA observations | Mobile UA median and range |
| --- | --- | --- | --- | --- |
| `/` | 4197, 1334, 569 | 1334; 569–4197 | 567, 424, 454 | 454; 424–567 |
| `/browse` | 340, 253, 280 | 280; 253–340 | 231, 237, 237 | 237; 231–237 |
| `/browse?sort=highest` | 243, 290, 244 | 244; 243–290 | 241, 243, 241 | 241; 241–243 |
| `/search?q=1984` | 293, 257, 289 | 289; 257–293 | 264, 253, 234 | 253; 234–264 |
| `/browse?author=45` | 174, 166, 167 | 167; 166–174 | 172, 175, 183 | 175; 172–183 |
| `/browse?category=fiction_fantasy` | 231, 513, 200 | 231; 200–513 | 179, 199, 189 | 189; 179–199 |
| `/browse?author=45&category=fiction_mystery_crime&sort=highest&page=2` | 128, 140, 112 | 128; 112–140 | 122, 121, 118 | 121; 118–122 |
| `/book/168?returnTo=%2Fbrowse%3Fsort%3Dhighest%26page%3D2` | 126, 127, 121 | 126; 121–127 | 121, 123, 121 | 121; 121–123 |
| `/categories` | 208, 217, 183 | 208; 183–217 | 184, 502, 225 | 225; 184–502 |

Browse transfers 85,495 decoded HTML bytes and 32 unique book links; highest sorting transfers 88,116 bytes and 32 links. Search returns four books in 34,726 bytes. The combined highest-score query legitimately returns zero rated matches; its empty state is not evidence of a successful nonempty intersection. The browser separately verified the nonempty Rowling/fantasy/highest combination and fantasy page two with 32 unique books.

The homepage HTML contains 24 distinct public book links in 67,746 bytes. Guest recommendations load separately: the three API header timings are 3535, 1119 and 1081 ms (median 1119; range 1081–3535), complete timings 3559, 1121 and 1083 ms. Each response contains twenty distinct recommendations in 16,935 bytes with `private, no-cache, no-store` headers. Longer first samples could reflect connection/function/cache state; the cause is not proven from these samples.

### Homepage browser lab results

Three sequential PageSpeed UI analyses at 16:01, 16:18 and 16:30 CEST on 4 October 2026 used Lighthouse 13.5.0 and HeadlessChromium 153.0.8010.36. Google did not expose the exact lab location. The mobile profile was emulated Moto G Power with slow 4G; desktop used its reported desktop/custom-throttling profile. Each report says first page load, while CDN/function cache state remains unknown. The keyless PageSpeed API first returned 429; the public UI supplied the actual lab reports without provisioning a key or resource.

| Metric | Mobile observations | Desktop observations |
| --- | --- | --- |
| LCP milliseconds | 1967, 1961, 1961; median 1961; range 1961–1967 | 408, 408, 408; median 408; range 408–408 |
| FCP milliseconds | 1513, 1508, 1508; median 1508; range 1508–1513 | 367, 367, 367 |
| TBT milliseconds | 0, 0, 0 | 0, 0, 0 |
| CLS | 0, 0, 0 | 0, 0, 0 |
| Speed Index milliseconds | 2479, 1687, 2580; median 2479; range 1687–2580 | 857, 667, 1081; median 857; range 667–1081 |

The reported LCP element is `body > main.site-shell > section#top > div.hero-photo`. The reports have no CrUX data; this is not RUM or a reliable p95. The old 486/887/537 ms HTTP medians were not LCP and are not used as an LCP comparison. Lab LCP for other routes, complete browser request waterfalls and authenticated production LCP remain unmeasured. HTTP request count does not stand in for all image/client requests.

The desktop lab reported a 6,367 KiB total network payload, mainly cover-image opportunities. The mobile lab reported smaller image/cache opportunities. Some Open Library candidate-cover requests returned 404 and activated the existing fallback path; no application exception or hydration overlay was observed locally. Contrast and cover delivery remain separate follow-ups, not changes bundled into this PR. [First lab report](https://pagespeed.web.dev/analysis/https-lumisco-re/tl8jhfkbez?form_factor=desktop) and [third lab report](https://pagespeed.web.dev/analysis/https-lumisco-re/pcvzn9ah7w?form_factor=desktop) support these bounded observations.

## Recommendation cause and correction

Previously, each uncached catalog load paginated all 10,134 Works with authors/Edition metadata, requested 102 batches of public rating summaries and 51 evidence batches, then discarded Works with `coverageLevel=none`. Authenticated personalization repeats this public load per request. Guest requests reuse only the existing public catalog promise for five minutes; private answers and final recommendation results are never shared.

The new loader first reads all current-version **public** evidence with complete primary-key ordering and explicit pagination. It unions those IDs with every reviewed correction ID, including correction-only Works. It then fetches only the needed public Works and summaries. Work/title/year/author/Edition/cover metadata, evidence parser, source priority, corrections, anchors, ranker, exclusions, language and era preferences, collaboration and final selected-book hydration remain unchanged. No new RPC, cache, user-context object or database migration is introduced.

The complete evidence order `(work_id, trait, source, source_key)` avoids missing dense evidence at the REST row limit. Missing exact counts or failed evidence/Work pages throw; they are not converted into a fabricated empty success. Like the prior multi-request loader, this is not a transaction-wide snapshot if public editorial evidence changes concurrently. Stable public data and current mapping version remain the applicability condition for exact ranking comparisons.

Reader context continues to verify the server user and filter ratings, statuses, answers and preferences by that user. React request-local reuse and private/no-store response headers remain unchanged. Authenticated requests continue to query fresh public summaries and own ratings. The existing five-minute guest catalog cache can still lag a public aggregate change; this PR does not promise new instantaneous guest invalidation. It does not cache private recommendations or mutate ratings.

### Controlled synthetic comparison

Disposable PGlite PostgreSQL, the real supabase-js client and a SQL-backed fetch adapter use 10,134 invented Works, 10,293 Edition records, 5,650 author identities and 3,942 evidence rows across 1,283 Works. The nine correction-only IDs intentionally add a conservative edge case. Each loader gets one warmup; three comparisons alternate loader order in the same process/database, without simulated network delay or personal caches.

| Observation | Before | After |
| --- | --- | --- |
| Catalog wall milliseconds | 443, 426, 408; median 426; range 408–443 | 103, 162, 92; median 103; range 92–162 |
| Requests | 164 | 24 |
| Public Work records transferred | 10,134 | 1,292 |
| Decoded response bytes | 4,622,335 | 1,388,389 |
| Recommendation candidates | 1,283 | 1,283 |

These are local SQL/serialization/client-processing measurements, not actual PostgREST transport, production speedup or LCP improvements. Candidate equality is exact, profile equality covers both locales, all quiz choices and supported/uncovered rating evidence; full ranking checks preserve NL preference, collaboration, exclusions and twenty unique Works. Dense 2,400-row evidence pages, missing pages, empty/small pools, reader independence and fresh summary reads are tested.

A single public read-only query-shape measurement of the unreleased loader against production metadata transferred 1,283 Works, all 3,942 evidence rows and 2,747,628 decoded bytes in 24 requests. It yields 1,281 covered candidates; two evidence-bearing Works were already excluded by corrections/coverage rules. The old public loader observation transferred all 10,134 Works and 6,216,576 bytes in 164 requests. One-sample wall times of 5583 and 2376 ms are not a controlled remote latency comparison. The unchanged public guest endpoint and the local changed endpoint independently return the same twenty Work IDs in identical order across three samples each. The simplified network-measurement mapper is not used by the application.

## Sitemap correction

Production `/categories` returns 200, exactly one `index, follow` robots instruction and canonical `https://lumisco.re/categories`. The route has twenty existing public categories. NL/EN are still request-language variants of the same canonical URL, not newly introduced language paths.

The omission was the missing path in `buildPublicSitemapPaths`. One path is added; no book or Collection is removed and no filter/search/recommendation URL is added. Production baseline has 10,201 unique URLs, including all 10,134 books and 59 Collections, but zero category-overview entries. Local revised output has 10,202 URLs with the same book/Collection coverage and exactly one category overview. Unit and actual server-HTML regression tests cover uniqueness, indexability, canonical, both request languages and exclusion of query/private routes. No classification or routing migration is involved.

## Foreign key review

Both current [unindexed foreign-key INFOs](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys) concern `public.taste_rating_offers`:

- `taste_rating_offers_round_id_user_id_fkey`: `(round_id,user_id)` references `taste_rating_rounds(id,user_id) ON DELETE CASCADE`.
- `taste_rating_offers_work_id_fkey`: `(work_id)` references `works(id)` with the default no-action behavior.

Existing indexes are the unique primary key `(user_id,work_id)`, nonunique `(round_id,decision)`, and unique partial `(round_id) WHERE decision='offered'`. They are valid, ready and live, each 16,384 bytes in the observed production snapshot. Round IDs identify one owner; the round-prefix index already narrows a round/owner lookup. App reads use round prefixes or `(user_id,work_id)`, not unscoped private work lookups. The work foreign key lacks a leading `work_id` index; the primary key can nevertheless support a more expensive suffix/full-index scan.

Production used **EXPLAIN without ANALYZE**, inside bounded read-only transactions with a ten-second timeout and nonpersonal constants. At 47 offers, plans choose tiny sequential scans with estimated costs 1.6 for round/owner and 1.5 for work. No actual production execution cost or SLA is inferred.

The separate disposable 100,000-offer fixture tests existing indexes, an additional round/owner pair, then a work index. It performs one warmup and three 100-lookup batches per variant, plus three 1,000-row insert batches rolled back locally. It is a hypothetical growth scenario, not today's production volume. Variant order and cache warming limit precision; measured samples are preserved rather than turned into p95 claims.

| Fixture result | Existing | Additional round and owner | Additional work |
| --- | --- | --- | --- |
| Round lookup ms/call | 1.6756, 1.4538, 1.1927 | 2.0043, 1.6350, 0.8882 | 1.0279, 1.0933, 0.9836 |
| Work lookup ms/call | 7.7184, 7.4594, 7.5331 | 6.1603, 6.1787, 6.3037 | 0.6970, 0.7327, 0.6890 |
| Insert 1000 ms | 14, 15, 17 | 16, 30, 17 | 15, 15, 15 |
| Extra index bytes | 0 | 1,187,840 | 1,040,384 |

The additional round pair gives no consistent measured latency gain and overlaps useful existing prefixes. The work index demonstrably helps hypothetical large work-only/FK-parent checks, but these are not a current application hot path and current volume is tiny. **No index migration is proposed in this release.** Reassess when actual offer growth or a measured slow parent-work check justifies the maintenance/storage cost. The separate `ratings_positive_user_work_idx` unused-index INFO remains untouched. Migration names/hashes for this PR are therefore not applicable; previously applied SQL is unchanged.

## Validation and remaining evidence

- Full suite: 553 passed, zero failed/skipped/cancelled. It exercises real disposable PostgreSQL permissions, RLS, owner isolation, three explicit twenty-rating rounds, skip/resume/idempotence, existing-rating preservation and server-paged combined filters. There were no remote test writes or imports.
- The first full run found one pre-existing Windows test-parser failure: the recovery excerpt regex accepted LF only while its Markdown checkout used CRLF. The parser now accepts either and fails explicitly if the block is absent. Recovery SQL, migration history and application recovery behavior were not changed. The focused test and full rerun pass.
- TypeScript and repository ESLint pass. Vinext and Vercel-target **local** builds pass. The latter is not a deployment. The secret scan checks 98 built client files; no server-secret identifiers or configured secret values are bundled. Public-only build configuration was read in memory from an existing file; it was not copied into this worktree or Git. `git diff --check` passes.
- Actual local server HTML: 33 integration tests pass, including categories/sitemap, metadata uniqueness, NL/EN and redirects. This checks the local server, not a new deployed Preview.
- Browser: default desktop and 390×844 mobile viewport, NL/EN, Ink/Paper, twenty unique guest recommendations, category click, writer/category/highest intersection, fantasy page two with 32 unique books, Search with four results, bookdetail and return preserving author/category/highest. No horizontal overflow, application console exception or hydration overlay was observed. The viewport override was reset. Taste-test sign-in/guest gate renders; no production rating or round was started.
- Actual modified authenticated homepage browser sessions were not replayed: existing protected test credential storage is inaccessible under the executing identity. No ACL/config change, credential extraction, provisioning or remote test writes were attempted. Real SQL owner isolation/round tests, exact public-candidate/profile equivalence and unchanged authenticated request flow provide the available evidence; a hosted authenticated browser recheck is still a review gate before production release.

This change is initially published as a Draft PR. A green build alone does not prove its new branch Preview has catalog access. Keep Draft if the branch Preview lacks a working public data target or authenticated review evidence. Do not reuse the old branch's test overrides automatically; configuration changes were not approved here.

### Published review status

[Draft PR #9](https://github.com/greenf88/lumiscore/pull/9) was opened for application commit `e4a5e2a231386243a36fe70fe74fc66e764b05d8` against unchanged main. It is mergeable but remains Draft. The GitHub connector denied PR creation with 403; the existing authorized GitHub browser session created it without changing integration access.

The automatic Preview for that commit is Ready at `https://lumiscore-1dwp3t395-rgkgroeneveld-9102.vercel.app/`, deployment `dpl_FWNsjMAozjJoDwn56VmsmDcED5zE`. The two successful remote checks are **Vercel deployment** and **Vercel Preview Comments**, not a remote execution of the full local test suite. The authorized browser homepage visibly displays “Catalogus tijdelijk niet beschikbaar” and zero featured books. Its data target/configuration has not been proven, so this is not a successful data-backed online verification. Direct unauthenticated API probing is stopped by Vercel Authentication (401); browser navigation to Browse is also blocked by the client. Neither protection was bypassed and no setting was changed.

The remaining review gate is therefore concrete: establish approved branch-only access to the existing synthetic test project, without production fallback or shared overrides, and enable access to the existing protected synthetic test credentials under an authorized identity. Then recheck the modified authenticated recommendation flow, rating freshness and isolation online before Ready. This task does **not** authorize those configuration/access changes or hosted test writes; bundle any necessary extension into a separate approval. No new project or database migration is needed for the application diff. A subsequent documentation-only commit records this status; its final SHA is reported on the PR, with application evidence reused only because application code is unchanged.

## Review and separate release proposal

Review the final PR HEAD and its exact diff: evidence-first public loader, one sitemap path, focused regression tests, reproducible read-only/synthetic measurements and this report. Confirm fresh CI and data-backed Preview/local browser evidence, including the remaining authenticated browser gate, before Ready for review. Preserve the isolated branch, other workspaces, secrets and backups.

After separate approval bound to that final SHA: fetch main, recheck HEAD/diff/CI/mergeability and the unchanged production database identity. Apply **no database migration**, import, seed, test account, configuration change or index correction. Merge only the reviewed application PR via the normal strategy and let the normal automatic Production deployment occur once. Verify the new sitemap count/one categories URL, complete book/Collection coverage, actual recommendation order/private headers, filters/pagination/highest-return and desktop/mobile NL/EN Ink/Paper on `lumisco.re`. Remeasure production separately with the same bounded method; do not relabel this local benchmark as the live result.

If an application regression is demonstrated, use the established application-only rollback to the prior Production merge `02a5d9073d1c93914018945f38c9dbb9d1fd675a`. Preserve all database migrations, later ratings and taste progress. No database restore, down-migration or destructive cleanup is part of this proposal. Production execution still requires explicit separate approval.
