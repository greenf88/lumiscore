EDITORIAL TOP 10 CAMPAIGNS — 28 OCTOBER 2026

Scope
Ten new bilingual editorial reading routes. Original dystopia/fantasy lists remain intact.
No production catalogue import, rating, account, taxonomy, taste selection or analytics change.
PR51 and its temporary records are not part of this work.

Source register
selection-register.json binds each existing production Work to its exact edition records,
ISBN, stored language, source Edition->Work identity, print format and reviewed cover.
The Work/edition evidence was read from public catalogue records and bounded Open Library
source batches. Official sources supplement content/series checks where recorded.
Reasons are own editorial text. This is not a score ranking or personal match calculation.
Most NL presentations currently use the explicitly labelled permitted English fallback.
No Dutch edition is inferred from a translated interface or a Dutch sales market.
Large-print Artemis, Dark Matter (Crouch), The Great Alone and Stranger in the Woods
are knowingly retained as print editions, not accidentally treated as normal-size editions.

Test catalogue
The user separately approved adding ONLY missing public records on hlvujbrmfdlrfxdjwsmb.
73 missing Works, 80 exact selected editions and 54 missing authors were inserted.
13 existing selected Works were reused read-only, with no edition additions/updates to them.
All pre-existing public catalogue rows outside this task’s reserved IDs retained their digests.
No ratings, users, reading statuses, traits, descriptions or taste inventory were copied/changed.
The repeated dry-run inserted nothing. test-receipt.json lists only newly added public IDs.
One candidate was replaced after approval (Girl with a Pearl Earring), so 73 rather than the
approved maximum of 74 missing Works were necessary.

Installation and recovery
test-dry-run.sql is deliberately rollback-only. The applied transaction differed only in its
final COMMIT, after an ACTIVE_HEALTHY/project-ID check and successful dry-run.
It checks the existing isolated Dune sentinel, exact identities and ID/ISBN/OLID collisions.
Unexpected values abort; there is no ON CONFLICT overwrite or UPDATE.
test-recovery.sql is also rollback-only and has NOT been executed. Review later dependencies
and identities first; any FK failure or changed metadata means STOP, not CASCADE.
Only change the final ROLLBACK to COMMIT after approving that exact recovery transaction.
Do not remove catalogue records while the review Preview still needs them.
Recovery now checks all relevant FK dependencies before deletion, including cascading ones;
it aborts on later dependent data, changed identities, or an unknown composite dependency.
Local PGlite recovery regression passed. No hosted recovery/delete was executed.

Preview-only mismatch retained intentionally:existing test Work8800309 (production197) has
Dutch edition614,ISBN9789024581269,nld,without OL edition identity/cover. NL safely shows its
neutral fallback. Production's reviewed English edition197,9780765350381,OL24945060M exists
on the same Work and works on EN test. No existing test metadata was overwritten.

Separate data gaps — no production corrections proposed for automatic execution
Work 2383 Contact: selected English edition has no positively bound cover; alternative used.
Work 1831 Shogun: selected Dutch edition lacks matching cover/title evidence; alternative used.
Work 2420 Girl with a Pearl Earring: selected edition lacks ISBN-13 for the existing reviewed
cover override mechanism; no relaxed identity condition was added, and another Work was chosen.
Works 304 Assassin’s Apprentice and 279 The Poppy War: selected English source editions are
e-books; not used in these new print-edition selections.
Work 8937 The Rage of Dragons: no positive cover for the selected edition; alternative used.
Numerous other familiar candidates have NULL edition language. None were made eligible by
title, script, ISBN prefix, author's reputation or presumed genre.

Release
No production database change is required for these selected identities as reviewed.
Code/assets only, subject to final hosted checks and a separate release approval.
Rollback the application to its preceding deployment if needed; no production SQL rollback.
Public covers are external resources: a successful check is not a permanent availability SLA.
