# Discovery and rating-based taste test — review evidence

Status: implementation has local evidence, but NOT fully verified in an authenticated online preview or approved for production. Preview diagnosis and isolated test preparation are recorded below. A separate hosted test Supabase still needs approval. Do not merge or apply this migration to production to work around that gate.

## Baseline and concrete changes

Base: `5ce044cb07eb0a5ceb3d8eceb0ed3f7f5e730aae`; branch `feature/discovery-taste-test-20261003`. Existing workspaces, release secrets and backups were not modified.

- The hero displayed `recommendations.slice(0, 3)` while the recommendation engine defaulted to ten. The hero retains its compact preview, but the full Home section and `/recommendations` now show twenty unique eligible Works by default. The overview accepts 10–25; genuine shortages remain visible. Existing evidence thresholds, read/rated exclusions, scores, confidence and explanations remain in use. Medium-sized recommendation covers retain fallback artwork without per-card resolver requests.
- Home highest-rated links omitted their origin, so detail return used the default `/browse` A–Z. They now encode Home explicitly. Browse/Search links preserve query, canonical author ID, category, selection, language, sort, page and page size; recommendation links preserve count. Existing collection membership validation remains unchanged. Internal destination validation rejects external/unknown destinations and invalid Work links. Session scroll restoration and a rating-change freshness marker support native document navigation/browser back.
- `7` was hardcoded and the category statistic was plain text. The actual public `catalog_categories` source contains **20 categories, 19 with linked Works**, with **Cooking & Food empty** at verification. This table has no separate active flag: current published rows are the public source, not research taxonomy. Count and category links are dynamic, localized and available in both themes/menu sizes. No classification was added. Unclassified Works remain in the unrestricted catalog.
- A versioned server RPC adds canonical primary-author filtering and highest-score ordering, combined with existing title/alias/edition search, OR-category, selection and language filters. Filtering/counting precedes pagination; category/Edition relations use EXISTS rather than multiplying Works. The current model has one primary Author-ID per Work, not a coauthor junction. New author/highest controls await this RPC; fallback to the deployed RPC is allowed only when no new filter/order would be silently ignored. Category overview loads metadata without hydrating unused book cards.
- Two owner-readable, FORCE-RLS round/offer tables persist progress. A JWT-owned private transaction function serializes actions per reader, inserts into existing ratings without overwriting, and uses the existing rating-implies-read trigger. Only explicit 1–10 ratings advance the twenty-rating goal. Skips do not rate. Offered, skipped and rated Works are excluded from later rounds. Start resumes unfinished rounds; subsequent rounds are voluntary, including after round three. Users can consciously choose another unrated/unoffered Work. Exhaustion is explicit; language, author/category diversity and existing popularity inform suggestions without invented genres.
- Guests retain the existing device-only preference quiz at `/taste-test/preferences`; it does not claim to save ratings. The default taste test requires verified login for real ratings.
- `/taste-test?prototype=swipe` is opt-in only in local development or preview. Left/right select skip/read intent; skip requires confirmation and read requires explicit score confirmation. Buttons, keyboard arrows on the card, cancel and a gesture-distance/direction threshold remain available. **Recommendation: direct score buttons as the default.** They make scale/meaning more visible and accessible; swipes can speed recognition but introduce ambiguity and gesture errors, so keep them experimental. No swipe creates a score.
- Production-backed review environments block the new taste-test writes and durable production cover-cache refreshes. No security settings or production roles/policies were changed. This is not a blanket sandbox for every pre-existing account action: do not create production test ratings/statuses through other endpoints.

## Verification

The original implementation checks used disposable, in-process PGlite fixtures. The additional isolated full-Supabase checks below use real local Auth/PostgREST/PostgreSQL with synthetic accounts only. No production migration, catalog import, user rating or status write was executed.

- Full unit suite: **539 passed, zero failed** (188.9 seconds, concurrent fixture-heavy run). Subsequent focused checks: **68 passed** after the review-write guard and legacy-order safeguard. An additional guard assertion is included in that focused run. TypeScript and ESLint pass after final UI changes.
- Final SQL/input/empty-schema recovery run: **8 passed**; subsequent scroll/navigation checks: **25 passed**. Equivalent URL defaults/query ordering share the same scroll key. The narrow unused-schema recovery preserves the original ratings, read statuses and editorial RPC in the disposable fixture.
- SQL fixtures contain 10,134 synthetic Works and exercise canonical author/category/language intersection across multiple pages, duplicate Editions, empty results and highest score beyond the aggregate's first 100-ID batch.
- Three complete rounds store **60 distinct explicit ratings**, one separate skip stores no rating, persisted state survives refresh, retries preserve count, existing ratings remain unchanged, and the existing trigger creates read status. Other-owner reads/actions and direct client writes are denied; anon cannot call private progression. A concurrent normal rating is preserved atomically. Exhaustion does not recycle prior offers.
- Five existing real server-HTML catalog tests pass; two added HTML checks pass against the local public read-only review server. They cover category count/links/NL/EN/empty copy, original Home destination, bounded recommendation count and single consistent SEO tags. Fixtures deliberately assert the observed public category baseline.
- Local Vinext production build and Vercel/Nitro preview-target build succeed. The latter uses Node 24. Public-only build configuration is read into process memory; no environment file is copied into this worktree.
- Client secret scan finds no server-secret names/values in compiled public assets; real server secret values were not supplied to these local builds, so this is not proof about every externally configured deployment secret. `git diff --check` passes.
- Browser: desktop 1440×900 and mobile 390×844; NL/EN and Ink/Paper inspected on public views, categories/empty category and return navigation. Home shows **20** recommendations with completed guest evidence; count-25 overview shows **25 distinct Works**. Recommendation → detail → browser back retains `limit=25`; Home highest-rated return restores Home and observed scroll ~1109px. No horizontal overflow or console errors observed. Responsive covers/fallbacks remain usable.
- Authenticated taste-test UI, saved ratings → book/profile → refreshed recommendation flow, combined author/highest filters in the online preview, and actual swipe interactions with an authenticated card remain **NOT end-to-end verified**. Local SQL/API-input tests do not replace those missing browser checks. No separate test configuration is available; preview must report this limitation honestly.

## Performance measurements and limitations

| Measurement | Observed result | Scope |
| --- | --- | --- |
| Two author/category/language page queries | 184ms combined | In-process PostgreSQL, synthetic 10,134 Works, concurrent full test run; not remote latency/SLA |
| Same two filtered queries, isolated focused rerun | 98ms combined | Same synthetic dataset; illustrates local-run/concurrency variability |
| Filtered RPC page JSON | 259 bytes, 32 Work IDs | Excludes later book hydration, covers, HTTP and framework payload |
| Public cold recommendation catalog loader | 164 requests, 6,216,593 decoded response-body bytes, largest response 792,792 bytes, 2,540ms wall time | Real public catalog, 10,134 Works; existing Work/Edition, public aggregate and evidence batch shapes; excludes ranking, later hydration, reader queries and cover requests |

The cold loader remains a significant server-side cost. It does not send all 10,134 Works to the browser. Existing guest catalog cache is five minutes; authenticated loading is not equivalently cached. Changing ranking/storage architecture is not claimed here. One local run, warmed remote caches and workstation/network effects limit inference. New filtered page queries run server-side; no whole-catalog client filter was introduced. No production EXPLAIN or query-time claim is made for the new, unapplied RPC.

## Published preview result — additional open gate

Draft PR: https://github.com/greenf88/lumiscore/pull/8

Preview: https://lumiscore-git-feature-discovery-taste-a1fe88-rgkgroeneveld-9102.vercel.app

Automatic Vercel build and Preview Comments check were green for implementation commit `a380c07d48076b427177101144f48ca76489d2eb`. The online shell loads, but **Categories reports its public source unavailable and Home reports catalog unavailable/zero books**. Consequently this is not a working data-backed preview or a complete functional sign-off. Local public-read-only review on the same code did load the real catalog. The underlying remote configuration/runtime cause is not confirmed: the Vercel deployment reader returned 403 for this scope and build-log reading was unavailable. No remote env values were obtained, copied or changed.

The paragraph above is the historical first observation. **Updated 2026-10-03:** the authorized Vercel dashboard now proves the cause: deployment `dpl_WFoNTw1DKvQE15pLB2zqtzbFERM4` at `4b75a59f92e9a0a47508b154465d5df823aa82f6` built with URL presence **false**, publishable-key presence **true**. Existing Preview URL overrides apply only to `fix/bulk-progress-exit` and `feature/collection-bulk-progress-v1`, not PR #8. It uses no usable Supabase project. No key value was read. The minimal correction is a new, separately approved test project's matching URL/key plus Preview origin, scoped to this branch and rebuilt. No remote setting was changed. Standalone HTTP probes reached Vercel's login protection, not a broken JS asset. Caught auth fallbacks produced misleading successful duration metrics; zero/unavailable UI is not a verified empty database.

Read-only production evidence: 13 baseline migrations, existing legacy catalog RPC and public SELECT/RLS, no PR #8 migration/RPC. Missing new functions are a separate new-feature gate, not the cause of all preview reads failing. Only production is visible in the Free organization; no branch/test project exists. A distinct local stack and reproducible synthetic test artifacts have been prepared. See [the exact test-environment and bundled approval plan](discovery-test-environment.md) for resources/costs, identities, original-byte migration stages, historical prerequisite handling, synthetic users, branch-specific config, Auth/RLS/reset steps and remaining browser checks.

An actual read-only transaction with `SET LOCAL ROLE anon` returned 20 public categories and a legacy catalog total of 10,134 Works. This proves the existing public SQL permissions on production, not that the broken Preview connects there. No production reader or Auth data was inspected.

## Additional isolated integration evidence — 2026-10-03

- Own local full Supabase project `lumiscore-pr8-discovery`, PostgreSQL 17, CLI 2.116.0, Node v24.20.0. Dedicated loopback ports 55431/55432/55434; existing identity-validation stack untouched. Synthetic schema totals: 389 Works (305 main candidates + 84 historical-migration placeholders), 608 Editions, 12 Authors, 20 existing category definitions, 46 Collections. The placeholder Works have no Editions/evidence and cannot enter NL/EN rounds. This minimal base is not a production-schema-parity claim.
- **Three new fixture/target/loopback tests passed**; final **42 focused fixture + SQL/discovery/recommendation tests passed**, zero failures (49.7 seconds). Full 539-test/build evidence above is reused for unchanged application code. Fresh TypeScript and ESLint pass; the existing 98 browser-build files pass the client secret scan (no real server credentials supplied, so not a proof about remotely configured values). Diff whitespace check passes. PR #8's production migration bytes and application implementation are unchanged by this preparation.
- **Real Auth + PostgREST + database pass**, not mocks: two confirmed synthetic users, actual password login and reauthentication mid-round, real refresh tokens, three voluntary rounds of twenty explicit ratings each, 60 distinct newly rated Works, one skip without rating. Existing test-user scores stay unchanged; retries are idempotent; rating-implies-read and user preference/rating/round isolation are enforced. A separate normal score edit changes highest-score order as expected. Anonymous and forged-owner/private-schema requests are rejected.
- Real public RPC filtering returns 100 unique Works across four pages (32/32/32/4) for author 8800001 + fantasy + NL + “Synthetic”; incompatible Cooking gives zero. Browser checks on the local synthetic server exercised selecting author/category/language/query, page two, book 033 and its return link: all parameters and page two survived. Desktop NL/Ink and mobile 390×844 EN/Paper inspected; mobile 32 book links, no horizontal overflow/error overlay/captured console errors. Home loaded 389 books/20 categories; hydrated existing device-only guest preferences produced twenty recommendations, not invented ratings.
- Finally, only the two run-created users were globally signed out/deleted. A separate read-only check confirms **zero Auth users, ratings, reading statuses, preferences, rounds and offers**, with bibliography still 389/608. Credentials remained in memory and were never printed. Stopping this task's stack preserves its volumes; no existing stack, production secret or backup is removed.
- **Still unproven:** all online Preview catalog/filter/rating/SSR-cookie flows; browser-authenticated refresh/sign-out/sign-in, saved-score propagation through profile/recommendations, actual swipe confirmation/cancel, rating-sensitive browser return/scroll and full small/exhausted browser states. Passing local API tests is not online functional sign-off. Draft remains required.

Current blockers: approve/provision the isolated hosted target and branch Preview configuration, then prove the catalog and full authenticated browser filter/rating/return flows. Local PostgreSQL or API evidence is not online browser sign-off. PR #8 remains Draft; no production migration/write, merge, main push or remote configuration change is performed.

## Category provenance — production definitions versus PR #8

All **20** public rows below were read directly from production in a read-only transaction on 2026-10-03, match existing `lib/catalog/categories.json` at the base commit, and were already present before PR #8. That file is unchanged in this PR, and the new migration has no category insert/update/delete. PR #8 introduces **zero categories**, only dynamic presentation/count/linking. Synthetic copies in test support do not alter production taxonomy.

| Existing production category ID | Existing linked Works | Added by PR #8 |
| --- | ---: | --- |
| fiction_fantasy | 124 | no |
| fiction_feelgood | 4 | no |
| fiction_historical | 56 | no |
| fiction_horror | 31 | no |
| fiction_literary_general | 263 | no |
| fiction_mystery_crime | 62 | no |
| fiction_romance | 91 | no |
| fiction_science_fiction | 91 | no |
| fiction_thriller_suspense | 111 | no |
| nonfiction_arts_culture | 3 | no |
| nonfiction_biography_memoir | 54 | no |
| nonfiction_cooking_food | 0 | no |
| nonfiction_economics_business | 17 | no |
| nonfiction_history | 15 | no |
| nonfiction_philosophy_religion | 13 | no |
| nonfiction_psychology_self_development | 37 | no |
| nonfiction_science_nature | 13 | no |
| nonfiction_society_current_affairs | 24 | no |
| nonfiction_travel | 3 | no |
| nonfiction_true_crime | 10 | no |

Counts are observations, not import instructions. A Work may have multiple categories; their sum is not the catalog size. Unclassified Works remain in unrestricted Browse.

## Migration and separate-test execution gate

Repository migration: `supabase/migrations/20261003183631_discovery_taste_rounds.sql`, SHA-256 `6bad8c98bddf86b6e4e6476e092d2cbe6080132234717410c113bf97ae0de089`. Review these exact bytes before later application; no existing migration or catalog schema was rewritten. It runs in BEGIN/COMMIT, has no seed/backfill, and leaves the deployed `catalog_editorial_page` intact.

Before online functional sign-off, provision or identify an explicitly approved **nonproduction** Supabase target (not production `qvplwejffhjvxaypmjut`) and its safe preview public/SSR configuration. This task did not authorize creating a paid cloud project, changing Preview credentials, or copying production service-role credentials.

In that separate target only:

1. Verify project identity, verified TLS where using the database connection, migration history and current reviewed branch SHA. Keep credentials outside Git/output and inspect pending migrations; do not blindly apply all to an existing target.
2. Create the baseline schema from repository migrations in an isolated disposable target, then use the official Supabase CLI migration workflow for this exact migration. No production linking/apply command is authorized by this document.
3. Load synthetic/nonpersonal test bibliography and test accounts in that target only. Verify public RPC discovery, owner-only RLS, explicit-rating/read trigger, three rounds, retry/refresh, conflict preservation, search-chosen Work, exhaustion and opt-in swipe through the real SSR/PostgREST/browser flow.
4. Recheck desktop/mobile, NL/EN, Ink/Paper, author+category+query pagination and rating-sensitive return rank. Record network payload/request counts and actual remote query latency there. Only then move the PR from Draft/partial review to complete functional review. A separate explicit release decision is still required for production.

## Recovery (not executed on any live database)

Before any future application, capture the target schema/grants and protected data read-only and retain the reviewed snapshot. BEGIN/COMMIT makes a migration failure atomic; close/rollback a failed transaction and inspect the exact state rather than repair history ad hoc.

Prefer reverting the application feature or a reviewed forward correction. If new tables contain any real progress, **do not use the empty-schema cleanup below**: securely preserve that progress and existing ratings/read statuses, then review a forward fix. Never delete normal ratings or restore an old production snapshot.

Only for a disposable target or newly applied, still-unused feature, the exact cleanup below fails closed unless both new tables are empty. It does not touch existing rating/status, catalog or collection data and uses no CASCADE. It requires a privileged migration role and an explicitly reviewed target; this document is not execution authorization.

```sql
-- BEGIN REVIEW-ONLY RECOVERY
begin;
do $$ begin
  if exists(select 1 from public.taste_rating_rounds) or exists(select 1 from public.taste_rating_offers) then
    raise exception 'Progress exists: preserve it and review forward recovery';
  end if;
end $$;
drop function public.taste_rating_advance(text,uuid,bigint,integer,text);
drop function taste_private.advance_round(text,uuid,bigint,integer,text);
drop function public.taste_rating_state();
drop table public.taste_rating_offers;
drop table public.taste_rating_rounds;
drop function public.catalog_discovery_page(text,text[],text,text[],text,integer,integer,bigint[],bigint);
drop schema taste_private;
commit;
-- END REVIEW-ONLY RECOVERY
```

This cleanup does not itself reconcile a remote migration-history entry. Any subsequent history/reapplication strategy must be separately reviewed for that disposable target; never mutate production history as an improvisation.
