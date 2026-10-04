# PR #8 — isolated online verification completed, 2026-10-04

This checkpoint supersedes earlier blocked/Draft checkpoints. Functional review readiness only; **no production release authorization**.

## Exact targets and deployment

- Repository `greenf88/lumiscore`, branch `feature/discovery-taste-test-20261003`.
- Reviewed implementation unchanged from `b28c0dbef9180c8e53095e96fddfa57b8823eecc`; two preparation documents pushed at **9917a7115bfc5937b6d8331da0dc8c0ae8f34dee**. Local and remote HEAD agree; clean worktree and whitespace check pass.
- `origin/main` unchanged at `5ce044cb07eb0a5ceb3d8eceb0ed3f7f5e730aae`.
- Existing Free test project **hlvujbrmfdlrfxdjwsmb**, `lumiscore-pr8-discovery-test`, eu-west-1. No second project, paid resource, repeated migration, production write or configuration change.
- [Branch Preview](https://lumiscore-git-feature-discovery-taste-a1fe88-rgkgroeneveld-9102.vercel.app/); [immutable Preview](https://lumiscore-5yj9dbfvn-rgkgroeneveld-9102.vercel.app/).
- [Deployment dpl_A8mtgKqHRECDM7CK1cm2E8JPV6Vx](https://vercel.com/rgkgroeneveld-9102/lumiscore/A8mtgKqHRECDM7CK1cm2E8JPV6Vx): exact HEAD, **Ready, Preview, 40s build**. Vercel status and Preview Comments check success. One planned Git-triggered rebuild used; no manual/second rebuild.
- Three public overrides are scoped to this branch only: test URL, matching test public client key, branch site origin. No server/service/database key in browser configuration. Test-only catalog, accounts and the independently confirmed sixty browser writes prove the live Preview is test-backed, not production fallback.

## Resolved preparation blockers

`GOOGLE_BOOKS_API_KEY` is an optional server-side Google quota credential for ISBN cover/description requests, not catalog, filtering or rating storage. Empty values do not disable Google requests. All 608 synthetic Editions have null ISBN and no external Open Library identity; the reviewed lookup exits before Google fetch without a valid ISBN. Therefore omit the unnecessary override. No fake key or change to inherited/general/Production keys. Google integration itself is not tested here.

The connected Vercel API still lacks team visibility, but the existing authorized browser dashboard and Git integration work for `rgkgroeneveld-9102`. No access bypass or token extraction; human reauthentication was not needed for this task. Optional connector maintenance is separate from Google configuration.

The old protected directory failed because sandbox and Windows-user identities differ. A CurrentUser DPAPI-encrypted record outside Git was successfully written and decrypted under the existing authorized Windows identity before provisioning exactly two synthetic accounts. Canary removed. Passwords were never printed, committed, embedded in reports or screenshots; the loopback-only masked credential bridge was used for ordinary browser sign-in. No ACL widening or permanent execution-policy change.

## Real browser plus database results

| Flow | Observed online result |
| --- | --- |
| Catalog loading | 389 Works, 608 Editions, 12 Authors, 20 categories, 46 Collections; actual synthetic titles and category counts; no masked unavailable catalog |
| Recommendations | 20 unique book links; count controls 10/20/25 produce real requested counts; final twenty exclude all sixty rated-round Works and the two other rated Works |
| Category navigation | Real category links; Fantasy results and Cooking zero-result state, English/Dutch honest copy |
| Combined filters | Author 8800001 + Fantasy + NL + `Synthetic`: 100 unique Works, four pages 32/32/32/4 |
| Return state | Page-two book 033 return retained author/category/query/language/pageSize/page; highest-score return retained filters |
| Rating-sensitive ordering | Existing book 155 changed normally from 6 to 10; return retained EN/highest/query/page 2/pageSize 32; moved out of page two and into page-one top scores |
| Sixty explicit ratings | A completed three voluntary rounds, NL/NL/EN, twenty per round; sixty distinct Works; each selected score explicitly confirmed in browser |
| Skip/no repeat | One A skip has no rating; no repeated Work across the sixty ratings, and skipped Work not offered again in rounds |
| Resume/reauthentication | After ten ratings, refresh and sign-out/password sign-in retained progress and current offer; real token refresh preserved identity/state |
| Idempotence/preservation | Real API retry of an already rated offer changed no state/count; baseline A score 6 and B score 10 preserved; A My Books shows Read 62 after final login |
| User isolation | B cannot read A ratings/rounds/preferences; forged-owner insert, direct round write, private-schema RPC and anonymous individual-rating read rejected |
| Swipe prototype | Keyboard and actual mobile drag offer score/skip intent; Cancel does not rate; skip requires explicit confirmation; no automatic score |
| Small/exhausted/zero | B with five remaining candidates saw five genuine recommendations; five confirmed skips yielded exhausted 0/20 without repeats; zero eligible displayed honest NL/EN empty states |
| Device/language/theme | 390x844 and 1440x900, NL/EN, Ink/Paper: all eight combinations inspected; no horizontal overflow. Actual rating/filter/swipe flows exercised across representative combinations, not sixty ratings in each combination |
| Error state | Deliberately wrong synthetic login rejected with explicit error; correct login subsequently succeeded. Final captured browser console error count zero |

The small/zero fixtures temporarily inserted only B-owned synthetic ratings/read statuses. Targeted cleanup restored B to one baseline rating and zero rounds/offers; no bibliography or A state changed. Both test accounts and encrypted credential record remain for review.

## Independent final read-only snapshot

Exactly two marked Auth accounts; bibliography unchanged 389/608/12/20/46. A has 62 ratings (one baseline, one normal-book rating, sixty round ratings), B one. A has three completed rounds with twenty rated offers each, sixty distinct rated Works and one unrated skip. B has zero rounds/offers after cleanup.

There is exactly one intentional historical/current-score difference: Work 8800155 has stored round score 6, current normal-book rating 10 after the explicit ordering test. This is expected editable-rating behavior, not a retry overwrite or unexplained mutation. Other round scores match current ratings.

Migration history remains exactly the previously applied fourteen original versions through 20261003183631. No migration or provisioning was repeated in this continuation.

## Advisors, performance and remaining limitations

- Baseline Security notices remain: two intentional deny-client RLS-without-policy objects; two public aggregate definer functions; three authenticated aggregate/recommendation definer functions. Real owner/private-schema denial tests passed; no claim that every definer warning disappeared.
- Auth adds a leaked-password-protection warning after email/password enablement. [Supabase documents this as Pro-and-above only](https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection). No upgrade within the $0 cap: only two random strong synthetic passwords, signup disabled, no production users. Documented test-only limitation, not an authorization to weaken production.
- Performance INFO: [two uncovered offer foreign keys](https://supabase.com/docs/guides/database/database-linter?lint=0001_unindexed_foreign_keys); [five unused indexes](https://supabase.com/docs/guides/database/database-linter?lint=0005_unused_index), down from eleven after real use. No unrelated index/security correction performed. Capacity/index review remains a separate production-release consideration.
- Warm hosted filtered SQL measurement from setup: execution 3.415ms, planning 0.029ms on 389 synthetic Works. New build 40s. These are not HTTP/LCP/production-scale measurements. Browser resource/LCP timing was not available through the approved inspection surface; Speed Insights is not enabled. No invented performance improvement or production SLA.
- Synthetic fallback covers only; no Google/live ISBN enrichment. Free-project inactivity/quotas apply. No destructive failure injection, production migration, SMTP delivery or production-load validation is claimed.

## Test/build evidence and documentation strategy

Unchanged implementation reuses recorded 539 full tests, 68 focused tests, 42 fixture/SQL/discovery checks, TypeScript, ESLint, Vinext/Vercel builds and 98 client-file secret scan. Current continuation additionally passed 19 description tests, changed-doc secret scan, whitespace check, fresh actual hosted build and the real browser/Auth/PostgREST/database matrix above. Existing build evidence was not represented as online functional evidence.

The two committed preparation documents explicitly point to this PR's final online checkpoint. Final evidence is recorded here and in PR #8 without a second feature push, because another push would consume an unapproved second automatic Preview rebuild. Runtime/migration/fixture bytes remain unchanged.

## Safe review reset / cleanup

Preserve project, migrations, fixture bibliography, two test accounts, backups and encrypted credentials. Do not rerun fresh provisioning, broad database reset, production recovery or project deletion. For future fixture reset, verify exact ref plus private marker, encrypted record and trusted app-metadata labels; delete only explicitly recorded disposable B state and preserve baseline rating. The already executed B reset journal is now clear and must not be run again without a new owned fixture.

External helpers `hosted-users.mjs evidence` verify identities/isolation without disclosure; `portal` provides a bounded loopback-only masked sign-in bridge; `restore-fixture` fails closed without its owned fixture journal. No secret-store load command should be run interactively. Clear the bridge clipboard, stop its process and close its temporary tab after use. Whole-account/project deletion and production release remain separately unauthorized.

Functional online verification complete. **PR #8 is Ready for review**, independently read back as open, non-Draft, mergeable with exact HEAD and successful Vercel/Preview checks. The connected GitHub integration lacked transition permission; the existing authorized repository GitHub credential route performed the standard official GraphQL Ready mutation without changing access.

Cleanup complete: clipboard cleared through the bridge UI, both browser test sessions signed out, local bridge tab closed and process stopped; temporary viewport reset. Ciphertext, both marked test users, test bibliography, production secrets and backups remain preserved. **No merge or Production deployment.**
