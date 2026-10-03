# PR #8: preview diagnosis and isolated verification plan

Date: 2026-10-03. This document authorizes nothing remotely. Keep PR #8 Draft.

## Proven preview cause

The Vercel dashboard, reached through the already-authorized browser, identifies deployment `dpl_WFoNTw1DKvQE15pLB2zqtzbFERM4`, immutable URL `https://lumiscore-i9h75jb4n-rgkgroeneveld-9102.vercel.app`, Preview environment, branch `feature/discovery-taste-test-20261003`, commit `4b75a59f92e9a0a47508b154465d5df823aa82f6`. The branch alias names this deployment in the dashboard. A previously open alias page still referenced older deployment `dpl_2D4sVH8UuaudYkbb5os3rkmcGPpa`; do not treat an old browser document as proof of current HEAD.

Its actual build log reports only these presence indicators:

| Indicator | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL_configured` | false |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY_configured` | true |
| `SUPABASE_SECRET_KEY_configured` | false |
| `GOOGLE_BOOKS_API_KEY_configured` | true |

Settings show the URL in Production, and Preview URL overrides for **`fix/bulk-progress-exit`** and **`feature/collection-bulk-progress-v1`** only. No applicable URL exists for PR #8. The publishable-key entry applies to Production and Preview; its value/project was **not read**. SITE_ORIGIN is Production-only. Secret-key configuration is Production-only. No value was revealed or remote setting changed.

`vite.config.ts` embeds literal public configuration at build time; it deliberately rejects missing public settings only for Production, not Preview. `lib/supabase/client.ts` and `server.ts` reject a missing URL before creating a client. Home/Browse/Categories catch that failure and display unavailable/zero states; header auth catches it as logged out. Therefore **this preview has no usable Supabase target at all**, not a proven RLS/network failure in some chosen project. The smallest correction is branch-scoped **test-project** URL plus its matching publishable key and preview origin, followed by rebuilding that branch. Do not pair a test URL with the inherited shared key. No application change is needed to repair this configuration error.

Browser observations: shell loaded; Home reports catalog unavailable/zero books; Categories reports source unavailable; no browser console error was captured. Catalog loading is server-side: lack of a browser Supabase request is not evidence of a successful database call. Available runtime logs show `homepage.auth` success despite its caught fallback; that metric does not prove authenticated configuration or successful catalog retrieval. Vercel connector deployment inspection returned 403; its advertised build-log method returned “not found”. The authenticated dashboard supplied the missing evidence. Raw unauthenticated HTTP probes redirect to **Vercel login**, including script requests; returned HTML was access protection, **not a proven asset-routing bug**. Cookies/headers/keys were never extracted.

Read-only production inspection found the expected project, PG17, 13 baseline migrations through `20261002161527`, the existing `catalog_editorial_page` (invoker, anon execute), and public SELECT/RLS on authors, Works, Editions and catalog category relations. `catalog_discovery_page` and migration `20261003183631` are absent. This prevents new author/highest/round features **if** production were configured, but is not the cause of the entirely unavailable current preview: unfiltered discovery has a deliberate legacy fallback. No production migration or permission change is a remedy authorized here.

## Inventory and recommendation

Only project `qvplwejffhjvxaypmjut` is visible in organization **Lumiscore** (`oilqgtqwokvtobpzwogj`), plan **Free**. Branch inventory is empty; no separate hosted test target was found. A different existing local identity-validation stack uses ports 54321/54322/54324 and has not been altered.

| Option | Can prove | Cannot prove alone | Cost |
| --- | --- | --- | --- |
| Own local full Supabase + local app | Actual PostgreSQL, Auth, JWT refresh, PostgREST, grants/RLS and real inserts; local SSR/browser flows | Vercel runtime/build settings, hosted TLS/latency or online redirect behaviour | No new cloud bill; existing Docker/workstation resources |
| Separate hosted Free Supabase + this branch's Preview | Full online browser → SSR → Auth/PostgREST → database path, actual filter/rating/resume/navigation flows | Production capacity or guarantees from a small synthetic dataset | Expected **$0/month**, subject to confirming the available Free slot before creation |

**Recommend a separate Free hosted project, with local tests as a companion.** A Vercel Function cannot reach a workstation's localhost. Do not tunnel or expose the local database. Do not clone/branch production: Free does not include branching and a clone risks real data exposure.

Current [official pricing](https://supabase.com/pricing): Free permits two active projects, 500MB database/project, 5GB egress, 1GB storage and 50,000 MAU; inactive projects can pause after one week. Visible inventory uses one project, but organization/account eligibility must be checked immediately before creation. No paid upgrade is approved. Pro starts at $25/month; additional Micro compute starts at $10/month. Paid branches are not the proposed option. Set **incremental spending cap $0**, no add-ons, SMTP, custom domain, PITR or paid compute. Stop if the creation quote/slot requires payment. The existing Vercel project's normal Preview is reused, not a new paid Vercel resource. Recheck usage/limits rather than promising unlimited free operation.

Proposed name `lumiscore-pr8-discovery-test`, organization above, region `eu-west-1`, separate project reference, database, Auth signing keys, API keys and local secret files. Production retains its existing URL, credentials, Auth and configuration. No production Auth export, reader preferences, ratings/statuses or database backup is used.

## Prepared reproducible artifacts

Tracked files in `test-support/discovery/` are **test support, not new production migrations**:

- `bootstrap.sql`: minimal missing pre-repository authors/Works/Editions base, explicit public SELECT policies/RLS, private synthetic target marker. Not a claim of full production-schema parity.
- `migration-hashes.json`: exact byte hashes of 13 baseline migrations and unchanged PR #8 migration (`6bad8c98bddf86b6e4e6476e092d2cbe6080132234717410c113bf97ae0de089`). Changed/extra/missing migrations fail before fixture writes.
- `artifact-hashes.json`: pinned hashes for the four generated bootstrap/prerequisite/seed fragments, checked before any local setup. SQL checkout attributes preserve LF across platforms. Regeneration is not permission to silently accept changed fixture bytes.
- `seed.sql`: 305 wholly invented books, 12 synthetic authors, 608 Editions (NL/EN, five FR-only, three duplicate Editions), reviewed-seed evidence **explicitly labeled synthetic**, 20 existing category definitions, one extra synthetic series. Cooking remains empty; author 8800001 + fantasy + NL + “Synthetic” gives 100 unique Works across four 32-item pages. Unclassified historical prerequisites remain available in unrestricted Browse.
- Historical migration prerequisites: 84 **synthetic placeholder** Works at IDs referenced by the old Collection migration, without Editions/evidence, and 43 public reviewed series definitions already present in repository SQL. These are not real book identities. Final fixture totals: **389 Works**, 608 Editions, 12 Authors, 20 categories, 46 Collections. No ratings or Auth rows are SQL-seeded.
- `config.toml`: own local identity `lumiscore-pr8-discovery`, ports 55431/55432/55434, public-only API schema; global signup/anonymous auth disabled, **email provider enabled** for password login, refresh rotation, confirmed synthetic admin-created accounts. The installed CLI maps `auth.email.enable_signup=false` to a disabled email provider (observed `email_provider_disabled`); use global `auth.enable_signup=false` to block registration without blocking login. No actual credential is tracked.

Scripts:

- `discovery-test-fixture.mjs`: validates byte manifest before setup, refuses an existing Work schema or nonempty Auth, stages historical prerequisites in order.
- `discovery-test-plan.mjs`: **offline only**, generates four SQL fixture fragments, their SHA-256s and three original-byte CLI migration directories under ignored `outputs/discovery-test-plan`. It reads no credentials or network.
- `discovery-test-local.mjs`: exact owned container/workdir/config/loopback/key/database/marker guards. No hosted target, linking or db-url/reset flags accepted. Tool outputs that can contain keys are captured, never printed. `prepare`, `start`, `verify`, `evidence`, `dev`, `reset`, `stop` are local-only. Reset refuses a wrong marker, unexpected bibliography totals or any unmarked Auth account. Cleanup checks owned project/workdir even if the generated template has drifted. Local dev binds explicitly to 127.0.0.1:3015.
- `discovery-test-loopback.mjs`: the installed CLI initially publishes on all interfaces despite the dedicated network's default. Only this task's three published containers are recreated on loopback, preserving volumes and all CLI-injected gateway files in process memory; no global Docker setting or other stack is changed. The final loopback gate runs before fixture/account writes. Start must fail/stop on any binding/identity deviation.
- `discovery-test-api.mjs`: two randomly credentialed confirmed users via [official Admin API](https://supabase.com/docs/reference/javascript/auth-admin-createuser), real password login/relogin/token refresh/PostgREST, filters/four pages, three rounds/60 explicit ratings, skip/retry/read-trigger/preservation/RLS/private-schema denial and rating-sensitive highest order. Only run-created accounts are globally signed out/deleted in finally; credentials/sessions never printed. This is not browser-UI proof. This integration test has actually passed; subsequent read-only `evidence` verifies zero user/progress rows remain and bibliography is intact.
- `discovery-test-fixture.test.mjs`: guard/loopback regressions and the full migration chain on disposable PostgreSQL fixtures. Existing SQL round, recommendation and navigation tests remain complementary evidence.

Local commands, from this branch's worktree:

```text
node scripts/discovery-test-plan.mjs
node --test scripts/discovery-test-fixture.test.mjs
node scripts/discovery-test-local.mjs prepare
node scripts/discovery-test-local.mjs start
node scripts/discovery-test-local.mjs verify
node scripts/discovery-test-local.mjs evidence
node scripts/discovery-test-local.mjs dev
# Explicit disposable-target reset only, never another stack:
node scripts/discovery-test-local.mjs reset
node scripts/discovery-test-local.mjs stop
```

The generated local CLI directory intentionally has migrations/seeding disabled: the guarded fixture runner applies exact reviewed SQL directly and **does not claim matching CLI migration history**. The cloud plan below uses the official migration workflow and preserves original versions/bytes instead. Do not run production importer scripts or substitute production env files.

## Hosted execution steps — approval required first

1. Confirm Free eligibility/current quote $0, create only the named separate test project. Record its immutable ref; reject production ref at **every** subsequent write. Require HTTPS on Auth/API and official test-project root CA with verified hostname/certificate for direct PostgreSQL. Privileged database current/session roles and database must match the separately recorded test target plan. Keep new test credentials outside Git with current-user ACL; never reuse existing production secret files.
2. Fresh preflight: repository/remote HEAD; all 14 migration hashes; four regenerated fixture fragment hashes; new test project ref/org/region, database/user/session identity, verified TLS; empty application schema, empty Auth, no prior migration history. Inspect advisors and explicit public/private schema grants. Refuse an existing/unknown project or personal data. Do not blindly push the full chain: historical prerequisites would fail.
3. Apply `00-bootstrap.sql` to that verified fresh test target. Use the existing credential-shielded executor for the Supabase CLI, with an explicitly new **test** connection, `sslmode=verify-full`, official test CA, captured/redacted CLI output and no credential-bearing shell/history/report. Review exact pending migration list before each stage. The local-only test runner deliberately cannot accept a cloud URL.
4. Stage `01-native`: official CLI dry-run then push must list only `20260903220000`. Apply `02-placeholder-works.sql` after the new native metadata columns exist. Stage `03-through-collections`: CLI dry-run/push must list exactly the remaining seven baseline files through `20260916071439`. Apply `04-collection-prerequisites.sql`. Stage `05-full`: dry-run/push must list exactly the remaining six files through `20261003183631`. Original files are copied byte-for-byte; no production file/history is rewritten. Check stage history, schema/RLS/grants, private schema exclusion and zero unexpected user writes each time.
5. Apply `06-categories-and-seed.sql` only after verifying the synthetic marker and expected placeholder-only bibliography. Check totals above, duplicate-Edition relationships, evidence, zero Auth/ratings/offers, public API visibility, private schema denial and advisors. Record actual runtime/schema versions; minor-release [changelog](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes) matters, but this fixture uses no custom operators/ltree/btree_gist or pgcrypto extension-dependent expression.
6. Create **only two** synthetic confirmed email/password accounts under `example.invalid`, labeled by trusted admin `app_metadata`. Do not send email/invite, export production Auth or grant roles through user_metadata. Store randomly generated test passwords locally outside Git; provision no service-role credential to Vercel. A fresh third account is permitted only by a separate expanded test-data approval; the planned tests reuse/reset these two users.
7. Test Auth settings: signup and anonymous sign-in disabled, email/password login enabled, refresh rotation on, JWT expiry 600s. Site URL exactly the branch Preview. Redirect allow-list only that host's `/auth/callback`, scoped recovery callback with known query keys/state, `/update-password`, and local `http://127.0.0.1:3015` equivalents if needed. No production origins, wildcard `*.vercel.app`, custom SMTP or OAuth providers. Password-login redirect is same-origin application `next`, not an external Auth allow-list shortcut. Follow [Auth redirect documentation](https://supabase.com/docs/guides/auth/redirect-urls); verify the actual recovery query pattern before using it, never broaden globally to fix a failing test.
8. Vercel **Preview + exact Git branch only**: override `NEXT_PUBLIC_SUPABASE_URL` with this test project's URL, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` with its matching publishable key, `NEXT_PUBLIC_SITE_ORIGIN` with the branch Preview origin. These public values are build-time, so rebuild only that Preview. Production/Development and other Preview branches remain untouched. Keep `SUPABASE_SECRET_KEY`, service-role/database credentials, production backups and any tokens out of Preview. The inherited GOOGLE_BOOKS_API_KEY is configured in this old preview; disable its use for this branch with an empty branch override if supported, otherwise return for review before sharing/removing any globally scoped setting. Synthetic book covers can use existing fallback artwork; external cover/Google integration is not the rating/filter test.
9. Recheck actual deployed HEAD/build-presence indicators, chosen test ref, RPC discovery, public SELECT and owner-only RLS via real API before any account action. Confirm normal production remains unchanged. Complete the browser matrix below and preserve only aggregate evidence/no sessions. Keep Draft on any unavailable catalog, error, failed RLS, ambiguous write or unproven required flow.

## Browser verification matrix (still a required gate)

Use both synthetic users independently; desktop/mobile, NL/EN, Ink/Paper. Record real network status, request/body byte counts and duration, not cookies/authorization headers or synthetic passwords.

| Flow | Required evidence |
| --- | --- |
| Home/overview recommendations | 20 unique Work IDs with real seeded evidence and explicit rated exclusions; 10/25 choice; no-evidence state, only-five-candidate state and zero-candidate state are honest, not padded |
| Combined filters | Author 8800001 + fantasy + NL + query “Synthetic”: 100 results/four pages, 32/32/32/4, no duplicate Works from Editions/categories; incompatible cooking combination zero; author + category persists on Search/Browse/detail return |
| Explicit taste rounds | Three voluntary rounds; exactly 20 new ratings each, 60 distinct IDs, one separate skip without rating, no repeats at sufficient pool size, existing score preserved, retries do not overwrite/increment twice |
| Persistence/auth | Refresh mid-round preserves current offer/count; sign out then normal sign in resumes; refresh session works; reader B cannot read/resume reader A's round/ratings/preferences |
| Rating-sensitive navigation | Change a score through book UI; highest sorting recomputes, not A–Z; filter/page/pageSize/return destination and scroll remain; profile/book/refreshed recommendations show the saved value |
| Small/exhausted state | Reset **test data only**, use a five-eligible-book/zero-eligible-book fixture phase or explicit exclusions; never delete production data or recycle offered Works to fake a full round |
| Safety/visual | RLS rejects forged owner ID/direct round write/private API; no console errors/overflow, accessible score buttons and experimental swipe confirm/cancel/keyboard; no swipe automatically stores a score |

Reset in the hosted test target is limited to the two marked synthetic accounts' sessions/ratings/statuses/preferences/rounds/offers. Revoke/sign out sessions before deleting accounts; deletion alone does not revoke issued JWTs. Recreate only those accounts and recheck bibliography totals/marker/expected test ref; never restore a production snapshot. Do not issue blanket remote `db reset`. Whole-project cleanup requires verifying this recorded test ref, removing only this branch's Preview overrides and deleting only the dedicated synthetic project after evidence is retained and explicit cleanup approval. Existing production secrets/backups stay intact.

## One bundled approval proposal

Approve creation/configuration of **`lumiscore-pr8-discovery-test` in Lumiscore (`oilqgtqwokvtobpzwogj`), eu-west-1, Free, incremental cost cap $0**; the reviewed test bootstrap + exact fourteen migrations/prerequisites + synthetic fixture data above; exactly two synthetic confirmed accounts; test-only Auth/redirect settings; the three branch-specific public Preview overrides and branch-only disabling of inherited Google API usage; one Preview rebuild and full tests/reset of those synthetic users. No production schema/data/credentials/configuration, other branches, paid plan/add-on, merge or deployment to production. If the Free slot/cost, target identity, TLS, pending SQL or branch-isolation check deviates, stop and report together. Project deletion is not requested/executed now.
