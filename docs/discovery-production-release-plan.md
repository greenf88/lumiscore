# PR #8 — controlled production release plan

Prepared 2026-10-04. **Preparation only: no production migration, merge, import, data write or deployment has been performed.** One separate human approval is required for the release below. PR #8 is already open and Ready for review; review readiness is not production authorization.

## 1. Immutable release identity

- Repository: `greenf88/lumiscore`; [PR #8](https://github.com/greenf88/lumiscore/pull/8).
- Branch: `feature/discovery-taste-test-20261003`.
- Reviewed/tested application, migration and fixture implementation: `9917a7115bfc5937b6d8331da0dc8c0ae8f34dee`.
- Reviewed production/base `origin/main`: `5ce044cb07eb0a5ceb3d8eceb0ed3f7f5e730aae`.
- Production target: `qvplwejffhjvxaypmjut`; public origin `https://lumisco.re/`.
- Isolated test target: `hlvujbrmfdlrfxdjwsmb`. Never use its credentials, seed or Auth accounts on production.

The **exact final release SHA** is bound in the PR approval envelope and the generated, ignored `outputs/discovery-production-plan/release-manifest.json` (`releaseSha`). This avoids the impossible requirement to put a commit's own hash in a file included in that same commit. That manifest also binds this plan's bytehash, base, all migration bytehashes and the one expected pending migration. Generate it **after committing**, from a clean worktree, using `node scripts/prepare-discovery-production.mjs`; record its SHA-256 in the approval envelope. At execution, require exact equality of local HEAD, remote branch, PR head and approved manifest releaseSha; verify the plan hash again. No placeholders or moving branch references may substitute for the approved 40-character SHA. A changed base, head, plan, migration or target requires a new review of the affected delta before writes.

This preparation adds only documentation, offline/public-GET measurement tools and a narrowly scoped Git line-ending rule to keep this plan's hash reproducible across Windows/Linux checkouts; it changes no application, migration, fixture, dependency or deployment configuration bytes relative to the reviewed implementation. The prior real online flow evidence remains applicable, not silently re-labelled as a new production test.

## 2. Actual production preflight and exact delta

Fresh read-only preflight at 2026-10-04 10:20 UTC used one repeatable-read, read-only PostgreSQL snapshot, explicit rollback, separately checked connection/session identities, official CA and verified encrypted Session Pooler port 5432. Production PostgreSQL is 17.6; test is 17.11. The migration uses none of the ltree, legacy pgcrypto cipher, btree_gist NaN or custom-operator behaviors in the [documented minor-version breaking changes](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes). No database upgrade is proposed.

Production contains **exactly these thirteen migration versions**, in order:

```text
20260903220000 20260908052221 20260910062625 20260911143044
20260913150000 20260913182320 20260915191053 20260916071439
20260917180127 20260919113332 20260920120000 20260930185834
20261002161527
```

Only one migration is absent:

| Order | File | SHA-256 | Actual status |
| --- | --- | --- | --- |
| 1 | `supabase/migrations/20261003183631_discovery_taste_rounds.sql` | `6bad8c98bddf86b6e4e6476e092d2cbe6080132234717410c113bf97ae0de089` | Pending; all new objects absent |

Original bytes are UTF-8 without BOM, LF only. Official Supabase CLI **2.116.0** produced a successful, captured dry-run listing precisely this file, zero seeds and zero roles. The local fourteen-file chain is staged to match the existing remote history, **not** to apply fourteen migrations. Do not use `--include-all`, `--include-seed`, `--include-roles`, linked fallback, history repair or a test setup script. PR #7/+5,134 and the editorial-records index migration are complete and are not rerun.

Existing production totals: **10,134 Works / 10,293 Editions / 5,650 Authors / 20 categories / 59 Collections / 8,468 editorial records**. Protected bibliography/selection observations: four selections, 8,468 memberships, 1,022 Work/category links, two aliases, 325 Collection memberships. Operational counts at this snapshot: 46 ratings, 59 read-status records, two reading-preference rows, five Auth users, 4,509 cover-cache rows. Operational/cache/user activity may legitimately change; those counts are observations, not a demand to freeze traffic or restore an old snapshot.

### Exact schema and privilege effect

- Add `public.catalog_discovery_page(text,text[],text,text[],text,integer,integer,bigint[],bigint)`, stable SECURITY INVOKER, empty search_path. Reuse the existing public rating aggregate; no individual rating data returned. Revoke PUBLIC execute; grant anon/authenticated execute. **Existing `catalog_editorial_page` remains byte-for-byte unchanged.**
- Add `public.taste_rating_rounds`: id, user_id, round_number, language, completed_at, created_at. Add `public.taste_rating_offers`: round_id, user_id, work_id, decision, score, offered_at, decided_at. Twelve named/implicit constraints in total: two PKs, three FKs, two unique constraints and five checks. Seven backing/explicit indexes: four on rounds (PK, two unique constraints, one-open partial unique) and three on offers (PK, round/decision, one-current partial unique).
- Both tables ENABLE and FORCE RLS; revoke PUBLIC/anon/authenticated table privileges then grant authenticated SELECT only. Two owner-only SELECT policies use auth.uid(). No client table INSERT/UPDATE/DELETE permission.
- Add INVOKER `public.taste_rating_state()` and INVOKER `public.taste_rating_advance(text,uuid,bigint,integer,text)`, authenticated execute only, no PUBLIC/anon execute.
- Add unexposed `taste_private` schema and DEFINER `taste_private.advance_round(text,uuid,bigint,integer,text)`, empty search_path, fully qualified references. Only authenticated usage/execute; no public/anon access. Ownership comes from verified auth.uid(), not an input user ID; advisory and row locks serialize actions per reader. Definer ownership must match the approved migration executor, never an anonymous/client role.
- Existing PostgREST exposure includes public and excludes both taste_private and catalog_private; verified through a read-only management API call. Keep that configuration unchanged.
- **Application of the migration inserts no catalog/user rows, performs no backfill, calls no advance function and changes no existing table/policy/trigger/function.** Function-body DML is executed only later on an authenticated explicit user action. Normal rating-implies-read trigger behavior remains intact. A new round does not overwrite an existing rating; competing normal edits cause a visible recoverable conflict.

The migration explicitly uses BEGIN/COMMIT, so its DDL is atomic. Do **not** assume the CLI's history write shares that explicit transaction: inspect both schema and history after interruption. Current deployed code uses the old RPC and tables, and is compatible with the additive schema while deployment is pending. New app code requires the new RPC for author/highest filtering and stored taste rounds; migrate and verify before merging.

### Locks and impact

Tables and indexes are new and empty; there is no catalog scan/backfill for CREATE INDEX. Foreign-key creation can briefly lock referenced works/auth.users relations and conflict with concurrent DDL. The expected DDL work is small, but **no production lock duration or completion time was measured or guaranteed**. Normal user traffic remains online. Before apply, read active DDL/import sessions and lock waits without exposing query literals; stop on an unexplained conflicting release. Watch the migration's own session during execution. If it waits unexpectedly, stop advancing the release and inspect transaction/history rather than start another migration. A child-process timeout is not proof of server rollback. Do not invent an unverified CLI lock-timeout option or disable TLS to proceed. [PostgreSQL lock reference](https://www.postgresql.org/docs/17/explicit-locking.html).

## 3. Real safeguard artifacts and credential handling

Existing protected directory outside Git:
`C:\Users\rickg\Documents\Codex\release-backups\lumiscore-release-safety-20261002`.

| Artifact | Actual purpose | SHA-256 |
| --- | --- | --- |
| `PR8-SCHEMA-BEFORE-1791109206921.json` (186,643 bytes) | Read-only metadata, existing function definitions, protected bibliography digests and operational aggregate counts | `6e3765c40d383842b0440e2af1521f31e646a39a5c2e4e18188f4d27d5db3016` |
| `PR8-PREFLIGHT-1791109218500.json` (5,496 bytes) | Identity/TLS booleans, exact history, snapshot hashes, CLI one-migration dry-run | `39b2ee27b66c303489fd2e4f37aed9c3509738c012ef08dd4fbc3a38e2629515` |

These are genuine safeguarded **schema/evidence snapshots, not a restorable full-data dump or proven PITR backup**. They export no personal row data. That is sufficient for the chosen additive, no-data-write migration and non-destructive application rollback; this approval does not cover destructive schema/data repair. Preserve all older backups as well. Immediately before future apply, create a fresh snapshot using the same read-only helper and preserve its exact hash/ACL and before/after execution journal. Compare immutable metadata and bibliography digests; explain independent catalog edits instead of silently accepting drift. For ratings, statuses, preferences, Auth and caches, use aggregate observations and actor/process evidence: normal activity is not a migration failure. Never print personal rows to explain it.

Use only existing external production secret and official CA, unchanged. The approved target-plan bytehash is `3b2c98818e477e5ca0a358d2b40716573f770a785996a88420b395f2434a1625`; compare connection identity, database, current_user and session_user separately in memory. The existing safety-common helper performs this; never print its returned config or raw failures. Windows owner-only storage was checked. No clipboard, plaintext copy, shell transcript, credential-bearing process arguments or raw CLI log export.

The proven CLI transport supplies PGHOST/PGPORT/PGUSER/PGPASSWORD/PGDATABASE/PGSSLMODE/PGSSLROOTCERT only in a child environment and passes the **credential-free** argument `postgresql:///postgres?sslmode=verify-full`. Official CA, rejectUnauthorized=true in the Node probe, and CLI verify-full provide certificate and hostname verification; no unsafe TLS flags/fallback. Suppress telemetry/debug logging; capture stdout/stderr in memory and emit allowlisted booleans/versions/counts/hashes only. Clear transient references and child environment entries in finally. JavaScript cannot guarantee physical erasure of every garbage-collected string; short-lived bounded processes and no persistence limit exposure. Retain the secret files and DPAPI-encrypted synthetic test credentials after this preparation.

## 4. Executable order after one separate approval

Every gate fails closed. No writes are authorized by this document itself.

1. Fetch origin; verify clean isolated worktree, approved exact HEAD/remote/PR SHA, unchanged base, open non-Draft PR, mergeability and all applicable CI/review requirements. Check required branch/ruleset controls read-only; do not bypass a rule because the repository has few checks. Verify final manifest/plan/migration hashes. Reuse valid runtime evidence only if runtime bytes still match the reviewed implementation. Stop on any new runtime diff or unexplained base drift.
2. Regenerate offline staging using `node scripts/prepare-discovery-production.mjs`, from the approved commit. Require `worktreeClean=true`, manifest hash equal to approval and exactly one expectedPending. Staging is ignored, contains only original migrations and a minimal config with seed disabled; no seed, role or fixture file.
3. Run the existing read-only helper `outputs/discovery-review/pr8-production-preflight.mjs` from the root workspace with the approved SHA as its sole argument. It pins project/target/CLI/migration/history, checks absent new objects and exposure, captures the schema snapshot and official CLI dry-run. Its interface has **no apply mode**. Recheck production variables read-only in the authorized Vercel dashboard: Production URL equals production ref; branch Preview URL equals test ref; applicable public key/URL work together through public API reads. Never reveal keys. Inspect Production target/deployment identity before applying.
4. In a protected short-lived executor using the already reviewed `lumiscore-safety-common-20261002.mjs` approvedConnection/environment/run transport, reproduce the successful official CLI identity query and dry-run against the offline staging workdir. Use CLI 2.116.0, `--db-url postgresql:///postgres?sslmode=verify-full --output-format json --log-level none --agent no`. Require dryRun=true and **migrations exactly `[20261003183631_discovery_taste_rounds.sql]`, seeds=[] and roles=[]**. Discard raw output. Do not run the historical Catalog Selection importer or migration executors with their old bound targets/files. This is a migration-only release, no importer lock or journal is reused as an import instruction.
5. Only with the new human release approval, execute **one** official `supabase db push --skip-vault --yes` using precisely the same connection/flags/staged files, omitting only `--dry-run`. No `--include-*`, no seed/role/vault operations, no management/dashboard SQL. Capture the result and always close/clear the protected executor. On timeout/error, stop and inspect; never blind retry. The exact original file is the SQL approval boundary. [Official CLI workflow](https://supabase.com/docs/reference/cli/supabase-db-push).
6. Before merge, take a fresh consistent read-only snapshot. Require history version 20261003183631 exactly once, previous thirteen unchanged, local/remote history equal and official concluding dry-run zero pending. Match table columns/defaults, all twelve constraints, seven indexes with valid/ready/live status, four function signatures/definitions/security/search_path/owners, schema privileges and both exact owner policies. Both new tables must still be empty (old app does not call them). PUBLIC/anon have no owner-state or mutator rights; authenticated direct DML is denied. No new public DEFINER exposure, private API schema exposure or unexpected grants. Compare existing schema/functions/policies/grants/bibliographic digests against the before snapshot. Explain normal activity; do not restore prior ratings/cache/Auth. Read Security and Performance Advisors and classify only genuinely new findings. Do not perform a mutating owner/RLS test on production: real two-user denial evidence is already available on test.
7. Recheck PR head/diff/base/CI and review requirements immediately before merge. Merge only this reviewed PR via the repository's normal permitted strategy, with expected head SHA. Do not push directly to main or force-push. Record actual merge commit. The normal Git-integrated **Production build** must load Production variables; do not promote the test Preview build, copy Preview credentials or start a duplicate manual deployment. Record the actual deployment ID/build status and production domain assignment before proceeding.
8. Run the live matrix and AFTER bounded measurements below. Verify browser/public API traffic resolves to production, never test; no private schema leaked. On a regression, stop release progression, keep journal/secrets/backups, and use only the app rollback described below after confirming authority. No unrelated SQL/index/config repair or importer.

A human/agent can use the literal official CLI argv above through the proven captured transport; no new credential source or changed importer is needed. This preparation deliberately **does not run an apply executor or claim that the production apply has been rehearsed**. CLI identity/dry-run and the exact migration's actual test-project apply are the available execution evidence.

## 5. Functional review and live verification matrix

Real online browser **and independently read-only database** evidence is committed in [online verification](discovery-online-verification-20261004.md). Test deployment `dpl_A8mtgKqHRECDM7CK1cm2E8JPV6Vx`, immutable [Preview](https://lumiscore-5yj9dbfvn-rgkgroeneveld-9102.vercel.app/), deployed SHA 9917a7115bfc5937b6d8331da0dc8c0ae8f34dee. It proves function on synthetic data, not production latency.

| Area | Reviewed/tested behavior | Read-only live check after release |
| --- | --- | --- |
| Recommendations | 20 distinct Works; 10/20/25 controls; genuine 5/0 shortages; existing evidence/match explanations and read/rated exclusions | Home + overview counts, unique Work links, honest shortages; signed-in GET only when an authorized existing reader session is available |
| Catalog/categories | 20 existing production categories, zero added; unrestricted unclassified Works; count/filter before DB pagination; primary author model, EXISTS prevents Edition/category multiplication | Browse/Search, category links and zero state; author+category+query+language and page 2, 32/64/128; sample existing unclassified book |
| Ordering/navigation | Highest rating order changes after an explicit test rating while preserving query/filters/page/pageSize; valid direct-detail return; unsafe/external destinations and /book/null rejected | Existing highest results, book return and browser Back retain state; no production test rating to manufacture a change |
| Stored rounds | Three rounds, 60 unique explicit scores; skip no rating; refresh/login resume; retries preserve ratings; per-user locks and owner RLS | Taste page/login requirement and GET state/error handling; verify new schema/permissions and owner-scope aggregates. Do not create/start/rate/skip rounds as a synthetic production test |
| Existing flows | Ordinary test-book rating/read-status trigger, existing baseline ratings and two-user isolation verified | Public existing book/Collections links, covers and Search; existing user data preserved in read-only checks |
| Display | Desktop 1440x900/mobile 390x844, NL/EN, Ink/Paper, all eight combinations; representative real interactions, no overflow/console errors | Repeat public Browse/Search/detail/recommendation/taste shell in eight combinations; record console errors, overflow, failed requests and visible unavailable/error states |
| Swipe | Experimental gesture/keyboard/buttons/confirmation tested in Preview | Production `?prototype=swipe` stays disabled by environment gate; never market it as shipped |

Authenticated production write-flow proof is deliberately **not** manufactured with test accounts or ratings. It is covered by the exact-implementation isolated online tests and schema/runtime target verification; production voluntary real-reader activity can be observed only without exporting personal data. If a needed live signed-in GET session is unavailable, report that limit rather than invent a pass or copy test credentials.

## 6. Small reproducible performance baseline

Actual production public GETs measured at **2026-10-04 10:16:41 UTC**, Node 24.20.0. One discarded warmup plus three sequential retained samples per route (24 total GETs), fixed English locale and measurement user-agent, no auth, no cache purge/throttle/load test. Times are wall-clock to response headers and decoded body completion, **not** isolated SQL, compressed transfer size, visible paint, LCP or p95.

| Route | Headers ms (3 samples) | Body ms (3 samples) | Median body ms | Decoded bytes | CDN |
| --- | --- | --- | --- | --- | --- |
| `/browse?pageSize=32` | 753/402/243 | 758/415/254 | 415 | 82,704 | MISS, age 0 |
| `/browse?pageSize=32&page=2` | 274/291/317 | 281/295/323 | 295 | 82,004 | MISS, age 0 |
| `/search?q=1984&pageSize=32` | 243/263/304 | 249/266/306 | 266 | 31,161 | MISS, age 0 |
| `/browse?category=fiction_fantasy&language=en&pageSize=32` | 306/199/168 | 309/201/171 | 201 | 36,121 | MISS, age 0 |
| `/book/93` | 203/205/199 | 205/207/201 | 205 | 23,833 | MISS, age 0 |
| `/api/catalog/search?q=1984` | 28/46/23 | 29/47/24 | 29 | 2,317 | HIT, age 0 |

Independent real desktop browser inspection loaded Browse (32 cards/10,134 total), Search (four 1984 matches), English Fantasy (six cards) and book 93, with no overflow/console errors observed. Navigation-to-DOM-snapshot observations were respectively 2,096 / 1,517 / 1,248 / 1,118 ms; **they include browser-tool roundtrip overhead, use a Dutch UI, and are not paint/LCP or directly comparable to the English HTTP samples**. Browser resource/LCP timing was unavailable through the approved inspection surface; Speed Insights/Web Analytics are not enabled. Do not enable a paid/new analytics resource in this release or claim an improvement without a real comparable measurement.

After release run `node scripts/measure-discovery-http.mjs AFTER` (40 bounded public GETs). It repeats the six routes and adds author 80 + Fantasy + EN, highest sort, guest recommendations and guest taste GET. These additional routes have no before baseline and guest endpoints do **not** measure authenticated ranking or advancing a round. For any authorized signed-in read-only checks, record session/cache conditions separately and never print cookies. Investigate errors/regressions, compare like-for-like rather than enforce a promised speedup. Keep the existing cold recommendation loader caveat: a prior production-catalog observation used 164 server requests / 6,216,593 decoded bytes / 2,540ms before ranking/hydration; server-side full-catalog recommendation work remains a scalability follow-up, not bounded total server cost. Page payload/render count is bounded, server work is not constant.

## 7. Advisors — explicit risk assessment

Fresh production baseline: two INFO RLS-without-policy intentional deny-client objects, two anon and three authenticated existing aggregate/recommendation DEFINER warnings, existing leaked-password-protection warning, one unused ratings-positive-user/work index INFO. No missing-editorial-index finding. Do not recreate/remove that completed index or change existing Auth/security settings.

Test-project delta attributable to PR #8: **two unindexed-foreign-key INFOs** on offers (round_id,user_id) and work_id. [Linter guidance](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys). The round/decision index already has round_id as a prefix and bounds per-round lookup, although it does not satisfy full composite linter coverage. The user/work PK backs ownership and exclusions. Absence of a work_id-only index can cause a larger offers scan on an administrative Work delete; it does not make ordinary offer inserts unsafe. Production bibliography deletion is not part of this release, and new tables initially empty. This is a documented future-scale/administrative-delete risk, **not an demonstrated release blocker or permission leak**. Skips can increase a round beyond twenty offers, so do not claim a permanent twenty-row bound. Reassess before bulk Work deletion or material offers growth; any index fix is separately reviewed, not improvised during deployment.

Five unused historical indexes on the small test fixture are INFOs, not evidence to remove production indexes. [Unused-index guidance](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index). No new Security Advisor finding is attributed to PR #8's private function; actual owner/private-schema denial tests passed. Re-run Advisors after migration and distinguish expected two INFOs from unexpected security/grant/schema changes. Unexpected owner access, public mutator exposure, failing identity/TLS/hash/history checks or a functional regression are genuine blockers.

## 8. Recovery that preserves user activity

- **Before apply fails:** stop; old app/database remain live. No migration/import/merge. Resolve only the concrete gate; do not relax TLS or edit history.
- **DDL fails before COMMIT:** verify rollback and old thirteen-version history in a new read-only session; never infer rollback solely from an exit code. No merge until the exact before state is proved.
- **Interrupted/ambiguous apply:** inspect exact schema and history once, preserve captured allowlisted journal and snapshot, stop. If DDL committed but history did not, or unexpected objects exist, do not rerun/drop/repair automatically. A separately reviewed exact reconciliation is required.
- **Migration succeeds, deployment fails:** leave the additive schema in place and the old app serving. Do not delete round/offer tables just because they were empty at migration time; real activity may now exist. No history repair or full-data restore.
- **App regression after deployment:** stop new release actions; restore the previously recorded known-good Production application deployment/base code through the normal approved rollback route, **without changing database tables/history or restoring any data snapshot**. Record the actual pre-merge Production deployment ID in the release journal before merging; this preparation does not invent that ID or create a rollback deployment. If existing rollback authority is absent, ask for that one operational action rather than mutate configuration. New ratings, read statuses and round progress remain stored, even if the old app cannot display new rounds.
- Destructive empty-schema cleanup used in disposable test fixtures is **not** a production rollback authorization. Preserve Auth, catalog, provenance, Collections, selections, ordinary ratings, preferences, caches, secrets, backups and test project. No whole-database restore, downgrade, reseed, test record, project deletion or unrelated security fix.

## 9. Validation and single approval proposal

Current preparation: full suite **547 passed / zero failed**, including public-GET measurement safety tests; the additional offline migration-delta test and both measurement tests passed in a separate three-test run. TypeScript and ESLint pass after these tools were added. Local Vinext build **22.484s**, local Vercel-target build **64.271s**, neither with a large-chunk warning; both used isolated test public configuration, not a Production deployment. Ninety-eight client output files scanned without secret leakage, including a noncredential server canary. Valid previously recorded five SEO + two discovery server-HTML checks and the real online matrix are reused for unchanged runtime. Available GitHub CI currently covers Vercel Preview and Preview Comments; local full tests must not be described as a separate required remote CI workflow. Read-only branch-rule inventory returned no effective rules, the branch itself reports protected=false and the legacy protection endpoint returned 404. Recheck these before future merge rather than bypass any subsequently added rule. All three merge strategies are enabled; main's latest release is an actual merge commit, so use the established merge-commit workflow if still permitted. Bind final secret/diff checks, remote CI/deployment evidence and exact head in the approval envelope.

**One proposed approval:** release exactly the final commit bound by the manifest/PR envelope to production project qvplwejffhjvxaypmjut: fresh read-only gates and safeguard snapshot; apply only migration 20261003183631 with the bytehash above; verify schema/RLS/history/Advisors and preserved data; merge PR #8 only at the unchanged approved head and green applicable controls; allow the normal Git-integrated Production build and perform read-only live verification/measurements. Expected effects are the new versioned catalog filter/order RPC, twenty-recommendation overview/navigation/category fixes and owner-isolated explicit-rating rounds. There is **no catalog import, category/classification write, seed, Auth account creation, production test rating, configuration change, manual duplicate deployment or public swipe release**. Approval should also explicitly authorize non-destructive application rollback to the recorded pre-release deployment if a release regression is proven; otherwise stop and request that operational action.

Remaining limits: no production DDL timing guarantee, personalized production latency/LCP unmeasured, recommendation full-catalog server cost, two offer-FK INFOs, synthetic fallback covers only (Google/live ISBN enrichment not retested), Free test inactivity/quotas and no production write-flow test. None is presented as already solved. Current code review and isolated online evidence identify **no unresolved release blocker**. All actual release actions remain unperformed pending the single approval.
