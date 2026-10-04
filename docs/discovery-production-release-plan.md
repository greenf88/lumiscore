# PR #8 — revised controlled production release proposal

Prepared 2026-10-04 after the separately approved minimal permissions correction. **No production migration, merge or Production deployment is authorized by this preparation.** The previous approval for release SHA `5ae5ad2fea5f9edb2929c8ca8460e95ffeef947c` and its one-migration manifest does **not** cover these changed artifacts. Obtain one new explicit approval for the exact final SHA, plan/manifest hashes and both migrations below.

## 1. Immutable identity and scope

- Repository `greenf88/lumiscore`; [PR #8](https://github.com/greenf88/lumiscore/pull/8).
- Branch `feature/discovery-taste-test-20261003`; isolated worktree `work/lumiscore-discovery-taste-20261003`.
- Runtime implementation remains `9917a7115bfc5937b6d8331da0dc8c0ae8f34dee`; no application/component/dependency/configuration change in the rights fix.
- Reviewed base `origin/main`: `5ce044cb07eb0a5ceb3d8eceb0ed3f7f5e730aae`.
- Production: `qvplwejffhjvxaypmjut`, `https://lumisco.re/`.
- Existing synthetic test project: `hlvujbrmfdlrfxdjwsmb`, Free; do not recreate it or use its users/keys on production.
- Only new schema correction: revoke all function rights from PUBLIC and anon on `public.taste_rating_state()`, explicitly retain authenticated EXECUTE. No global default-privilege, unrelated function, table, RLS, data, Auth or configuration changes.

The final release SHA is in the approval envelope and generated ignored `outputs/discovery-production-plan/release-manifest.json`. Generate that file after the final commit from a clean worktree using `node scripts/prepare-discovery-production.mjs`. It binds HEAD, base, target, this plan's SHA-256, fifteen original migration hashes and **exactly two expected pending files**. Record the manifest SHA-256 in the proposal. At execution require exact equality of local HEAD, remote branch, PR head, approved releaseSha, base, plan and all hashes. Reject every old one-migration manifest. Changed artifacts require renewed review/approval, never a moving ref or silently repaired history.

## 2. Missed privilege check and forward migration strategy

The earlier review checked PUBLIC revocation, table denial and owner isolation but missed Supabase's **separate explicit default anon EXECUTE grant**. PUBLIC revocation does not remove that ACL entry. Production/test role/default-ACL inspection and real effective test permissions proved the mismatch. It was not evidence of anonymous row disclosure: state is INVOKER and anon cannot SELECT either owner table. Do not claim a data leak.

The four exact functions and final client contracts are:

| Function signature | Owner | Mode | PUBLIC EXECUTE | anon EXECUTE | authenticated EXECUTE |
| --- | --- | --- | --- | --- | --- |
| public.catalog_discovery_page(text,text[],text,text[],text,integer,integer,bigint[],bigint) | postgres | INVOKER | no | yes | yes |
| public.taste_rating_state() | postgres | INVOKER | no | no | yes |
| public.taste_rating_advance(text,uuid,bigint,integer,text) | postgres | INVOKER | no | no | yes |
| taste_private.advance_round(text,uuid,bigint,integer,text) | postgres | DEFINER, unexposed | no | no | yes |

Both client roles have no inherited role memberships, no SUPERUSER/BYPASSRLS and do not own the functions. Existing postgres-owner and service_role operational privileges are not browser/authenticated-client grants and are retained; no such key is supplied to Preview browser code. All four search_paths remain empty. Only the state function required correction; the other three already match their contracts.

**Do not modify the already-applied discovery migration.** It remains byte-for-byte unchanged. Apply a new forward-only ACL migration. The initial empty file was created with the official CLI; the test MCP's official apply allocated version `20261004120823`. The uncommitted local file was named to that actual recorded version before final commit. No migration-history entry was edited, deleted, repaired or re-applied. Both local fresh setup and hosted test now use the same fifteen-version chain. Hosted test's fourteen prior versions remain intact.

| Order | Pending production file | Exact SHA-256 |
| --- | --- | --- |
| 1 | supabase/migrations/20261003183631_discovery_taste_rounds.sql | 6bad8c98bddf86b6e4e6476e092d2cbe6080132234717410c113bf97ae0de089 |
| 2 | supabase/migrations/20261004120823_discovery_taste_state_permissions.sql | f92e248e4034a8a0325fcfc30f6b82cafc74cef66db7483d44dd1d40f183a22e |

UTF-8 without BOM, LF only. Production baseline is thirteen versions:

```text
20260903220000 20260908052221 20260910062625 20260911143044
20260913150000 20260913182320 20260915191053 20260916071439
20260917180127 20260919113332 20260920120000 20260930185834
20261002161527
```

The feature migration creates the new filter/order RPC, two owner-readable ENABLE/FORCE-RLS tables, seven indexes, twelve constraints, exact owner SELECT policies and a private authenticated mutation function. It leaves existing catalog_editorial_page, catalog/user data and rating-implies-read trigger intact. No backfill or function invocation occurs during apply. The correction contains only BEGIN, one exact-function REVOKE, one authenticated GRANT and COMMIT.

Each file has its own transaction; **the pair is not claimed to be one atomic transaction**. Between commits, the original state ACL can briefly include anon but its INVOKER table read is denied and new tables must remain empty under the old app. No merge/exposure of new app until both migrations and effective grants are verified. If the second step fails, leave the old app serving, preserve schema/history/evidence and stop. Do not reapply/drop/repair automatically.

## 3. Safeguards, baseline and TLS

Use the existing owner-restricted external directory:
`C:\Users\rickg\Documents\Codex\release-backups\lumiscore-release-safety-20261002`.

Retain all old artifacts and the prior blocked report `PR8-RELEASE-BLOCKED-1791113276320.md`. Immediately before future execution capture a new repeatable-read, read-only schema/effective-ACL/default-ACL/role/history/bibliography snapshot, rollback and preserve its exact hash. Existing snapshots are metadata/evidence, **not a full restorable data backup or tested PITR**; the chosen rollback is non-destructive application rollback.

Last verified production observations: 10,134 Works, 10,293 Editions, 5,650 Authors, 20 categories, 59 Collections, 8,468 editorial records; four selections, 8,468 memberships, 1,022 category links, two aliases and 325 Collection memberships. Ratings/statuses/preferences/Auth/cache counts are observations, not frozen data. Explain independent catalog changes; tolerate evidenced normal user/cache activity, never restore old production data to match an obsolete hash.

Use only the unchanged existing external production connection and official Supabase CA. Approved target-plan hash:
`3b2c98818e477e5ca0a358d2b40716573f770a785996a88420b395f2434a1625`.
The protected safety-common helper checks connection identity, database, current_user and session_user separately in memory. Session Pooler 5432, encrypted TLS, rejectUnauthorized=true, certificate AND hostname verification; CLI sslmode=verify-full. No TLS downgrade, debug/raw errors, key reveal, clipboard or credential-bearing argv. CLI 2.116.0 uses PG* connection values only in a child environment and credential-free `postgresql:///postgres?sslmode=verify-full`; capture/allowlist output and clear temporary references in finally. JavaScript does not promise physical erasure of garbage-collected strings.

Do not reuse old import executors or test setup on production. No importer, seed, role provisioning, Vault update, CLI upgrade, linked fallback, --include-all/--include-seed/--include-roles or history repair. Production PostgreSQL 17.6/test 17.11; these exact migrations use no features implicated in the documented minor-version changes.

## 4. Proposed execution — requires NEW explicit release approval

1. Fetch origin. Confirm clean isolated worktree, exact approved HEAD/remote/PR/base, mergeability, required reviews/CI and rules read-only. Check the current Production deployment and environment target without revealing keys; Preview still points only to test. Recheck migration/manifest/plan hashes and untouched runtime diff.
2. Generate offline staging/manifest from the approved commit. Fifteen files stage the thirteen existing versions plus two pending; no seeds/roles. Require worktreeClean=true. The offline delta guard rejects missing/changed correction, partial history and unexpected files.
3. Run updated read-only `outputs/discovery-review/pr8-production-preflight.mjs <approvedSHA>` from the root workspace. It has **no apply mode**; require thirteen-version history, absent new objects, verified identity/TLS/exposure, fresh protected snapshot and CLI dry-run **exactly the reviewed ordered pair**, seeds=[], roles=[].
4. In the existing captured protected transport, repeat official CLI identity and dry-run over `outputs/discovery-production-plan` with `--db-url postgresql:///postgres?sslmode=verify-full --output-format json --log-level none --agent no`. Do not apply if the dry-run contains anything else, either hash differs, target/identity fails or concurrent DDL/import locks are unexplained. Website traffic remains online.
5. Only after new approval run one official `supabase db push --skip-vault --yes` with that staging workdir and exactly the same verified connection/flags, omitting --dry-run. It applies the two reviewed files in order. No manual SQL/management write on production and no blind retry after interruption.
6. Before merge: both new history versions exactly once, previous thirteen unchanged, local/remote history equal, final CLI dry-run zero pending. Verify exact columns/constraints/indexes valid/ready/live, four signatures/definitions/owners/search_paths, schema grants, owner policies and ENABLE/FORCE RLS. **Check explicit ACL entries AND has_function_privilege**, not SQL-text presence. Require the table/function client contracts above, anon denied, no PUBLIC EXECUTE, authenticated direct DML denied, both new tables empty, private API schemas unexposed. Compare unrelated schema/grants/default ACLs/roles/functions/protected bibliography. Explain normal activity without exporting personal rows. Re-run Advisors. No production test RPC mutation/user/rating/round is allowed.
7. Recheck exact PR head/diff/CI/rules immediately before merge. Use the normal permitted merge-commit workflow, expected-head guard, no force/main push. Record merge commit. Let Git integration build Production from Production variables; **never promote a test Preview build or start a duplicate deployment**.
8. Record actual Production deployment ID/status/domain. Perform the read-only live matrix below and bounded AFTER measurements. No production Auth/test writes. Stop on a proven regression and use only separately approved application rollback.

Potential locks: new empty tables/indexes have no backfill; FKs may briefly conflict with works/auth.users DDL. No lock-duration/SLA guarantee. Inspect active DDL/import and lock waits without query literals. A timeout does not prove rollback; inspect actual schema AND history. Do not invent CLI lock options.

## 5. Verification evidence and live matrix

See [permissions verification](discovery-permissions-verification-20261004.md) for actual database/API tests, exact hashes and results. See [prior online verification](discovery-online-verification-20261004.md) for unchanged runtime's desktop/mobile, NL/EN, Ink/Paper, recommendations/filter/pagination/navigation and sixty real ratings. Its earlier privilege sign-off is superseded by the new explicit-default-ACL regression; functional owner evidence remains valid.

The rights fix must pass fresh local PostgreSQL + actual Auth/PostgREST, not only PGlite/mocks: false effective anon EXECUTE, a genuine denied anonymous state RPC (42501), denied table SELECT, authenticated state access, two-user isolation, three rounds/60 explicit ratings, skip, refresh/relogin, idempotence and preserved scores. Hosted test reuses the same two encrypted synthetic accounts and existing data; checks anonymous RPC/table denial, both authenticated states and isolation, then one explicit new B rating/skip/retry/resume while retaining all prior A/B scores/progress. No third hosted account or fixture reset.

After future release verify read-only:
- Home/overview: twenty distinct recommendations, honest shortages, 10/20/25 controls, no invented evidence.
- Browse/Search/category/author+category+query+language, page 2 and sizes 32/64/128, unclassified book visibility, empty category.
- Highest-score order, valid book return and native Back preserving filter/page/pageSize/scroll; no manufactured production rating.
- Taste login requirement, read-only signed-in state only if an authorized existing-reader session is available; no start/rate/skip to prove it live.
- Existing books, covers, Collections and sitemap; desktop 1440x900/mobile 390x844, NL/EN, Ink/Paper; console/network/overflow/error states.
- Production prototype=swipe remains disabled. Test users/credentials do not migrate.

Real online prior deployment `dpl_A8mtgKqHRECDM7CK1cm2E8JPV6Vx`, implementation `9917a7115bfc5937b6d8331da0dc8c0ae8f34dee`. Subsequent Preview CI is checked against the final fixed SHA. A green build alone is not new browser proof or a Production release.

## 6. Performance and Advisors

Prior bounded production baseline 2026-10-04 10:16 UTC, one discarded warmup plus three sequential samples/route, no auth/cache purge/load test: decoded-body medians Browse 415ms, page2 295ms, Search 266ms, category/language 201ms, detail 205ms, cached Search API 29ms. These are workstation-to-headers/body, **not SQL, compressed transfer, LCP/p95 or promised speedup**. Refresh bounded baseline at actual release if stale; repeat AFTER identically.

The ACL-only correction does not change query bodies/plans. Record actual local build durations and API regressions in verification, not a production speed claim. Existing cold full-catalog recommendation cost remains: 164 requests, ~6.2MB decoded, 2.54s in one prior sample; five-minute guest cache does not equally cover authenticated loading.

Advisor baseline: intentional deny-client RLS INFOs; existing public aggregate/authenticated recommendation DEFINER warnings; leaked-password protection warning; unused-index INFOs. Test retains two new offers-FK INFOs (round/user and work) and five unused historical indexes. These are existing scale/admin-delete limitations, not permission leak proof. No unrelated index/Auth/default-privilege repair. Compare fresh findings, stop on unexpected security/schema changes.

## 7. Recovery — no destructive rollback

- Before apply: stop, old app/database unchanged; preserve artifacts/secrets.
- File 1 or 2 error/interruption: inspect exact committed schema/history in read-only session; preserve journal. No automatic rerun, drop or repair. If only feature migration committed, old app remains live and no merge is permitted; a reviewed resume of only the remaining correction needs exact refreshed state/approval.
- Both applied, app/build failure: keep additive schema/history/any reader progress; old app can continue serving.
- Proven application regression after rollout: only if separately approved, restore the recorded known-good Production application through normal rollback, not database restore. Pre-release reference at prior check was `dpl_J9j8cACGj28GdFse8uV5RkQBcCqa` at main `5ce044c...`; re-read actual current deployment before release.
- **Never reverse this ACL fix by granting anon/PUBLIC EXECUTE.** No data loss/ratings deletion/round deletion/schema downgrade, test project deletion, secret/backup deletion or improvising configuration.
- Disposable empty-schema cleanup in historical tests is not a production recovery authorization. Preserve existing/new ratings, read statuses, Auth, preferences, bibliography, editorial/classifications, selections, Collections and cache activity.

## 8. One new approval proposal

Approve exactly the final SHA and this plan/manifest hashes, for production target qvplwejffhjvxaypmjut: fresh read-only gates/evidence → exactly both reviewed migration files/hashes → full schema/effective-grant/history/data-preservation verification → PR #8 merge only at unchanged approved head and green required checks → normal automatic Production build → read-only live verification/measurements. Also explicitly authorize non-destructive application rollback to the newly recorded pre-release deployment if a release regression is proved.

**Not included:** imports/seeds, category/classification changes, test accounts or production ratings/progress, config/DNS/Auth changes, extra migrations, history repair, TLS downgrade, main/force push, duplicate manual deployment, secret/backup deletion or public swipe release. Previous release approval does not authorize this revised pair. Until new approval, only preparation/test-target writes and featurebranch publication occur.

Remaining limitations: no Production DDL timing or personalized latency/LCP guarantee, cold recommendation cost, offers FK INFOs, synthetic fallback-cover evidence (Google ISBN path not retested), Free test quotas/inactivity and deliberately no synthetic production write-flow test.
