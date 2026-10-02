# Importer target-validation security review — 2026-10-02

Scope: separate security correction on `feature/catalog-selection-v1-20260930`,
based on feature `69f4447a175c6a15771549e584e9ee6fed2d59a8` and fetched main
`b95fb34d19260697efce0ab72f9e4fdc13eb23cd`. PR #2 remains Draft. This is NOT a
release authorization. The implementation and full correction diff were reviewed
by the implementing agent; no independent human approval is claimed.

## Root cause and explicit identity model

The old flat target used `user` for both the URL login and PostgreSQL
`current_user`. A legitimate Session Pooler login identifies both a role and a
project, while the live PostgreSQL role is a separate identity. Matching both to
one value incorrectly blocked the approved connection.

The replacement schema is `lumiscore-catalog-target-2`. Every listed field is
required; extra fields, old schemas and malformed types fail closed:

| Section | Fields and types | Source and rule |
| --- | --- | --- |
| Execution | `schema: string`, `environment: 'production' \| 'local-test'`, `dry_run: true`, `tls: boolean` | Explicit reviewed target; production requires verified TLS and initial dry-run |
| Connection | `form: string`, `host: string`, `port: number`, `database: string`, `login_username: string`, `project_ref: string \| null` | Locally parsed URI must exactly match every applicable target field |
| Session | `database: string`, `current_user: string`, `session_user: string`, `database_oid: string`, `system_identifier: string` | Separate live query; every value must exactly match the reviewed session identity |

Production supports only the approved project's full Session Pooler login,
Session Pooler host class, the exact independently reviewed hostname, port 5432,
database `postgres`, and separately approved effective/session roles. The hostname
is not project proof: the complete login and parsed project reference must also
match the fixed approved project. The existing database OID/system identifier
remain independently checked, not learned automatically from production.

Direct connections are supported ONLY for the explicitly named local-test
loopback endpoint on port 54322. Remote Direct, Transaction Pooler, custom roles,
alternate databases/ports and unknown environments are rejected. The local test
harness may derive a target from its owned loopback fixture; this must never be
used as a production approval procedure.

## Changed files

- `scripts/catalog-selection-postgres.mjs`: strict separate identities, verified
  TLS transport, read-only inspector, versioned target-bound dry-run artifacts,
  and secret-safe output.
- `scripts/catalog-selection-postgres.test.mjs`: adapt the original four runner
  tests to the explicit local target without removing their assertions.
- `scripts/catalog-selection-target.test.mjs`: 40 additional security tests.
- `scripts/verify-catalog-selection-supabase.mjs`: adapt only local target creation
  and target rejection assertions to the new schema.
- `package.json`: include the new security tests in the existing catalog command.
- This review/evidence document.

No importer decision logic, frozen records, identity pins, migrations, application
routes, UI, Auth/RLS definitions, dependencies or configuration were changed.

## Fail-closed and TLS review

There is no substring/fuzzy/suffix-only login acceptance. Both live role checks
are mandatory. Errors name failing fields without printing supplied values.
The CLI whitelists output and does not dump connection/session targets, raw driver
errors, credentials, query values or full action records.

The runner constructs individual pg connection fields; it does not pass a
`connectionString` that could replace the SSL configuration. Only a single
recognized standard `sslmode` parameter is accepted for production. Its value
cannot weaken the explicitly configured certificate and hostname verification;
other, duplicate or unverifiable parameters are rejected. The source secret is
never modified and no derived URI is saved.

TLS requires `rejectUnauthorized: true`, an explicit hostname verifier and
servername, plus an encrypted and authorized actual socket and a matching peer
certificate. An unsafe process-wide TLS setting is rejected. Official CA trust
was supplied only through the child process's temporary `NODE_EXTRA_CA_CERTS`.
No permanent trust-store change or TLS bypass was made.

Apply is not the default. It also requires a checksummed artifact explicitly
marked as a completed read-only dry-run, with frozen input hashes and a digest of
the entire new connection/session target. Old plans and old targets are rejected;
they cannot be silently reused after the identity-model change.

## Security test matrix

40 new tests pass. Coverage includes the valid different-login/same-approved-role
case; wrong project, substring and custom/suffixed login; wrong host, Transaction
Pooler port and database; missing/unknown target fields; missing or disabled
dry-run/TLS; non-production or mixed direct/Pooler targets; malformed URI encoding;
all five wrong/missing/null live identity fields; absent fingerprint; rollback on
identity failure; absent encryption, authorization or TLS options; certificate
hostname mismatch; unsafe/duplicate URL parameters; plan mode/input/target drift;
first apply without a reviewed dry-run; and secret-safe CLI/error output.

Synthetic endpoints/passwords only are used in unit tests. No test connects to
production or saves a real connection string.

## Read-only production probe

The new runner's exact validators were exercised against the already approved
connection and official root certificate. Secret/CA contents and identities were
kept in process memory and were not copied to this report, logs or Git.

| Check | Result |
| --- | --- |
| Locally parsed exact approved connection identity | PASS |
| Full login/project identity | PASS |
| Session Pooler, port 5432 | PASS |
| Live database, effective role and session role | PASS |
| Independently approved database OID/system identifier | PASS |
| Certificate chain and exact hostname, encrypted/authorized transport | PASS |
| Explicit read-only transaction | PASS |
| Rollback and connection closure | PASS |

Only BEGIN READ ONLY, session-local timeouts, read-only identity/settings SELECTs
and ROLLBACK were executed. No production catalog dry-run, schema probe requiring
new objects, migration, DDL, DML or import was executed. No production data or
personal information was queried for this validation.

## Fresh validation results

| Validation | Result |
| --- | --- |
| New target tests | 40/40 PASS |
| Original catalog/identity/import/query tests | 13/13 PASS, including the original four pg runner tests |
| Auth/ratings | 49/49 PASS |
| Actual built-server HTML | 5/5 PASS |
| Existing real local Supabase verification | PASS: 974 members, 1022 category links, 20 categories, 974 ledger entries, no new editions |
| Actual local runner with new target and new reviewed artifact | PASS: second execution pending/created/linked=0, unchanged=974; row snapshots unchanged |
| TypeScript `--noEmit` | PASS |
| ESLint, maximum warnings 0 | PASS |
| Client-secret scan | PASS: 44 built files, zero bundled identifiers/secret values |
| Vinext production build | PASS |
| Vercel-equivalent production build | PASS; local build only, not a deployment |
| `git diff --check` | PASS |
| Built local homepage browser check | Meaningful content and hero visible; no observed console errors, error overlay or horizontal overflow |
| Broad relevant suite | 449/453 PASS; four pre-existing missing-fixture failures, not a fully green suite |

The four failures were freshly reproduced from a Git archive of fetched main
`b95fb34d19260697efce0ab72f9e4fdc13eb23cd`. An automated comparison confirmed
identical test names, ENOENT codes and missing basenames, two failures each:

- `collection-v1-quality-audit.json`: frozen V1 audit coverage; contiguous series/gap rows.
- `catalog-expansion-trait-enrichment-option-b-write-plan.json`: approved five-row
  exact-ISBN plan; all five Works remain PARTIAL without era evidence.

No replacement fixtures were manufactured and no additional failure was waived.
Existing route-classification build notices remain; no new build failure.
Local build/browser tests used only the existing loopback Supabase credentials,
never production credentials or a changed hosted Preview environment.

## Frozen import behavior and hashes

The 875 existing links / 99 new Works / 974 selection members / 26 skips remain
the approved expectation, confirmed by the original local fixture tests, NOT by
a new production catalog dry-run. The Rendez-vous candidate-specific pin and
import decision logic are unchanged. Byte hashes were revalidated:

- Manifest: `7f4ec50e3946624530a82097b4ec2b78526b669350c30219ae5e11d8281a7046`
- Records: `ee121760b727a7e020876ff2c69227a20472c4112376b2ba6443398209353b7b`
- Pins: `e425d4e7a14b5d96075d113a6fd8349f4e8816d9862f48017e77f069d662131d`

## Workspaces and remaining boundaries

All 32 registered worktrees were inspected read-only. Only the designated feature
worktree was edited. The original main workspace retains its 95 existing status
entries; catalog-v2-audit retains 150; taxonomy-recovery retains 143 (expanded
untracked entries). The other 28 worktrees are clean. Committing this correction
returns the designated feature to clean status; ignored local test/build evidence
remains outside the commit. No worktree was reset, cleaned or removed.

No production migration/import/write, main merge, manual deployment, Supabase,
Vercel, DNS or secret-file change was performed. A normal feature push can trigger
the repository's existing automatic Preview; that is not a Production release or
functional staging approval. PR #2 must remain Draft after publication.

Remaining release requirements: review this separate commit; approve a fresh exact
production target in the new schema and a fresh checksummed dry-run artifact;
recheck remote/schema/catalog drift and the approved 875/99/974/26 result in a
separately authorized release. Do not reuse old SHA/plan approval or interpret this
read-only identity probe as permission to migrate/import. Remote Direct and custom
role support remain intentionally unavailable. Four baseline fixture failures
remain a separately documented repository issue.

## Primary references used for the security review

- [Supabase Session Pooler uses port 5432](https://supabase.com/changelog/32755-supabase-connection-pooler-deprecating-session-mode-on-port-6543-on-february-28-2025)
- [node-postgres SSL and connection-string option replacement](https://node-postgres.com/features/ssl)
- [PostgreSQL current_user/session_user identity definitions](https://www.postgresql.org/docs/current/functions-info.html)

IMPORTER TARGET VALIDATION FIX READY FOR RELEASE REVIEW
