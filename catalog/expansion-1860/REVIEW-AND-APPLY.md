# +1860 catalog batch — import-ready preparation, no production write approval

## Review basis and scope

Isolated branch `feature/catalog-expansion-1860-20261003` starts from freshly fetched
`origin/main` `22aae6dc720e5c79cc50aea9a6661166faf8cbd7` (PR #5's completed +500
release). Main was fetched again after preparation and is unchanged. No AGENTS.md
was found in the checkout or ancestors. Existing dirty workspaces, backups and
secret files are preserved. Do not reopen the completed index, fixture or +500 work.

This PR prepares input and extends the existing batch contract only for exactly
1860 records, using a separate versioned schema. The historical 500 manifest,
records, plan contracts and scale evidence are byte-unchanged. There are no
application, routing, dependency, schema, grant, policy or configuration changes.
Supabase/TLS and short-transaction guidance informed the reviewed execution path.

**No production import, migration, main merge or production deployment is authorized
or performed.** Opening/reviewing this PR is not import approval. Keep it open.

## Frozen artifacts and evidence

Only `manifest-v1.json` and its `candidates-v1.json` are the proposed batch.

- Manifest byte SHA-256: `5444825ab3eb1454f5c5d9ac1772b638b323880e9d934278cf90e59b078af9e7`.
- Records byte SHA-256: `8f59ebdee2bfe18849168163a21256ae17f800e139c135230286733e39e7c706`.
- Batch content hash: `8bd7b048dfe5c913ccdeea8088fa6342633f93690c0f8524b846b71cfe137382`.
- Production plan content hash: `dda5eeed75662ba687c3bd7473b3817fba615acc673ecdc8804efb23fcffa3ac`.
- Protected external dry-run artifact: `EXPANSION1860-DRY-RUN-1791035549662.json`;
  byte SHA-256: `c2d18891d18d389e42c3a0adb6b0cc02f73a9c10c76fa3a77f7f393aaa1a0022`.
  It remains in the existing owner-restricted release-artifact directory outside
  Git. Do not publish target files, connection identities, credentials or backups.

Selection priorities were fixed in `SELECTION-POLICY.md` before responses were
selected. Named NL/Flemish backlog gaps precede NL-language discovery, broad
international fiction/non-fiction and bounded specialist lanes. `want_to_read`
is a popularity proxy, not independently measured search volume. A Dutch Edition
does not prove original language or author nationality.

Exactly 24 sequential batch Search requests, >=1100ms start spacing, no individual
book/author harvesting, HTML scraping, paid source or new account. The final
general-fiction page was a policy-defined contingency after conflict-free reserves
proved insufficient. Existing responses were reused, not re-requested.
Metadata verification uses the two official 2026-09-30 monthly dumps. Their complete
compressed bytes and advertised SHA-1 were verified, with locally computed SHA-256:

- Edition dump, 12,617,475,043 bytes:
  `0c30ebacc2fa1453fd644c5823a64b6b294c97d650b603eea46f6cbb26a010e7`.
- Work dump, 4,073,320,823 bytes:
  `1e642ad9742e80f1b60f9125eb6a8fa17bafe42690a9236e0df86f86f28eaf1d`.

[Open Library source policy](https://openlibrary.org/developers/api),
[Search/Edition semantics](https://openlibrary.org/dev/docs/api/search),
[official dumps](https://openlibrary.org/developers/dumps).
The 16.7GB raw files and discovery caches remain ignored locally, not in this PR.
Input retains only the minimal selected public facts, revisions, source/query URLs,
retrieval times and exact record hashes. The verifier binds ISBN, Edition title/key,
single parent, author, language, publisher and print format/pages to those facts.

All 1860 selected Work IDs, Edition IDs and checksum-valid ISBN-13s are distinct:
1424 direct Edition-dump proofs, 414 Edition-plus-Work-dump author proofs and 22
previously reviewed cached book-API proofs. Missing Edition authors may be inherited
only from the exact single-parent Work, matching canonical title and one author key,
with both hashed minimal records. Explicit contradictory authors remain excluded.
No ISBN is invented or inferred from an unrelated Search Edition.

Compare available ISBNs, canonical and chosen translated titles, source IDs and
stored aliases against production. Internal overlaps/ambiguous authors are rejected.
41 final production author conflicts were replaced by independently proved reserves;
no author identity was merged or corrected. `research-summary.json` also preserves
source failures and the explicit quarantine: the already-present `De avonden` under
Gerard Kornelis van het Reve, split/misdated records, Goosebumps/Selection/crossover/
Auggie and Stephen King composite volumes. Original independent single-volume
story books are not new editions of an existing novel; composite editions of
separate source Works cannot be used to inflate the count.

Historical backlog comparison: 1305 distinct prior Work IDs; 4 selected source
identities overlap that backlog. Its old nationality/classification labels are not
current proof. 52 selected records came from the named-author gap lane. Unproved
native identities remain outside the batch. `reserve-v1.json` contains 59 unused
source-proved alternatives, **not** approved actions; selecting one later requires
new frozen input, hashes, conflict review and an approved plan.

## Coverage, without invented classifications

Edition language: Dutch 484, English 1376. Original language and Dutch/Flemish
origin are UNKNOWN for all 1860. Source earliest-publication-year periods:
before 1900: 17; 1900–1949: 57; 1950–1979: 144; 1980–1999: 414; 2000–2019: 1106;
2020–2026: 122. These are source metadata, not independently certified first editions.

Discovery lanes (not assigned genres): general fiction 419; NL fiction 367;
named-author gaps 52; reviewed reserves 22; biography 232; society 160;
psychology 139; history 100; science 91; economics 91; NL history 65;
dystopia 108; thriller 13; fantasy 1. No net-new science-fiction candidate survived
the current strict chain/existing-catalog checks. This is an explicit coverage
shortfall, not a claim of complete genre coverage. Specialist lanes do not dominate.

Editorial classification coverage: **0/1860; 1860 unknown**. Categories and
Collection memberships are empty. Existing unfiltered Browse/Search use the same
persisted RPC and include uncategorized books; language filters use Editions. No
new UI/runtime change is needed. Three historical series hints (The Naturals and
Green Bone Saga) are in `series-follow-up.json`, pending separate verification;
no Collection links are proposed or written. The importer continues to create
private ownership/provenance records, not genre claims.

Cover metadata is available for 1767/1860 (95%); 93 unknown. This is dump metadata,
not HTTP availability, image-quality or cache-fill proof. The existing resolver and
placeholder path remain unchanged. Do not bulk-download covers for this preparation.

## Actual read-only production plan

Verified 2026-10-03 with the existing official CA, certificate and hostname checks,
`rejectUnauthorized=true`, exact project `qvplwejffhjvxaypmjut`, Session Pooler/5432,
connection identity and independent current/session roles, database OID and system
identifier. No TLS bypass or secret/configuration change. Credentials exist only
temporarily in the protected launcher process, never arguments, logs or Git.

The final plan and bibliography/selection baseline come from one REPEATABLE READ
READ ONLY transaction, always rolled back. An additional SQL allowlist refuses all
DML/DDL/non-read commands. Concurrent catalog-writer lock count was zero. Ordinary
covercache and user activity are not stopped or treated as hash failures.

| Proposed insert | Count |
| --- | ---: |
| Works | 1860 |
| Editions, one per new Work | 1860 |
| Authors | 1065 |
| New batch selection | 1 |
| New batch memberships | 1860 |
| New private ownership/provenance records | 1860 |
| Total inserted rows | 8506 |

276 distinct existing Authors are reused in 659 Work references, without updates.
Selection identity: `lumiscore-plus1860-20261003-v1`; labels exactly
`Catalogusuitbreiding +1860` / `Catalog expansion +1860`.

Baseline: Works 3140, Editions 3299, Authors 1532. Expected: Works **5000**,
Editions **5159**, Authors **2597**. Baseline did not change independently. Existing
V1 members 974, +500 members 500 and private records 1474 remain untouched. The
974 original editorial records are a subset of those 1474, not replaced by the
new batch ledger. Current production writes **0**, conflicts **0**, skips **0**;
UPDATE/DELETE/DDL/category/Collection intent **0**. No importer apply was started.

## Verification and bounded scale evidence

The new tests cover exact version/size/prefix guards, no weakening of the historical
500 contract, synthetic-production refusal, selection collisions/label drift,
hashed Edition and inherited-Work proof tampering, actual frozen 1860 input,
actual author reuse counts, a read-only SELECT trace, exact counts/Edition relations,
fail-after-1500 atomic rollback/retry, zero-write repeat, unchanged old bibliography,
selection/Collection/user sentinels and targeted recovery retaining a later user FK.
They require neither credentials nor source/production network access.

Local actual-source test: 818ms for the successful locked apply transaction;
22.616 seconds for its entire apply/rollback/repeat/recovery exercise in PGlite,
not production latency. Separate synthetic 1860 exercise: 24.011 seconds.
Timing includes the deliberately local row-wise recovery checks;
the import itself still uses six set-based parameter-bound INSERT statements.
Full suite: 524/524 PASS, no skips/cancellations/failures (94.652s with concurrent
local database tests). The actual-input case was rerun after adding apply-only timing
and remains 2/2 PASS. TypeScript, ESLint zero warnings, Vinext and local Vite/Vercel-
preset production builds, client secret scan and diff check PASS. Existing Vinext
route-classification, plugin timing and dynamic-import warnings remain informational;
no dependency/configuration workaround or deployment. The client scan inspected
46 files with zero secret identifiers/values; no production credentials were
provided to tests/builds. Publication scan: 15 changed files and 46 client files,
zero credential-value or credential-pattern findings. The branch/commit/PR and
final status are in the completion report.

Reuse unchanged `../expansion-500/scale-results.json`: actual deployed-shape RPC
and ordered sitemap reads at 3140/5000/10000 synthetic Works. At 5000, local warm
p95 Browse-128 36.72ms, deep-last-page 37.19ms, title Search 45.36ms, author Search
60.07ms, Edition Search 49.01ms, sitemap 30.09ms (five runs, no HTTP/user load).
These are not production SLAs. Query patterns/indexes are unchanged; no new
migration or speculative index is proposed. Larger inserts are additionally exercised
with the actual 1860 input. Existing 30s statement/idle limits and 5s lock timeout
are retained, not relaxed. Any real timeout aborts and requires read-only outcome
inspection/new review rather than silently increasing limits.

## Exact future execution — separate approval required

1. Approve the exact reviewed feature commit, manifest byte hash, plan content hash
   and protected dry-run artifact BYTE hash. Fetch remote status and require clean
   isolated checkout and matching HEAD. Do not infer write permission from PR review,
   CI, merge or this document. Do not use old +500/V1 plans or a different 1860 file.
2. Keep all backups and both external secret/CA files. Verify the approved target,
   full TLS and roles again. Coordinate other bibliographic importers, leaving
   readers and normal user/cache traffic online. Run a fresh read-only dry-run;
   relevant identity/plan drift requires new approval, never auto-replacement.
3. Only through the existing protected **in-process** launcher, supply the connection
   and official CA. Call `main(args, secretEnvironment)` from
   `scripts/catalog-batch-postgres.mjs` with nonsecret arguments:

```text
--target=<external approved target file>
--manifest=catalog/expansion-1860/manifest-v1.json
--manifest-sha256=5444825ab3eb1454f5c5d9ac1772b638b323880e9d934278cf90e59b078af9e7
--ca-file=<external official Supabase CA>
--plan=<external freshly approved dry-run artifact>
--plan-sha256=<approved artifact BYTE hash>
--apply
--confirm=APPLY lumiscore-plus1860-20261003-v1
```

4. The shared runner checks explicit approval/target/input bindings, opens SERIALIZABLE,
   locks identity relations in the existing shared order and recomputes the exact
   approved plan before any INSERT. Six set-based INSERTs commit atomically;
   no UPSERT/UPDATE/DELETE, seeds or migration. Reject anything but all-new 1860 or
   a complete unchanged owned batch. A colliding selection or partial batch is a stop.
   Save its ownership/run journal only outside Git and clear transient credentials.
5. After connection loss, inspect the ledger and identities read-only to determine
   whether COMMIT succeeded. If all 1860 are owned/unchanged, verify without retry.
   If rollback is proven, obtain a fresh matching plan and retry the atomic batch.
   A partial persisted batch cannot be auto-resumed or repaired. Sequence gaps after
   rollback are normal, not row writes. Stop and report the exact state.
6. Verify all six insert counts, identities and Edition relations, ownership hashes,
   unchanged historical bibliography/V1/+500/Collections/user data and a second
   dry-run with 1860 unchanged, zero pending inserts/conflicts/writes. Only then,
   under separate release approval, check live unfiltered Browse/Search, NL/EN,
   detail/covers, pagination/back, existing Collections and sitemap after cache refresh.
   No user rating/status writes, new classification or configuration changes.

## Exact targeted recovery model — no production deletes authorized

Tested local recovery binds the full batch content, complete ledger, current row
hashes and a fresh reference plan. It locks both owned and referencing relations,
then removes only this selection's memberships/provenance. For a new Work with any
later rating/status/Collection/other selection/extra Edition reference, retain its
complete bibliography. Delete only unreferenced, unchanged batch-owned Editions,
Works and truly unused newly created Authors; preserve all pre-existing Authors.
Never restore a global snapshot or remove legitimate later activity. Incoming Author
FKs and unsupported composite references require specific review before production
recovery. Changed row hashes or reference drift abort, not overwrite.

The executable destructive helper remains `synthetic:true` local-only. Actual
production recovery needs separate explicit approval and a freshly reviewed exact
reference/hash-bound plan; this PR does not add a production-delete entry point.
Keep backups/secrets after approval until final release validation is complete.

Remaining gate: separate explicit approval of this exact 1860 production batch.
Classification, additional native-origin evidence, science-fiction coverage and
series links are follow-up coverage work, not hidden claims or changes in this import.
