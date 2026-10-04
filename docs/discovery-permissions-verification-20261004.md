# PR #8 — explicit function ACL correction and release re-review

2026-10-04. Separately authorized minimal fix/test/preparation, **not a production release**. No production migration, merge or deployment. Old approval for `5ae5ad2fea5f9edb2929c8ca8460e95ffeef947c` does not cover these changed release artifacts.

## Cause, inspection and exact correction

The previous review missed an independent explicit default EXECUTE grant to `anon` on new public-schema functions. Revoking pseudo-role PUBLIC does not revoke a separately named role. State was INVOKER and anon table SELECT denied: this establishes a privilege-contract mismatch, **not anonymous row disclosure**. New checks inspect real `has_function_privilege`, ACL grantees, owner/mode and role membership and send actual denied PostgREST requests. [Supabase function privileges](https://supabase.com/docs/guides/database/functions#function-privileges).

All four function owners are `postgres`, all search_paths empty. Client roles anon/authenticated have no inherited memberships/SUPERUSER/BYPASSRLS. Final exact client contracts:

| Signature | Mode | PUBLIC EXECUTE | anon EXECUTE | authenticated EXECUTE |
| --- | --- | --- | --- | --- |
| public.catalog_discovery_page(text,text[],text,text[],text,integer,integer,bigint[],bigint) | INVOKER | no | yes | yes |
| public.taste_rating_state() | INVOKER | no | no | yes |
| public.taste_rating_advance(text,uuid,bigint,integer,text) | INVOKER | no | no | yes |
| taste_private.advance_round(text,uuid,bigint,integer,text) | DEFINER, unexposed | no | no | yes |

Only state needed correction. Other function definitions/grants are unchanged. Existing owner/service_role operational grants are retained, not browser client rights; no such key is supplied to browser code.

New file `supabase/migrations/20261004120823_discovery_taste_state_permissions.sql`, SHA-256 `f92e248e4034a8a0325fcfc30f6b82cafc74cef66db7483d44dd1d40f183a22e`, UTF-8/no BOM/LF. Exactly BEGIN → REVOKE ALL on zero-argument state from PUBLIC/anon → authenticated EXECUTE GRANT → COMMIT. No function-body, owner, RLS/table/default-privilege/unrelated-rights/data changes.

Original feature migration hash remains `6bad8c98bddf86b6e4e6476e092d2cbe6080132234717410c113bf97ae0de089`. Forward-only strategy preserves applied test history. Official CLI created the initial empty local file; official test MCP apply allocated `20261004120823`; the uncommitted local file adopted that actual recorded version before final commit. No history repair/rewrite/reapply. Hosted test now has fifteen versions; production still requires thirteen baseline versions plus the **explicit reviewed pair**.

## Real hosted database/API proof

Existing Free test `hlvujbrmfdlrfxdjwsmb`; same two DPAPI-encrypted synthetic users reused, no new project/account/provisioning/configuration. No credentials printed or stored in Git/report; no production credential used in test.

Independent SQL confirms every final effective permission above, same owners/modes/search_paths, both tables ENABLE/FORCE RLS, authenticated SELECT-only, no anon table privileges. Directly before/after the rights migration, all synthetic row digests were identical:

| Table | Before/after MD5 observation |
| --- | --- |
| taste_rating_rounds | 84984373e9a7a2a16869c6073d7d6d01 |
| taste_rating_offers | 37e69634e2a2f17c2641b75355db5e12 |
| ratings | b969bddb45e7dc4303b147f85b88f711 |

These are test observations, not a production backup/security signature. No personal row content exported; the ACL migration wrote no data.

Actual password Auth/PostgREST (not SQL text/mocks):

- Anonymous state RPC and both owner-table SELECTs denied with actual **42501**, not missing-schema errors.
- Both authenticated readers read their own state. Both directions of owner-table isolation and forged other-reader resume rejected.
- A's **62** existing synthetic ratings and completed third-round progress unchanged; B's prior score unchanged.
- B stores exactly **one** new explicit synthetic score (7); retry adds nothing, count/state persist, resume matches, one skip adds no score. These intentional test writes remain stored; no destructive reset.
- Existing A idempotent retry/real token refresh preserve exact state; both genuine password logins work. Exactly two existing users retained, no third hosted account.

## Fresh local regression proof and validation

Disposable PostgreSQL regression reproduces Supabase's explicit anon/authenticated/service_role default function grants before original SQL. Original anon state EXECUTE is true and the effective checker fails; forward correction removes anon/PUBLIC, retains authenticated, preserves default ACL rows/old ratings and safely repeats only GRANT/REVOKE. Existing three-round tests run with those defaults too.

**Fresh real local PostgreSQL 17 + Auth/PostgREST passed.** The task's own database was reset with no seed, then rebuilt from the original thirteen migrations, unchanged feature migration and forward ACL fix, plus reviewed synthetic prerequisites/seed. Docker ownership/workdir/loopback-only 55431/55432/55434 gates exclude the other running identity-validation stack. The local CLI reset initially recreated bindings and the gate stopped verification; only this disposable stack was re-confined/restarted. Runner now carries its exact network through reset and re-confines before use, with allowlisted non-secret errors. No global Docker config or other stack changed.

Actual four-function effective permission check passed; genuine anonymous state/table requests fail; two run-created synthetic users completed password login/relogin, real token refresh, **60 unique explicit scores over three rounds**, one unrated skip, persisted state/retry/owner isolation and old-score preservation. Those two local users were signed out/deleted by the existing guarded runner. This is independent of both PGlite and hosted API evidence.

Runtime bytes remain unchanged, so [prior online browser evidence](discovery-online-verification-20261004.md) remains functional evidence, not a newly performed browser run or a valid prior anonymous-grant assertion.

### Compiler, test and artifact checks

- Nine focused SQL/fixture/release-delta tests pass; final explicit-default/inherited-role/unplanned-grantee regression passes, and the final four fixture/delta tests pass. Complete synthetic chain is fifteen hashed migrations, bootstrap/seed hashes unchanged. Offline test-plan generation confirms fifteen files and no remote writes.
- Initial unbounded-concurrency full suite: **548 pass / 0 assertion failures / 1 timed-out cancellation**, total 549. Existing persistent catalog-selection test exceeded its unchanged 120s timeout at 124.2s under concurrent fixture-heavy tests/builds. Isolated four-test rerun **4 pass / 0 failed/cancelled**, affected test 70.8s. No unrelated code/timeout change. The final complete two-worker rerun and remote CI are recorded in the exact-SHA PR approval envelope after they complete, not prematurely claimed here.
- Final TypeScript, ESLint and whitespace diff checks pass. Local Vinext build **58.553s**, Vercel-target build **91.244s**; no large-chunk warning. Both use only existing public test configuration, not Production deployment. Ninety-eight client files pass secret scan including noncredential server canary; no real server secret supplied to builds.
- All nineteen changed/untracked preparation files relative to implementation SHA pass secret scan. The first scan flagged old synthetic credential-shaped target-guard literals, not actual secrets; these tests now use password-free fixture URIs, preserving wrong-target rejection without widening scanner exemptions.
- Local cleanup independently verifies **zero** Auth users, ratings, reading statuses, preferences, rounds and offers, while 389 Works/608 Editions remain. Only the task's local stack stopped; volumes and unrelated running identity-validation stack retained.
- Read-only production check still finds thirteen versions, zero release versions/new taste objects, 10,134 Works/10,293 Editions. The final post-commit captured CLI identity/TLS/two-file dry-run, protected snapshot hashes, release SHA/manifest and PR status are bound in the approval envelope; no apply mode is invoked.

## Advisors, recovery and approval boundary

After correction, test Advisors retain existing two deny-client RLS INFOs, two public aggregate DEFINER warnings, three authenticated aggregate/recommendation DEFINER warnings and leaked-password-protection warning. No new rights-fix finding. Performance retains two offers-FK INFOs and five unused historical indexes. No unrelated repairs.

Keep the security correction on test; never restore anon/PUBLIC EXECUTE. Future Production requires new exact approval/hashes/target/TLS/history gates and both migrations in order, with no merge until effective permissions and both empty tables are verified. Each file is transactional, not the pair. Interruption after only feature SQL requires exact read-only schema/history inspection, old app kept serving, no blind retry/repair. App rollback preserves schema/history/ratings/progress and needs separate release authority.

See [revised executable release proposal](discovery-production-release-plan.md). Final SHA and plan/manifest hashes are bound after commit in the PR approval envelope. **Old approval/manifest rejected. No merge, production migration or Production deployment in this task.**
