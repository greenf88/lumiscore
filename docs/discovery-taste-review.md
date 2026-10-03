# Discovery and rating-based taste test — review evidence

Status: implementation and local verification complete; NOT approved for production or fully verified in an authenticated online preview. A separate Supabase test project has not been identified. Do not merge or apply this migration to production to work around that gate.

## Baseline and concrete changes

Base: `5ce044cb07eb0a5ceb3d8eceb0ed3f7f5e730aae`; branch `feature/discovery-taste-test-20261003`. Existing workspaces, release secrets and backups were not modified.

- The hero displayed `recommendations.slice(0, 3)` while the recommendation engine defaulted to ten. The hero retains its compact preview, but the full Home section and `/recommendations` now show twenty unique eligible Works by default. The overview accepts 10–25; genuine shortages remain visible. Existing evidence thresholds, read/rated exclusions, scores, confidence and explanations remain in use. Medium-sized recommendation covers retain fallback artwork without per-card resolver requests.
- Home highest-rated links omitted their origin, so detail return used the default `/browse` A–Z. They now encode Home explicitly. Browse/Search links preserve query, canonical author ID, category, selection, language, sort, page and page size; recommendation links preserve count. Existing collection membership validation remains unchanged. Internal destination validation rejects external/unknown destinations and invalid Work links. Session scroll restoration and a rating-change freshness marker support native document navigation/browser back.
- `7` was hardcoded and the category statistic was plain text. The actual public `catalog_categories` source contains **20 categories, 19 with linked Works**, with **Cooking & Food empty** at verification. This table has no separate active flag: current published rows are the public source, not research taxonomy. Count and category links are dynamic, localized and available in both themes/menu sizes. No classification was added. Unclassified Works remain in the unrestricted catalog.
- A versioned server RPC adds canonical primary-author filtering and highest-score ordering, combined with existing title/alias/edition search, OR-category, selection and language filters. Filtering/counting precedes pagination; category/Edition relations use EXISTS rather than multiplying Works. The current model has one primary Author-ID per Work, not a coauthor junction. New author/highest controls await this RPC; fallback to the deployed RPC is allowed only when no new filter/order would be silently ignored. Category overview loads metadata without hydrating unused book cards.
- Two owner-readable, FORCE-RLS round/offer tables persist progress. A JWT-owned private transaction function serializes actions per reader, inserts into existing ratings without overwriting, and uses the existing rating-implies-read trigger. Only explicit 1–10 ratings advance the twenty-rating goal. Skips do not rate. Offered, skipped and rated Works are excluded from later rounds. Start resumes unfinished rounds; subsequent rounds are voluntary, including after round three. Users can consciously choose another unrated/unoffered Work. Exhaustion is explicit; language, author/category diversity and existing popularity inform suggestions without invented genres.
- Guests retain the existing device-only preference quiz at `/taste-test/preferences`; it does not claim to save ratings. The default taste test requires verified login for real ratings.
- `/taste-test?prototype=swipe` is opt-in only in local development or preview. Left/right select skip/read intent; skip requires confirmation and read requires explicit score confirmation. Buttons, keyboard arrows on the card, cancel and a gesture-distance/direction threshold remain available. **Recommendation: direct score buttons as the default.** They make scale/meaning more visible and accessible; swipes can speed recognition but introduce ambiguity and gesture errors, so keep them experimental. No swipe creates a score.
- Production-backed review environments block the new taste-test writes and durable production cover-cache refreshes. No security settings or production roles/policies were changed. This is not a blanket sandbox for every pre-existing account action: do not create production test ratings/statuses through other endpoints.

## Verification

All database writes below occurred solely in disposable, in-process PGlite fixtures; no production migration, catalog import, user rating or status write was executed.

- Full unit suite: **539 passed, zero failed** (188.9 seconds, concurrent fixture-heavy run). Subsequent focused checks: **68 passed** after the review-write guard and legacy-order safeguard. An additional guard assertion is included in that focused run. TypeScript and ESLint pass after final UI changes.
- SQL fixtures contain 10,134 synthetic Works and exercise canonical author/category/language intersection across multiple pages, duplicate Editions, empty results and highest score beyond the aggregate's first 100-ID batch.
- Three complete rounds store **60 distinct explicit ratings**, one separate skip stores no rating, persisted state survives refresh, retries preserve count, existing ratings remain unchanged, and the existing trigger creates read status. Other-owner reads/actions and direct client writes are denied; anon cannot call private progression. A concurrent normal rating is preserved atomically. Exhaustion does not recycle prior offers.
- Five existing real server-HTML catalog tests pass; two added HTML checks pass against the local public read-only review server. They cover category count/links/NL/EN/empty copy, original Home destination, bounded recommendation count and single consistent SEO tags. Fixtures deliberately assert the observed public category baseline.
- Local Vinext production build and Vercel/Nitro preview-target build succeed. The latter uses Node 24. Public-only build configuration is read into process memory; no environment file is copied into this worktree.
- Client secret scan finds no server-secret names/values in compiled public assets; real server secret values were not supplied to these local builds, so this is not proof about every externally configured deployment secret. `git diff --check` passes.
- Browser: desktop 1440×900 and mobile 390×844; NL/EN and Ink/Paper inspected on public views, categories/empty category and return navigation. Home shows **20** recommendations with completed guest evidence; count-25 overview shows **25 distinct Works**. Recommendation → detail → browser back retains `limit=25`; Home highest-rated return restores Home and observed scroll ~1109px. No horizontal overflow or console errors observed. Responsive covers/fallbacks remain usable.
- Authenticated taste-test UI, saved ratings → book/profile → refreshed recommendation flow, combined author/highest filters in the online preview, and actual swipe interactions with an authenticated card remain **NOT end-to-end verified**. Local SQL/API-input tests do not replace those missing browser checks. No separate test configuration is available; preview must report this limitation honestly.

## Performance measurements and limitations

| Measurement | Observed result | Scope |
| --- | --- | --- |
| Two author/category/language page queries | 184ms combined | In-process PostgreSQL, synthetic 10,134 Works, concurrent full test run; not remote latency/SLA |
| Filtered RPC page JSON | 259 bytes, 32 Work IDs | Excludes later book hydration, covers, HTTP and framework payload |
| Public cold recommendation catalog loader | 164 requests, 6,216,593 decoded response-body bytes, largest response 792,792 bytes, 2,540ms wall time | Real public catalog, 10,134 Works; existing Work/Edition, public aggregate and evidence batch shapes; excludes ranking, later hydration, reader queries and cover requests |

The cold loader remains a significant server-side cost. It does not send all 10,134 Works to the browser. Existing guest catalog cache is five minutes; authenticated loading is not equivalently cached. Changing ranking/storage architecture is not claimed here. One local run, warmed remote caches and workstation/network effects limit inference. New filtered page queries run server-side; no whole-catalog client filter was introduced. No production EXPLAIN or query-time claim is made for the new, unapplied RPC.

## Migration and separate-test execution gate

Repository migration: `supabase/migrations/20261003183631_discovery_taste_rounds.sql`, SHA-256 `6bad8c98bddf86b6e4e6476e092d2cbe6080132234717410c113bf97ae0de089`. Review these exact bytes before later application; no existing migration or catalog schema was rewritten. It runs in BEGIN/COMMIT, has no seed/backfill, and leaves the deployed `catalog_editorial_page` intact.

Before online functional sign-off, provision or identify an explicitly approved **nonproduction** Supabase target (not production `qvplwejffhjvxaypmjut`) and its safe preview public/SSR configuration. This task did not authorize creating a paid cloud project, changing Preview credentials, or copying production service-role credentials.

In that separate target only:

1. Verify project identity, verified TLS where using the database connection, migration history and current reviewed branch SHA. Keep credentials outside Git/output and inspect pending migrations; do not blindly apply all to an existing target.
2. Create the baseline schema from repository migrations in an isolated disposable target, then use the official Supabase CLI migration workflow for this exact migration. No production linking/apply command is authorized by this document.
3. Load synthetic/nonpersonal test bibliography and test accounts in that target only. Verify public RPC discovery, owner-only RLS, explicit-rating/read trigger, three rounds, retry/refresh, conflict preservation, search-chosen Work, exhaustion and opt-in swipe through the real SSR/PostgREST/browser flow.
4. Recheck desktop/mobile, NL/EN, Ink/Paper, author+category+query pagination and rating-sensitive return rank. Record network payload/request counts and actual remote query latency there. Only then move the PR from Draft/partial review to complete functional review. A separate explicit release decision is still required for production.

## Recovery (not executed on any live database)

Before any future application, capture the target schema/grants and protected data read-only and retain the reviewed snapshot. BEGIN/COMMIT makes a migration failure atomic; close/rollback a failed transaction and inspect the exact state rather than repair history ad hoc.

Prefer reverting the application feature or a reviewed forward correction. If new tables contain any real progress, **do not use the empty-schema cleanup below**: securely preserve that progress and existing ratings/read statuses, then review a forward fix. Never delete normal ratings or restore an old production snapshot.

Only for a disposable target or newly applied, still-unused feature, the exact cleanup below fails closed unless both new tables are empty. It does not touch existing rating/status, catalog or collection data and uses no CASCADE. It requires a privileged migration role and an explicitly reviewed target; this document is not execution authorization.

```sql
-- BEGIN REVIEW-ONLY RECOVERY
begin;
do $$ begin
  if exists(select 1 from public.taste_rating_rounds) or exists(select 1 from public.taste_rating_offers) then
    raise exception 'Progress exists: preserve it and review forward recovery';
  end if;
end $$;
drop function public.taste_rating_advance(text,uuid,bigint,integer,text);
drop function taste_private.advance_round(text,uuid,bigint,integer,text);
drop function public.taste_rating_state();
drop table public.taste_rating_offers;
drop table public.taste_rating_rounds;
drop function public.catalog_discovery_page(text,text[],text,text[],text,integer,integer,bigint[],bigint);
drop schema taste_private;
commit;
-- END REVIEW-ONLY RECOVERY
```

This cleanup does not itself reconcile a remote migration-history entry. Any subsequent history/reapplication strategy must be separately reviewed for that disposable target; never mutate production history as an improvisation.
