# First additive +500 batch — preparation, not production execution

## Review basis

PR #4 was reviewed in full (nine fixture/test/documentation files; original
assertions retained), its eight fixture checks rerun, and both GitHub/Vercel checks
were successful. No required branch rules or outstanding reviews were present.
Merged with the normal history-preserving merge strategy:
`03d9db113b319a0ab78a000bad238ec1ce5011f1`. Automatic Vercel status is successful;
no second/manual deployment was started.

New isolated branch `feature/catalog-expansion-500-20261003` starts from that freshly
fetched main. No AGENTS.md was found in ancestors or the checkout. Original dirty
workspaces, V1 inputs/importers, existing release artifacts, secrets and backups
were not changed. Supabase/TLS and short-transaction guidance informed the separate
runner; there is no new migration, index, grant, policy, dependency or application
code change.

## Frozen input and identity review

Use ONLY `manifest-v2-reviewed.json` / `candidates-v8.json`. Earlier local revisions
and dry-runs are superseded, preserved in ignored local research history, and must
not be approved for apply.

- Manifest byte SHA-256:
  `aa13b44b71f03acb2889fd86cf62e81f567c545b9f5c132d62de52f2cc528eaf`.
- Exactly 500 distinct source Works and 500 distinct checksum-valid ISBN-13 Editions.
  No reuse of old Work IDs to inflate this count. Records retain exact ISBN,
  Edition key, single parent Work key, matching author key, source query/response
  URLs, normal book format or page-backed edition metadata, and verification time.
- 70 Dutch-language Editions; 430 English-language Editions. This is **not** a
  claim that 70 authors/original Works are Dutch or Flemish. That priority remains
  harder to source reliably than translated NL editions; no identities were invented.
- Source selection: existing reviewed gaps/reserves, then bounded want-to-read
  ordered NL-fiction / EN fantasy, SF, thriller, dystopia and fiction searches.
  Deterministic page/lane/Work-ID tie-break and explicit form review. Existing
  canonical/translated titles, stored aliases, Work/Edition IDs and ISBNs were
  compared in production memory, not exported as a full catalog snapshot.
- Historical backlog comparison: 1,180 source-verified historical candidates;
  1,147 already present, only 33 absent. Old HIGH labels alone were not reused as
  current evidence. Source ambiguity and incomplete chains were quarantined.
- 67 sequential **batch** requests, at least 1,100 ms start spacing, cap 70;
  no HTML scraping, paid services, account creation or hundreds of single-book calls.
  [Open Library usage policy](https://openlibrary.org/developers/api),
  [search/edition semantics](https://openlibrary.org/dev/docs/api/search).
- Form review excluded omnibus sets (Hunger Games, Shatter Me, Douglas Adams,
  Jurassic Park/Lost World, Dan Brown), reference substitutes, adaptations/comics
  and ambiguous volume bindings. Individual novels whose subtitle merely names a
  trilogy remain individual novels, not omnibus additions.
- Contradictory Nick Harkaway source-author IDs and source/existing author conflicts
  were excluded rather than merged. A final John le Carré same-name ambiguity was
  replaced by a verified reserve. `reserve-v2-unused.json` contains 22 bounded reserves;
  these are NOT approved actions and need a new manifest/plan if selected later.
- No categories or Collection memberships are inferred. Unclassified books remain
  visible to unfiltered Browse/Search and sitemap; both catalog surfaces retain the
  same persisted RPC source. Existing 59 Collections and V1's 974 members are untouched.

## Runner and safety model

`scripts/catalog-batch-postgres.mjs` is separate from the frozen V1 runner. The
shared connection guard requires the exact approved project, Session Pooler/5432,
database, login and independent current/session roles, database OID and system
identifier. Verified TLS checks CA **and** hostname, with rejectUnauthorized=true.
An explicit official CA is required; no TLS bypass or production setting changes.

Default execution is REPEATABLE READ READ ONLY, always rolled back. Source, target,
manifest and exact plan hashes are bound. Apply requires all of: explicit `--apply`,
literal confirmation, approved dry-run artifact and its byte hash, matching target
and input, and a recomputed identical live plan under SERIALIZABLE/table locks.
Any conflict/drift aborts before inserts; no automatic retry or fuzzy reconciliation.

Apply uses six parameter-bound set-based INSERT statements (selection, Authors,
Works, Editions, membership, private ledger), not thousands of network round trips.
Tables involved in bibliographic/alias identity are locked in the shared order;
five-second lock timeout is retained. Ordinary readers/user activity are not stopped.
There is no ISBN unique constraint in production: this runner protects its own
locked snapshot, not an unrelated writer acting after commit. Coordinate other
bibliographic import jobs during the future controlled apply; do not freeze readers.

Each created row has an ownership/content hash in the existing private ledger.
The ledger's required AI_EDITORIAL envelope denotes the preparation/review record,
not independently verified genre metadata. Categories/audience/form remain empty.
No UPDATE or DELETE of historical bibliography or user data exists in the apply path.
Full rerun verifies ownership/membership and produces zero writes; partial persisted
batches are refused, not silently completed. Atomic rollback permits a fresh plan
and retry. Sequence gaps after rollback are normal PostgreSQL behavior, not row writes.

Recovery is targeted: verify complete ledger and row hashes; inspect all incoming
Work FKs; retain new bibliography referenced by later ratings/status/Collections,
other selection links or extra Editions. Never restore a global snapshot. The
executable destructive recovery helper is deliberately **synthetic-local only**.
A real production recovery needs separate approval and a fresh reference/hash-bound
plan; changed bibliography is a stop for manual review, not overwritten. Other
Author references/constraints must also be reviewed before any production delete.

## Local verification and measurements

Full suite: **518/518**, no failures, skips or cancellations. Four new tests cover
strict input/hash/form/author guards, actual 500 public records, zero-write dry-run,
500 local inserts, fail-after-write atomic rollback/retry, stale ISBN conflict,
idempotence, membership/content ownership, old Collection/V1 preservation and
recovery retaining a later user reference. No production fixtures/credentials needed.

TypeScript and ESLint (zero warnings): PASS. Vinext and local Vercel-preset
production builds: PASS. Existing Vinext classification/chunking/plugin timing
warnings remain; no dependency/configuration workaround. Client secret scan:
90 files, no configured secret values or identifiers; no production credentials
were loaded into builds. Separate changed-source credential-pattern scan: zero
findings. Git diff check: PASS. Byte-preserving attributes protect batch JSON on
Windows/Linux checkouts.

The Vercel-preset build initially hit a Windows sandbox readlink EPERM; the same
local build succeeded outside that sandbox without configuration changes or any
deployment. Nitro's optional traceInclude resolution warnings remain informational.

`scale-results.json`: actual SQL RPC and ordered 1,000-ID sitemap reads against
3,140 / 5,000 / 10,000 **synthetic** Works, one Edition per Work, representative
title/author/language/category distribution and a 974-member V1 sentinel. Five
warm runs; p95 is nearest-rank/max of this small sample, not a production SLA.
Engine: local PGlite PostgreSQL/WASM, no HTTP/network, cover downloads or real user
load. Existing production Edition-work and Work-author indexes were verified
read-only and reproduced locally, not introduced in production. Only two populated
category facets are modeled; this is bounded query evidence, not complete UI load.

| Local p95 ms | 3,140 | 5,000 | 10,000 |
| --- | ---: | ---: | ---: |
| Browse 128 | 58.27 | 36.72 | 60.93 |
| Deep last page 128 | 27.95 | 37.19 | 57.96 |
| Title Search | 39.80 | 45.36 | 111.91 |
| Author Search | 32.73 | 60.07 | 103.60 |
| Edition Search | 31.72 | 49.01 | 80.21 |
| Sitemap all IDs | 23.46 | 30.09 | 81.89 |

Sitemap reads: 4 / 6 / 11, complete unique ID sets. An initial nonrepresentative
harness omitted the deployed Edition-work index and showed correlated-search costs
around 1–3 seconds at 3k/5k; stopped before finishing 10k, not used for scale claims.
The corrected deployed-index harness shows linear/materialized scan/sort growth,
particularly substring Search/newest sort; benchmark real service latency before
later 5k/10k releases. No speculative extra indexes or pagination rewrite here.

## Final read-only production plan

Verified 2026-10-03 with official CA, hostname verification, exact target and
explicit read-only transaction. An additional SQL allowlist refused any non-read
operation in the dry-run. Existing rows stayed in memory. No user rows queried.

- Current Works: 2,640; expected after separately approved apply: 3,140.
- New Works 500; new Editions 500; new Authors 263.
- Reused existing Authors 99 distinct, used by 187 new Work references.
- One new selection, 500 new members, 500 private ownership/evidence records.
- Categories 0; Collection memberships 0; skips 0; conflicts 0; writes now 0.
- Exact insert intent: the six tables listed above; UPDATE/DELETE/DDL intent empty.
- Plan content hash:
  `e5d315144bb9cb59ae16c0a74b7639e922b67b49289590a247a05ebdde762c39`.
- Protected external artifact: `EXPANSION-500-DRY-RUN-1791007991812.json`;
  byte hash `94a9cb0693dbf725aa1b32708586759e57f0c5cd3380afca2c4e991ba0ce71cb`.
  Kept outside Git in the existing owner-restricted release-artifact directory.
  Do not publish target files, credentials, protected baselines or backups.

## Exact future apply procedure — NOT AUTHORIZED OR EXECUTED NOW

1. Review this PR/commit, source batch and six INSERT templates. Obtain explicit
   production write approval for this exact manifest/plan; a review-PR merge alone
   does not authorize an import. Keep backups and both secret files.
2. Fetch/check the approved commit and clean isolated checkout. Revalidate target
   file/official CA and full TLS/roles. Repeat a fresh read-only dry-run. Changes to
   relevant identities or the plan require new review/approval, not auto-replacement.
   Normal ratings/preferences/cache traffic is not a baseline failure.
3. Through the existing protected **in-process** launcher, supply only the existing
   approved connection/CA temporarily; do not put credentials in command arguments,
   history, reports, environment dumps or shell transcripts. Call the runner with:

```text
--target=<external approved target file>
--manifest=catalog/expansion-500/manifest-v2-reviewed.json
--manifest-sha256=aa13b44b71f03acb2889fd86cf62e81f567c545b9f5c132d62de52f2cc528eaf
--ca-file=<external official Supabase CA>
--plan=<external freshly approved dry-run artifact>
--plan-sha256=<approved artifact BYTE hash, not its plan content hash>
--apply
--confirm=APPLY lumiscore-plus500-20261003-v1
```

4. The launcher calls `main(args, secretEnvironment)` from the new runner, captures
   only its whitelisted summary and stores the returned ownership/run report in the
   protected external directory; deletes temporary secret variables immediately.
   The runner verifies/recomputes the plan before any INSERT, commits atomically,
   and refuses unexpected partial/identity states. After a connection loss, inspect
   the ledger read-only before deciding whether commit happened; never retry blindly.
5. Immediately verify exact counts, identities, ownership, RLS/public access,
   unchanged V1/Collections/bibliography, Browse/Search/language filters, covers,
   sitemap and new user activity. Then a second read-only run must show 500 unchanged
   records, zero pending inserts/conflicts/writes. Retain useful later user activity
   if any targeted rollback is proposed. No database/config/security migration is
   required for this batch; no automatic recovery/import/deployment is authorized.

The preparation is ready for separate production-import review/approval. Existing
Auth/advisor risks documented in the V1 release remain separate and unchanged.
