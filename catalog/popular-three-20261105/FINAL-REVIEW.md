# Three popular Dutch titles — bounded data-only proposal

Status: prepared and installed **only on test**, not released. Social must hold all three destinations until independent public production acceptance. Source/release work does not change social files or schedules.

## Current production and identity review

Read-only production `qvplwejffhjvxaypmjut`, verified 5 November 2026 10:52 UTC: main/active production `09b96f5bcb129ecaba4e8b7ec5cfadd6372e98f4`, Ready deployment `dpl_JBcBNxPFDkuPtiyK5A3j52ySoaax`, actual `lumisco.re` alias independently checked. Exact four ISBNs, Dutch/original titles, author corpora and aliases checked. None of the three target Works or four editions exists. The authors already exist: Sarah J. Maas 125, Ethan Mollick 843, Mel Wallis de Vries 813. Other same-name titles by other authors are excluded.

| Title | Identity / proposal | Exact Dutch editions | Test Work / edition IDs |
|---|---|---|---|
| Hof van versplinterde harmonieën | One new Work, original A Court of Splintered Harmony. Not A Court of Thorns and Roses (1360). | 9789000378401 paperback; 9789000408481 hardcover | 989110001 / 989210001, 989210002 |
| Co-existentie | One new Work, original Co-existence. Not Co-intelligentie (1573). Ethan Mollick author; Alexander Klöpping foreword only. | 9789465520391 paperback | 989110002 / 989210003 |
| Insane | One new Work by Mel Wallis de Vries. Not Vals (1668). | 9789026186790 hardcover | 989110003 / 989210004 |

Production IDs are intentionally **unassigned**. Identity-generated IDs are returned in the first production receipt; do not use test IDs or promise a public URL in advance. `native_identity_key` and edition ISBNs make replays resolvable without resetting sequences. New Works reuse existing author IDs. No invented OL identifiers, scores, reviews or popularity scores.

## Evidence and decisions

`reviewed-books.json` records per-title/edition facts, source URLs, review date, original 60–100-word Dutch summary, cover identity and conflicts. Primary sources: Lannoo/Unieboek (both Maas ISBNs), Bloomsbury (original title and Work identity), Maven (Mollick and foreword role), De Fontein (Insane book page and author interview). Bureau ISBN corroborates Mollick format/language. Maas ISBN records contain an English-language error; primary publisher explicitly confirms Dutch and translators for both ISBNs. This conflict is recorded, not blindly imported. Insane publication-day sources differ; only the uncontested year 2026 is stored. Series evidence is retained; this package does not modify collection/series links or taste eligibility.

The outdated Maas paperback image dated 20261022 returns 404. Live publisher browser review located its current 20261103 image. Bibliographic imagery depicted a hardcover and was rejected for the paperback. Maven's full-spread image was rejected; the publisher's separate front-cover image is used. All four selected images were downloaded, decoded and visually checked: 123,198 / 82,959 / 35,995 / 39,562 bytes. The hardcover 82,959-byte derivative matches its 3.3 MB publisher original. No new cover host/storage or image edits. The Maven front is only 242×350, readable at the existing card/detail sizes but limited intrinsic resolution.

## Exact scope and manifest

Production: **14 inserts** = 3 Works + 4 editions + 4 edition-bound cover/format metadata rows + 3 Dutch summaries. **Net +3 Dutch-available unique Works** after successful import; currently realized +0. No production author insert, alias/schema migration, rights/configuration change, account/rating/progress/trait/collection action. All titles are searchable using existing Work-title plus edition-title search; no search code change.

`release-hashes.json` SHA256: `62c655069d747e4020bf6140434350b79e5852d23dbcc2ac8c7a6751506e22cb`. It binds source decisions, current snapshots/schemas, and all production/test plan, apply, dry-run and restore files. `evidence-hashes.json` separately binds receipts/readbacks/browser evidence. Files are LF via package `.gitattributes`.

Test `hlvujbrmfdlrfxdjwsmb`: **15 inserts**, adding one isolated Ethan Mollick author fixture because that author is absent on test. Existing test Maas/Wallis authors are reused and retained. Test Work/edition IDs above are reserved only for this batch. Test records remain available for review; remove only through the receipt-bound test restore when no longer required.

## Executed verification

* Local PGlite executes exact SQL against both actual schema shapes: dry-run returns to baseline; committed import; zero-mutation replay; rejection of later edits, incoming dependencies and a tampered receipt; committed restore and replay restore; original data plus synthetic rating/progress stand-ins preserved. Shared edition/source tests also pass (6/6 focused tests).
* Hosted normal logged-in Supabase dashboard route, exact named test project: 15 committed actions; complete first receipt saved before replay; replay 0. Independent readback confirms 3 Works, 4 editions, 4 metadata rows and 3 source-bound summaries. New Work ratings/status dependencies were zero before restore.
* **Committed** receipt-scoped restore succeeded. All five catalog table counts AND full-content fingerprints match the preimport baseline, not merely a transactional ROLLBACK. Same 15-action test state then reinstalled with separate receipt. No private tables appear in any DML. Broader private-table fingerprint access was not used as evidence; preservation is supported by bounded catalog-only SQL, FK dependency guards and local private stand-ins, not an exported account snapshot.
* The initial browser `Run without RLS` action was rejected by automatic review. Package now explicitly enables RLS on its session-local `ON COMMIT DROP` receipt table; no persistent relation/policy/grant added. Monaco editor insertion initially produced a parse error before execution. Editor contents were replaced and verified against the exact local SQL after CRLF normalization before successful execution. These rejected/error attempts are not counted as imports.
* Existing **Ready** test Preview reused: `https://lumiscore-omh4szyik-rgkgroeneveld-9102.vercel.app`, deployment `dpl_C4aEykKSZeegu3ngrmKF4DEr9kd3`, git head `f3450748458ecd98f9c117a441d145489e00a390`, runtime application commit `24b3ba6d39ddb34cb12e2f8650a1a566a6e79ec6`. Its tree equals current main before this data-only package. No branch environment change, rebuild or protection change was required.
* 24 guest browser observations: all three Dutch default presentations show correct identity/ISBN/title, actual decoded matching covers, exact stored summaries with publisher source links. All six Dutch/original title searches resolve to their correct single Work; Insane's identical original/Dutch title was tested without pretending these are two independent source facts. Card/detail have the same absent public score (—), no synthetic rating. Reload, return to search, NL→EN→NL, Paper/Ink, desktop, 320/390 px checked. No horizontal overflow observed. No authenticated personalized ranking proof is claimed or needed for this data-only scope.
* EN direct pages correctly report no verified English edition and show no Dutch cover/summary. No EN edition is added or inferred from the original title.
* 6/6 original hosted HTTP responses (3 Dutch titles × desktop/mobile UA simulations) contain exact source-linked summaries in initial description sections, correct exact edition ISBNs and valid canonical head placement. Preview protection/noindex is distinct from production policy. CLI TTFB median 329.332 ms, excludes CLI bootstrap; no controlled cold cache or production-performance claim.
* Three selected default covers loaded on actual hosted cards/details. The additional Maas hardcover binding is transported/visually verified and passes shared loader checks locally; it is not claimed as a fourth simultaneously selected hosted Work/card.

No app runtime, dependencies, layout, ranking, PR51 consent/measurements or metadata code is changed. No GSC or social action.

## Proposed production order — separate batch release approval required

1. Check exact PR head/CI, current main, all manifest hashes and current production alias. Recheck source bindings, original author corpora and absence of all four normalized ISBNs/native identities. Stop on drift or unexpected dependencies. Record an actual current production snapshot.
2. Only after batch approval: execute exact `production-apply.sql` transactionally on `qvplwejffhjvxaypmjut`; preserve the **first nonempty 14-row committed receipt** securely before replay. RLS applies even to the temporary receipt table; no persistent DDL.
3. Independently read all returned full rows, confirm action counts/identity/summaries/covers and old parents; repeat exact apply expecting **0** changes. Do not overwrite first receipt with the replay receipt. Measure +3 unique suitable Dutch Works separately from text counts.
4. Merge only the approved data/evidence PR according to existing procedure if authorized. Runtime remains unchanged; no production environment change is needed. Confirm active deployment if Git causes an automatic build.
5. Use returned production Work IDs to check all three **public production** book pages, both title searches, covers/summaries/source links, score parity and mobile/Paper/Ink/navigation. Only then return usable `https://lumisco.re/nl/book/<actual-id>` routes to Social. Social independently rechecks within 24 hours before any publication. No social actions in this product task.

## Rollback

Load the original complete production receipt into `lumiscore.catalog_release_receipt`, then execute exact `production-restore.sql`. Scope validation resolves generated parents and allows only these exact 14 actions. Full-row CAS plus all incoming FKs (including CASCADE) reject later edits or dependencies and abort the transaction. This protects legitimate ratings/statuses/other references added after import. Never disable guards, reset sequences, or use a replay/dry-run receipt. Investigate a guard failure rather than deleting shared data. The test procedure is identical with 15 own test actions; committed restoration is independently proven. Production restore has **not** been executed.

Release advice: data package ready for review; **not positive live confirmation for Social yet**. Existing release agreements require a separate concrete batch approval before production import/merge/publication. Unrelated Co-intelligentie, Vals, Work1360 year, other catalog batches and duplicate investigations remain outside scope.
