# LumiScore social launch local review

Prepared 6 October 2026 for editorial review before 9 October. Local implementation only; no hosted migration, Auth setting, push or deployment is authorized by this document.

## Pages and content

`/toplijsten`, `/toplijsten/dystopie-vanaf-1990` (10 books) and `/toplijsten/fantasy-sciencefiction` (25 books) are editorial reading routes, not community rankings. Content, original book-publication years, existing Work IDs, original NL/EN notes and selection reasons live in `lib/catalog/top-lists.json`. The 35 identities were matched read-only against existing production catalog metadata. No identities or classifications are written. Eight choices lack a cached image; the existing title/author fallback remains available. The other 27 reuse existing Open Library cover URLs.

Divergent uses the verified original year 2011 only in the editorial content, not the existing catalog field 2010. Good Omens credits both authors in this content. The Three-Body Problem uses first standalone book publication 2008, distinct from 2006 serialization and 2014 English translation. These are presentation notes, not catalog repairs. Genre labels are editorial inclusion judgments, not new database classifications.

## Privacy contract

`20261006164920_rating_summary_input_bounds.sql` retains the prepared raw-input boundary of 100 one-dimensional IDs. `20261006173806_public_rating_privacy_b.sql` adds the five-distinct-rater threshold, the bands 5–9 / 10–19 / 20–49 / 50+, and an explicit insufficient-evidence state. New V2 RPC returns no exact count. Both existing RPC signatures return null exact counts and threshold-safe scores. Discovery sorting does not discard unrated books or use exact counts as a tie-break. Collaborative contributions require five distinct contributing peers. Own ratings and user-owned taste state remain private and usable.

The threshold is not an anonymity guarantee: with five independently known eights and exactly one new rating, a new mean 8.2 identifies nine among integer ratings 1–10. Old published aggregates cannot be withdrawn from third-party archives. Below-threshold community quality is neutral in recommendations, not zero. Above-threshold quality uses the published score without inventing an exact sample size; ranking may change as an intended consequence of this policy.

## Local preview

Use two terminals in this worktree. Existing dependencies suffice; no package install or hosted connection is needed.

1. Run `node scripts/social-launch-fixture.mjs` (loopback port 55441). This uses a disposable in-memory PGlite database and a public visitor-only HTTP adapter. It does not implement login or rating writes, and never contacts hosted Supabase.
2. Set process-local `NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:55441`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=local-synthetic-public-client` and `NEXT_PUBLIC_SITE_ORIGIN=https://lumisco.re`. The client value is a fixture marker, not a credential. Do not load a hosted `.env` or any secret/service-role/Google key. Run `node node_modules/vinext/dist/cli.js dev --hostname localhost --port 3106` and open `http://localhost:3106/toplijsten`.
3. Run `node --test scripts/test-social-launch-html.mjs`. The test accepts loopback HTTP targets only.

The adapter serves a snapshot of the selected public book identities, fake local edition metadata and actual local SQL summary bodies. It is not a full Supabase/PostgREST/Auth environment. The browser route ends at the existing login/registration interface; actual authentication and owner writes are separate hosted release gates. Stop only these two local processes when finished; no original volumes or credentials are involved.

## Local evidence and release gates

172 targeted unit/SQL tests and 6 server-HTML tests passed. SQL tests run the complete 18-migration synthetic chain, explicit Supabase-like default grants and actual anon/authenticated roles. They cover threshold/band boundaries, legacy routes, raw input bounds, private table denial, two-owner isolation, collaborative four/five-peer boundaries and unchanged rating rows/default privileges. Existing flexible-round, guest-answer, result and recommendation tests remain green. These are local proofs, not a new hosted result.

Browser checks measured 390×844 and 1280×900 CSS pixels; no horizontal overflow. NL/EN, Ink/Paper, editorial labels, a loaded cover, missing-cover fallback, list-to-book return and the existing sign-in interface were checked. The verified editorial return survives login and continue-browsing links. No credentials were entered, accounts created or rating writes performed. Server HTML has exactly one robots/canonical and one each of the tested OG/Twitter tags, localized EN content and a real 404 for unknown list slugs. This is not a new LCP/CLS audit or real-phone test.

TypeScript, targeted ESLint, Vinext and Vercel-preset builds and the generated-client secret scan passed. Vercel file tracing required a local sandbox escalation for an ancestor readlink operation, not a code/configuration change or deployment. The separate release proposal records exact migration hashes and the final local commit. Required future gates: hosted test migration/API/browser verification, independently approved password-minimum tests, fresh production preflight and separate release execution approval. Herauthentication and Bookmatch remain outside this release.

## Source checks

In addition to each book's existing Open Library Work reference: [Good Omens authors and 1990](https://terrypratchett.com/books/good-omens/), [Scythe 2016 and dystopia](https://www.simonandschuster.com/books/Scythe/Neal-Shusterman/Arc-of-a-Scythe/9781442472426), [Unwind 2007](https://www.simonandschuster.com/books/Unwind/Neal-Shusterman/Unwind-Dystology/9781416912040), [Butler's Parable series](https://www.octaviabutler.com/parableseries/), [Divergent original 2011](https://en.wikipedia.org/wiki/Divergent_(novel)), [Three-Body serialization and book publication](https://en.wikipedia.org/wiki/The_Three-Body_Problem_(novel)). Supabase [functions](https://supabase.com/docs/guides/database/functions) and [password security](https://supabase.com/docs/guides/auth/password-security) inform the bounded privilege and subsequent Auth plans.
