# Fixture recovery and catalog expansion readiness

Scope: test fixtures, regression coverage, test entry points and this assessment.
No application/importer/migration changes, production writes, settings changes,
merge, main push or manual deployment. Existing workspaces/backups/secrets retained.

## Basis and actual failures

Freshly fetched `origin/main`: `d2d11cbe3f68807429a5b9c4171e964be691ce2e`.
New isolated branch: `fix/catalog-fixture-contracts-20261002`.
No ancestor/repository `AGENTS.md` found. Package scripts, Node built-in test setup,
Git attributes/ignore rules and the integration/index/final release reports read.
Node 24.20.0; frozen offline dependency installation, no dependency upgrades.

Four failing tests, **two causes**, reproduced on this main before edits:

| Test file | Failing test names | Missing artifact / error |
| --- | --- | --- |
| `lib/collections/collection-v1-quality.test.ts` | `the frozen V1 audit covers every live collection and refuses unsafe writes`; `complete reviewed series are contiguous and every known gap has one explicit row` | `catalog/collection-v1-quality-audit.json`, `ENOENT`, syscall `open` |
| `scripts/catalog-expansion-trait-option-b.test.ts` | `strict Option B plan contains only the five approved exact-ISBN nonfiction rows`; `all five strict Option B works remain PARTIAL without era evidence` | `catalog/catalog-expansion-trait-enrichment-option-b-write-plan.json`, `ENOENT`, syscall `open` |

Baseline full run: `git ls-files 'lib/*.test.ts' 'scripts/*.test.ts'
'scripts/*.test.mjs'` passed to `node --experimental-strip-types --test`:
**509/513**, exactly those four failures, no skipped/cancelled tests. The current
full run is a superset of both historical runs, not a claim that the historical
330/332 file list was preserved (the release report does not record that list).
The 42/44 command was reconstructed and reproduced:

```text
node --experimental-strip-types --test scripts/catalog-expansion-trait-option-b.test.ts scripts/open-library-matching.test.ts lib/performance/release-contract.test.ts
```

Collection file was 3/5; Option B file 0/2. They are disjoint failures, not four
missing artifacts or duplicate reporting of the same tests.

Git history shows the tests first added by `0fa25cf` and `169e0ec` respectively;
neither missing JSON nor its original generator was ever tracked on a reachable
ref. Locally retained generators (`audit-collection-v1-quality.ts` and
`build-catalog-expansion-trait-option-b-plan.ts`) require live Supabase reads and
large research inputs. These were development/review workflows, not a checkout
fixture-generation step. `catalog/` is not ignored: selective staging omitted the
inputs/generators. No evidence of checkout deleting tracked fixtures. Option B also
depended on repository cwd. There is no tracked GitHub Actions workflow or old
aggregate test script that supplies these artifacts; automatic generation in CI
must not be assumed. The persistent test contracts were accidentally coupled to
temporary local research files.

## Fix and verification

Two small immutable public review projections under `test/fixtures/`; complete
original assertions retained; stronger byte/provenance/row-count checks added.
No fabricated live audit, personal data or current production rows. Original
Option B rows and canonical hash preserved exactly. See the fixture README for
source hashes, field allowlists and historical-vs-current semantics.
URL-relative loading fixes cwd dependence; narrow byte-preserving attributes and
a new checkout regression prevent Windows/Linux fixture drift. New package scripts
make both the fixture contracts and all unit/contract tests runnable in CI.

- `pnpm test:fixture-contracts`: **8/8**, including fresh Git clones under both
  autocrlf modes and seven original tests from an unrelated cwd without credentials.
  Additionally, the committed tree was materialized as a separate fresh detached
  worktree with `core.autocrlf=true`: **8/8** without any dependency installation,
  environment file or legacy audit artifact; clean Git status. No personal path
  is embedded in the scripts or fixtures.
- `pnpm test:unit`: **514/514**, zero failures/skips/cancellations. Includes all
  previously failing files plus catalog/selection, target/TLS/importer, migration
  bytes/index, collections, ratings/Auth, recommendation, covers, language and SEO.
- Reconstructed additional suite above: **44/44**.
- TypeScript `noEmit`: PASS. ESLint `--max-warnings 0`: PASS. Diff check: PASS.
- Existing unchanged client output rescanned: **44 files**, zero secret identifiers
  or configured secret values found; this scan had no production credentials.
  The prior release build scan additionally checked configured **local synthetic**
  server-secret values. New fixtures inspected through explicit public-field
  allowlists; no secret/environment/database baseline included.
  A separate source scan of all nine changed files found zero database URIs with
  credentials, private keys, Supabase/GitHub secret tokens or JWT patterns.
- Production builds are reused, not rerun: final release report for the current
  application tree records Vinext and Vercel-equivalent exit 0, five local server
  HTML checks and deployment-ID/public asset verification. `git diff 83eeadd HEAD`
  over application/lib/scripts/migrations/build config/lockfile is empty before
  this test-only change. No build inputs/runtime code/dependencies changed; new
  package test scripts do not change build commands. This is valid unchanged-build
  evidence, not a claim of a new production build or browser audit.

## Current read-only measurements

Supabase project `qvplwejffhjvxaypmjut`; bounded explicit `REPEATABLE READ READ ONLY`
snapshots with rollback, no individual user rows. 2026-10-02 20:07:25 UTC:

| Measure | Actual |
| --- | ---: |
| Works / distinct Work primary keys | 2,640 / 2,640 |
| Editions | 2,799 |
| Collections | 59 |
| V1 selection members / category links | 974 / 1,022 |
| Works without V1 editorial category | 1,666 |
| Duplicate normalized Open Library Work groups | 0 |
| Duplicate normalized ISBN-13 / cross-Work ISBN groups | 0 / 0 |
| Orphan Editions | 0 |

Second read-only snapshot 20:13:08 UTC: duplicate native identity groups 0;
99 Works and 99 selection members without Editions; 2,541 Works have Editions.
These 99 editionless Works match V1's intentionally Work-only creation; an ISBN
checksum was never sufficient proof to create an Edition or cover.
Unique OL Work, native identity and OL Edition indexes exist. **No unique ISBN-13
index** was found: zero current duplicates is not a concurrency guarantee. Edition
binding must be rechecked and protected transactionally in a new batch runner.

Public-role (`SET LOCAL ROLE anon` within read-only transaction) catalog RPC:
all Browse total 2,640; selection total 974; 128/page produces 21 pages and the
out-of-range request clamps to page 21 with 80 results. `fiction_fantasy` has 124
Works; Dutch edition-language filter has 486. An initial probe using invalid raw
category `fantasy` correctly returned zero; the actual app uses `fiction_fantasy`.
Public production sitemap HTTP 200: 2,640 books + 59 collections + 8 fixed URLs =
2,707 URLs, zero duplicates and zero `/book/null` entries. Network sandbox initially
denied a public GET; that failed attempt was not counted as a measurement.

## Concrete readiness assessment

**Architecture supports incremental expansion; not yet an approved/executable
500-Work batch, and no measured 10,000-Work performance certification.**

- Identity: `catalog-selection-core.mjs` refuses ambiguous matches and existing-ID
  drift, isolates duplicates, preserves native null-OL identities, supports reviewed
  translation/Edition pins and never merges existing Works. Frozen input integrity
  and Rendez-vous ISBN→Edition→Work tests pass. New candidate research must prove
  exact ISBN→normal Edition→parent Work, author/title/form, not infer it from an ISBN
  checksum, matching title, translation or source search snippet.
- V1 runner is intentionally hardcoded: exactly 1,000 `LS1000-*` candidates, frozen
  revision/hash, fixed selection slug and max year 2026. `reviewedInput` and prior
  ledger checks reject replacing/reusing old records. **Do not append 500 rows to
  V1 or weaken these guards.** A separately reviewed versioned batch manifest,
  new stable candidate namespace and batch-local ledger/selection are required.
- General `import-open-library.ts` handles Editions and reviewed native seeds, but
  uses separate REST writes and `saveWithoutDuplicates` may UPDATE existing
  bibliographic/Edition fields. It is not an atomic, preservation-only replacement
  for the safe V1 PostgreSQL runner. Do not run it blindly for expansion. Review
  cross-Work ISBN conflicts and concurrent author/Edition binding explicitly.
- Selection/category schema supports additional selections and multiple categories
  per Work via keys/FKs; private evidence remains inaccessible. The RPC uses EXISTS,
  so category links do not duplicate Work results. Unclassified Works remain visible
  in unfiltered Browse/Search; only category/selection filters exclude them. Existing
  1,666 unclassified Works must not be relabelled or hidden to reach a target count.
- Editorial classifications remain **AI_EDITORIAL**, with source/status provenance,
  not independently verified publisher metadata. The separate 200-Work HIGH-only
  taxonomy pilot is not a release gate for these existing editorial classifications.
- Safe V1 apply uses SERIALIZABLE, reviewed target-bound read-only plan, same-client
  commit/rollback, five-second lock timeout and locks shared catalog tables. Tests
  prove partial rollback, unchanged historical bibliography/user links and zero-write
  reruns. Reuse those principles, not the frozen selection. A new batch must provide
  idempotent persisted progress, verified retries after rollback and a per-batch
  change ledger. Large writes should be bounded to short batches, not a single
  7,360-Work transaction blocking all catalog writers.
- Directed recovery must remove only exact batch-owned membership/evidence/category/
  alias links and newly inserted bibliography whose current content and references
  still match the batch ledger. Never delete an old linked Work or a new Work now
  referenced by ratings/status/collections; never restore an old global snapshot
  over normal user activity. Freeze the exact recovery plan and test it locally
  before writes; an automated generic recovery runner is **not yet proven**.
- Browse/Search are database-paginated (32/64/128), stable title+ID ordering with
  filtering before count/page. Stored covers and scores are batched; 128 scores use
  bounded 100-ID RPC chunks, not 128 single-card queries. Cover resolution must use
  actual verified Editions/source IDs; unknown covers may remain placeholders and
  language filters intentionally exclude editionless Works. Avoid eager external
  cover resolution for every new Work; keep cache TTL/failure behavior unchanged.
- Current RPC materializes candidates/facets, uses substring search and OFFSET/row
  numbering. Indexes are not proof of fast substring search or deep-page latency.
  Measure representative searches, filters/facets, newest/A–Z, 32/128 and last pages
  locally on 5k/10k synthetic data, including query plans/p95, before expansion at
  those scales. Tune only if measured; keyset/full-text/trigram would be a separate
  reviewed change, not part of this PR.
- Sitemap pages the database in ordered 1,000-ID chunks, not a hardcoded 1,000-book
  cap. At 10k it needs ten full pages plus termination read; verify all unique URLs,
  XML size/cache expiry/canonicals after each approved batch. Retain query noindex
  policy; no mass noindex or routing changes. Do not raise a global API row limit.

## Staged expansion and gates

Measured baseline 2,640; counts are **net new unique Works**, not Editions, candidates,
links or selection members. Refresh before execution and recompute if users/other
approved operations change the catalog.

| Stage | Additional net new from previous stage | Expected Works | Total added from measured baseline |
| --- | ---: | ---: | ---: |
| First controlled batch | 500 | 3,140 | 500 |
| Second milestone | 1,860 | 5,000 | 2,360 |
| Final milestone | 5,000 | 10,000 | 7,360 |

First batch: collect/review more than 500 candidates as necessary, quarantine
ambiguous/duplicate/derivative/ISBN conflicts, freeze exactly 500 accepted **insert**
actions separately from links/skips and preserve publicly inspectable provenance.
No invented identities to fill a numerical quota. Define language/Edition quality
and cover expectations upfront; verified Editions count separately from Works.

Before separate production approval: review the additive versioned transactional
runner and exact targeted recovery plan; run it on fresh local synthetic data
including collision/concurrency/failure/rerun/RLS cases; fresh target/TLS identity
probe and read-only production dry-run; confirm 500 net inserts/no unexpected
updates/deletes/identity or security drift. Record user activity and cache changes
as operations, not importer writes. Verify protected bibliographic references and
normal user activity without demanding a frozen global production hash. Then seek
explicit write authorization. This task grants none. Scale later in bounded batches
with real measured service latency/cover/API error budgets and checkpoints.

## Existing warnings, not automatic batch blockers

Advisors reread 20:12 UTC: same two deny-by-default RLS INFOs, two anon and three
authenticated SECURITY DEFINER warnings, leaked-password protection WARN; performance
only one unused ratings index INFO. Missing editorial FK-index finding is absent.
No settings/functions/indexes changed here.

Live function definitions inspected read-only: rating APIs return only aggregates,
batch capped at 100; collaborative API is auth.uid()-scoped, bounded at 100 and
returns Work scores/weights rather than reader identities. Empty search_path and
explicit roles match their designed public/authenticated use. Keep a separate
security review; no demonstrated expansion-specific access leak or failed catalog
operation makes these warnings a blocker by themselves. [Function warning guide](https://supabase.com/docs/guides/database/database-linter?lint=0028_anon_security_definer_function_executable).

Disabled [leaked-password protection](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection)
is an existing Auth security risk, not a proven catalog insert/reading dependency.
Do not enable it in this fixture PR or describe it as harmless/resolved.

The historical `/book/null` 404 still has no established caller. `isCatalogWorkId`
and `mapCatalogBook` reject missing/invalid IDs; invalid requests correctly reach
notFound. Valid Work navigation/return tests and sitemap checks pass. This does not
prove the historical caller is fixed; investigate separately if valid paths emit
it, or monitoring shows material frequency. No routing fix or new telemetry here.

PR must remain open for review. No production importer or importer dry-run invoked.
