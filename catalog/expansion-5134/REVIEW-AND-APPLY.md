# +5134 catalog expansion — prepared, NOT imported

## Scope and basis

The user changes +5000 to **5134 net-new Works**, not the preparation-only gate.
Fresh `origin/main`: `ebb6bf03066c446d73b13a56c21ff26047737707` (completed PR #6).
Isolated branch: `feature/catalog-expansion-5134-20261003`.
No AGENTS.md exists in this checkout or its checked ancestors. Original workspaces,
local edits, backups and both external secret files are preserved.

No production import, migration, main merge or production deployment is authorized
or performed. Keep the PR open for review. Previous completed releases and their
manifests/contracts remain byte-unchanged. No application, dependency, schema,
grant, RLS, routing, taxonomy or configuration changes are included.

The sole importer limitation was its explicit 500/1860 contract gate. A separate
`lumiscore-additive-batch-3` / `lumiscore-additive-manifest-3` accepts exactly 5134.
The existing identity/TLS guards, six set-based INSERTs, transaction, locks and
local-only destructive recovery remain unchanged. Supabase's verified-transport
and short-transaction guidance informed this choice; no security relaxation.

## Frozen input and plan

Only `manifest-v1.json` and its pinned `candidates-v1.json` form the proposed batch.

- Manifest BYTE SHA-256: `d2114bee3612c831d8b51bf8278d278a2d81850391a66e983e5d375dff7efc7b`.
- Records BYTE SHA-256: `bbe00c9bd3979fb67f5838efda5086d048abf0fbbd7ca907ee3e5508500c3f79`.
- Plan CONTENT SHA-256: `5e7db598b65035e6107ea75b8cc94c7b3e3061ff652646444e94b8ac0e278d95`.
- Protected final dry-run: `EXPANSION5134-DRY-RUN-1791042824482.json`.
- Dry-run BYTE SHA-256: `06739d180aca95cb662c5e028b431447466228234f78e6f919fda17ba9e9a695`.

Full plans, target identities, connection/CA files and backups stay in the existing
owner-restricted directories outside Git. `production-dry-run.json` contains only
safe counts/checks and hashes. Raw source dumps/caches are ignored, not committed.
The preliminary manifest `8886881e...` and its earlier plan are **superseded and
must never be applied**. They were discarded during composite-volume review,
before publication or any production writes. Final hash binding rejects them.

| Proposed INSERT | Rows |
| --- | ---: |
| Works | 5134 |
| Editions | 5134 |
| Authors | 3053 |
| New batch selection | 1 |
| New selection memberships | 5134 |
| Private ownership/provenance | 5134 |
| Total | 23590 |

601 distinct existing Authors are reused in 1548 Work references, with no updates.
Selection slug: `lumiscore-plus5134-20261003-v1`; labels exactly
`Catalogusuitbreiding +5134` / `Catalog expansion +5134`.

Baseline: **5000 Works / 5159 Editions / 2597 Authors**.
Expected: **10134 Works / 10293 Editions / 5650 Authors**.
Existing selection memberships 974 / 500 / 1860 and 3334 private records remain
untouched. Proposed UPDATE/DELETE/category/trait/Collection/user-data writes: zero.
Classifications are not inferred from the private identity-provenance envelope.

## Reproducible source selection and identity review

`SELECTION-POLICY.md` fixes priorities before new discovery. Reuse unused reviewed
reserves/backlogs first, then named NL/Flemish author gaps, Dutch Editions, broad
non-fiction and international fiction. Personal genre taste is not a platform-wide
filter. Source `want_to_read` is a popularity proxy, not measured search demand.

`discovery-summary.json` records all exact queries, retrieval times, response hashes
and page results: **73 new sequential Search requests + 24 cached exact queries**,
>=1100ms request-start spacing, within the 120-new-request cap. No individual
book/author harvesting, paid source, new account, HTML scrape or cover download.
Queries use language dut/eng, fields including ISBN/Edition/single author and source
year, 500 results/page, want_to_read order. Named-author queries explicitly include
Dutch/Flemish writers; this does not certify every writer's nationality or original
language. Exact query URLs make the lane/page caps and author list reproducible.

17798 initial Work candidates are not automatically input. Verification rereads
the complete, already-downloaded official 2026-09-30 dumps, checking advertised
compressed size/SHA-1 and independently computing SHA-256, without redownloading:

- Editions: 12617475043 bytes; SHA-256
  `0c30ebacc2fa1453fd644c5823a64b6b294c97d650b603eea46f6cbb26a010e7`.
- Works: 4073320823 bytes; SHA-256
  `1e642ad9742e80f1b60f9125eb6a8fa17bafe42690a9236e0df86f86f28eaf1d`.

[Open Library API policy](https://openlibrary.org/developers/api),
[Search/Edition semantics](https://openlibrary.org/dev/docs/api/search),
[official dumps](https://openlibrary.org/developers/dumps).

Final proofs: **4568 exact Edition-dump chains; 566 Edition-plus-Work author chains**.
Every ISBN-13 is checksum-valid and distinct; all 5134 Work and Edition IDs are
distinct. Each print Edition has one exact parent and author. Missing Edition
authors are allowed only from a matching hashed single-author parent Work; explicit
contradictory authors cannot be overridden. Minimal source facts/revisions/record
hashes bind Edition title, ISBN, language, publisher, print format/pages and identity.

Compare source IDs, available ISBNs, canonical/chosen translated titles and stored
aliases with the current production snapshot, and reject internal overlaps and
ambiguous/source-conflicting Authors. An existing edition/translation is not a new
Work; no merging/correction of existing identities. Unproved native records remain
out. Previously quarantined split/misdated/composite Works remain out.

The additional title review found combinations missed by the historical form regex
(Ana Huang, Nancy Drew, Murderbot, collected stories/poems and others). The new
discovery-only conservative guard excludes all slash/collection/collected-volume
ambiguities rather than assuming a combined Edition is independent. This also
excludes some potentially legitimate slash titles; 7051 verified eligible candidates
remain, so no identity criterion was relaxed to reach 5134. A Ranma Work/Edition
volume mismatch and an uncertain Horus Heresy companion/composite are quarantined.
Actual-input regressions require final candidates/reserves to pass these guards.

The deterministic builder is `scripts/catalog-batch-5134-research.mjs`: reviewed
reserve priority, named-author priority, rank/source-ID ordering, current-production
identity exclusion before selection, Dutch target 1500, broad non-fiction target
1800, general fiction up to 2000, specialist cap 750. Actual coverage is recorded,
not retroactively represented as assigned genres. 58 previously unused reserves
were selected; **100 independent unused reserves** remain, not approved writes.
Any replacement needs new input/hashes/review/production plan.

Historical backlog: 1305 distinct identities; 4 selected matches. Known series
hints imported in prior releases are not re-added. **No additional established
series gap is proved in this batch**; `series-follow-up.json` is empty. Series/native
origin/classification enrichment is separate work, never a hidden Collection write.

## Coverage and explicit unknowns

Edition language: **1558 Dutch / 3576 English**. Source-year periods:
before 1900: 20; 1900-1949: 85; 1950-1979: 363; 1980-1999: 1174;
2000-2019: 3215; 2020-2026: 277. These source years are not independently certified
first editions. Original language and Dutch/Flemish origin: UNKNOWN for all 5134.

Discovery lanes: reviewed reserves 58; named-author gaps 101; NL fiction 799;
general fiction 1776; NL biography 169; NL science 112; NL psychology 169;
NL history 169; biography 397; society 544; economics 320; science 165;
psychology 225; history 130. Broad non-fiction lanes total 2400; subject hints are
not classifications. Specialist lanes do not dominate; no specialist-lane candidate
needed promotion after broad priorities filled the batch. This is not complete
science-fiction/series coverage, nor evidence that broad-fiction titles lack those
themes. Report coverage gaps instead of inventing classifications.

Cover metadata: **4423 available / 711 unknown** (including unreviewed cached
reserve cover status). No HTTP/image-quality/loaded-cover assertion. Existing cover
resolver/placeholder is unchanged. Editorial classification: **0/5134, all unknown**.
All categories/traits/Collection memberships stay empty. Existing unfiltered
Browse/Search include uncategorized Works; Edition language filters still work.

## Fresh production dry-run — no writes

Read-only production verification on 2026-10-03 uses the existing exact approved
target, project `qvplwejffhjvxaypmjut`, Session Pooler/5432 and official Supabase CA.
Certificate and hostname verification, encryption and `rejectUnauthorized=true`
are checked. Connection identity, current/session roles and database fingerprints
are independently checked without publishing those private values. Credentials
exist temporarily in process memory only, never arguments/output/Git. No changed
secret, TLS bypass, project/configuration change or additional SQL write.

The final plan and bibliography/selection counts share one REPEATABLE READ READ
ONLY snapshot, always rolled back. A query allowlist also refuses DDL/DML/COMMIT.
Concurrent catalog-writer lock count: **0**; no user traffic paused. Dry-run predicts
the full insert table above, zero conflicts/skips/unchanged, zero actual writes.
Normal cache/ratings/status activity is not compared to an obsolete global hash.

## Tests, transaction decision and scale

**532/532 tests PASS**, zero failures/skips/cancellations (139.265s). The final real
5134 input tests pin manifest bytes, unique proofs and reserves, full production
author-reuse counts, SELECT-only dry-run trace, exact inserts/Edition relationships,
fail-after-4000 atomic rollback, safe fresh retry, zero-write repeat, preserved
pre-existing bibliography/Authors/selection/Collection/user sentinels and targeted
recovery preserving a later user FK. No production/source network or credentials.

Final actual-input successful apply transaction: **6308ms** locally while other
database tests ran concurrently; full apply/rollback/repeat/recovery exercise
125.480s (case 133.757s including setup). Synthetic 5134 exercise: 114.655s.
PGlite/WASM timings are not production SLAs. Six set-based bound INSERTs remain
appropriate for **one atomic transaction**, not untested internal chunks. Existing
5s lock timeout, 30s statement/idle limits are retained, never raised automatically.

TypeScript PASS (direct local TypeScript entry point after the package-manager
`exec tsc` shim failed); ESLint PASS, no warnings; Vinext and local Vite/Vercel-preset
production builds PASS. Existing informational route-classification/plugin/dynamic
import warnings persist. No credentials supplied to tests/builds or deployment.
Client scan: 46 files, zero secret identifiers/values. Publication scan and final
diff/history-byte checks are recorded with the final commit/PR completion report.

Unchanged 3140/5000/10000 scale evidence is retained. Additional deployed-shape
RPC/sitemap local measurement at **10134 Works**, five warm runs, appears in
`scale-results.json`: p95 Browse-128 58.44ms, deep-last 52.67ms, title Search 68.31ms,
author Search 76.42ms, Edition Search 72.10ms, NL filter 45.86ms, sitemap all 71.32ms
(11 chunks, all 10134 unique IDs). Local synthetic database, no HTTP/covers/user load;
not production latency. Existing indexes only; no index/migration proposal.

## Exact future execution — separate explicit approval required

1. Approve exact feature commit, final manifest BYTE hash, final plan CONTENT hash
   and protected dry-run BYTE hash above. Fetch, require clean isolated checkout,
   unchanged reviewed diff and matching local/remote HEAD. CI/review/PR opening is
   not import or merge approval. Do not use +500/+1860/preliminary plans.
2. Preserve secrets/backups. Verify target, roles, official-CA/certificate/hostname
   again. Coordinate catalog importers, keeping ordinary users/cache/readers online.
   Obtain a fresh read-only baseline/dry-run; unexpected catalog identity/plan drift
   requires explanation/new exact plan review, never automatic replacement or a
   changed batch size. Relevant protected bibliography/classification/selection/
   Collection/schema/security baselines must be captured consistently. Normal user
   activity may advance independently, not be reverted.
3. Only via the existing protected in-process launcher, supply secret environment
   temporarily to `main(args, secretEnvironment)` in `catalog-batch-postgres.mjs`:

```text
--target=<external approved target>
--manifest=catalog/expansion-5134/manifest-v1.json
--manifest-sha256=d2114bee3612c831d8b51bf8278d278a2d81850391a66e983e5d375dff7efc7b
--ca-file=<external official Supabase CA>
--plan=<external freshly approved dry-run artifact>
--plan-sha256=<that artifact's approved BYTE hash>
--apply
--confirm=APPLY lumiscore-plus5134-20261003-v1
```

4. Runner binds target/manifest/input/approved plan, opens SERIALIZABLE, uses the
   existing shared identity-table lock order and re-plans under locks before the
   first INSERT. Six insert statements commit together: 23590 rows, no UPSERT,
   UPDATE, DELETE, seeds or migration. Reject collisions, partial state or drift.
   Save the ownership/run journal protected outside Git; clear transient secrets.
5. After timeout/connection loss, **do not retry blindly**. On a fresh verified
   read-only connection, inspect ledger/identities to establish committed versus
   rolled back. Complete 5134 owned/unchanged: verify without reimport. Proven full
   rollback: fresh matching reviewed plan permits atomic retry under that release
   approval. Partial persistence: stop for specific review. Sequence gaps on
   rollback are normal, not catalog rows. Never increase timeout/TLS limits.
6. Verification uses a fresh connection and caches the input batch digest **once**,
   not 5134 full-input hashes inside an idle transaction (a prior external checker
   timed out for that reason, not an import rollback). Validate counts, all source
   identities/Edition parents/ISBNs/Authors, ownership hashes and protected old data;
   account for provable independent users/cache activity. Repeat dry-run must show
   5134 unchanged, zero necessary inserts/conflicts/writes. No test user records.
7. Only under separate release approval, recheck PR/HEAD/CI and normal merge/deploy.
   No force push/direct main push/manual duplicate deployment. Check unfiltered
   Search/Browse, NL/EN, Ink/Paper, desktop/mobile, details/cover fallback, pagination/
   back, old Collections and all new sitemap IDs after normal cache refresh. Do
   not change user ratings/statuses or assign classifications.

## Targeted recovery and log-access limitation

Local tested recovery binds batch/complete ownership/current row hashes and a
fresh reference plan, locks owned plus referencing relations, removes only this
batch's selection/provenance and preserves later referenced bibliography. A later
rating/status/Collection/selection/extra Edition means retaining that Work and its
Edition. Only unreferenced unchanged owned rows and truly unused newly created
Authors can be removed; never delete old Authors or restore a global snapshot.
Changed hashes/references, composite FKs or incoming Author dependencies require
specific review. The destructive helper still requires `synthetic:true` and is
local-only; **no production recovery/delete entry point or approval** is added.

Read-only Vercel access was investigated: the connected app returned no teams;
deployment lookup with the known deployment URL/team slug returned 404. No validated
team/project context is available to query runtime logs. **No runtime-log scan was
performed or claimed**. No login/account/right/settings change. For an approved
future release, use available GitHub deployment/build/check statuses and real
server/browser probes; request a read-only log excerpt from an authorized operator
if errors need runtime diagnosis. Missing log access is a disclosed visibility
limit, not grounds to broaden permissions or fabricate a clean-log result.

Remaining production gate: **explicit approval of this exact +5134 input and plan**.
No import/apply, merge, migration or production deployment was started.
