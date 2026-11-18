# Remaining recommendation covers, 17–18 November 2026

Starting point: 469 selected NL/EN editions without a verified cover, across 462 Works. The complete cohort was checked against Open Library edition records, the Dutch ISBN registry and, where necessary, independent publisher/library catalogues and Internet Archive metadata. This does **not** claim that all missing covers have been recovered.

The reviewed proposal recovers **250 covers: 76 Dutch and 174 English**. It reuses 18 exact existing editions and adds 232 source-verified editions, retaining every original edition. `audit.json` lists the **219 unresolved** locale/Work pairs with the remaining evidence gaps; those remain visible using the normal cover fallback. No recommendation is hidden to improve this count.

## Evidence and safeguards

- `proposal.json` binds each image to Work, author, title, language, ISBN/OLID and publisher. It includes bibliographic source facts, independent language evidence where needed, image HTTP/decode dimensions and image SHA-256. Each selected jacket was visually inspected. Raw downloaded pages and contact sheets are retained in the local recovery workspace, not bundled into the website.
- ISBN checksums and cross-Work ISBN/OLID conflicts are checked. Audio, adaptations, different volumes, wrong-language jackets, back covers and unusable scans were rejected. An exact edition without an ISBN is allowed only with a verified edition OLID.
- `baseline.json` preserves original rows. The production transaction aborts on Work/author or edition drift, identifier conflicts, competing preferences or a different SQL-selected edition. It is atomic and idempotent. Ratings, user lists, recommendation scoring, Work IDs and existing bibliographic fields are unchanged.
- A reviewed preference is subordinate to the existing language and edition eligibility rules. SQL search and the JS selector use the same preference. Dutch `dut` and `nld` share one unique preference boundary, without rewriting existing language values or creating unnecessary duplicate records.
- Image evidence is hydrated on the server and matched to the selected edition's full identity. The complete evidence inventory is not imported by UI components. Existing approved covers and unavailable-presentation guards retain priority.

## Release order

1. Apply the two checked schema migrations (preferred-edition support, then the Dutch language alias constraint/index). All preferences initially remain false.
2. Deploy the matching selector, presentation loader and `catalog-alternative-covers-20261117.json`.
3. Execute `production.sql` as supplied for a dry run; verify its 250-row receipt. Run the identical script with only its final `rollback` changed to `commit` after the matching deployment is ready.
4. Re-load all 469 original pairs, check the full recommendation inventory and live search/detail responses, then visually verify NL/EN mobile routes.

`rollback.sql` restores the original selected editions via guarded preference changes, while retaining all bibliographic rows. It requires the current preference-aware application and defaults to a dry run. Do not roll the application back to a selector that ignores these preferences as a substitute for the data rollback.

## Validation

The PGlite regression executes the complete production transaction, verifies rollback/no changes on a dry run, commits and repeats idempotently, checks SQL/JS/image hydration for every row, restores the original selection, and verifies atomic rejection of identity drift and identifier conflicts. Separate checks exercise Dutch alias uniqueness, cross-language exclusion and publisher image identity drift. Type checking, linting, CI build and production checks are recorded with the release.

The cohort is bibliographic data only; no synthetic public ratings or user-list changes are used for verification.
