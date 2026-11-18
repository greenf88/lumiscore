# Remaining cover recovery: 18 November 2026

The input is the 217 Work/language pairs left by the previous 469-cover audit. All 23 edition/source conflicts were examined first. The reviewed proposal restores 130 fronts (83 Dutch, 47 English), including four verified alternative English editions. Images were downloaded, checked for valid raster dimensions and visually reviewed against the ISBN source. Interior pages, multilingual substitutes and prepublication placeholders are excluded.

Eight edition language labels are corrected from explicit bibliographic evidence, including one additional Latin/English parallel edition found during image review. This is a metadata repair, not a recovered cover. Martin Heylen and Lisa Goudsmit receive their own author identities; the subject/designers are not globally renamed. The isolated Bart/Bert Nederlof typo, two truncated/wrong titles and four missing volume labels are corrected.

`conflicts.json` records all 23 conflict decisions. `audit.json` retains every original input that has not received a verified cover; there are 87 such pairs in this proposal. Seven of these have a wrong original language classification. Do not report their exclusion as recovered covers. The four alternative editions retain the originals and use the existing per-language preferred-edition mechanism. The review does not modify scores, ratings, user lists, collections or recommendation algorithms.

Public bibliographic sources include the ISBN publisher registry, publisher catalogues, public Google Books volume records, NetGalley, institutional catalogues and exact-ISBN bookseller records. Source and image hashes are in `proposal.json`; source downloads and contact sheets are in the local audit directory. A generic title/author match is insufficient when an ISBN, volume or language conflicts.

## Apply and rollback

`production.sql` and `rollback.sql` default to ROLLBACK. Both use a transaction and compare-and-swap guards. Apply checks the complete affected Work/edition snapshot and refuses shared author renames, competing reviews and conflicting identifiers. Replace only the final ROLLBACK with COMMIT after reviewing the dry-run receipt. Never reapply this batch over changed catalogue rows. Rollback refuses newer edits and removes only this batch's reviews and newly inserted editions. It retains newly created author identities rather than deleting potentially shared author records.

Regenerate the SQL with `node scripts/build-remaining-cover-conflicts.mjs`. Run `node --experimental-strip-types --test scripts/remaining-cover-conflicts.test.mjs`. The PGlite tests exercise the actual strict edition selector, SQL search selector and stored presentation binding for every proposal, atomic drift rejection, dry run and guarded rollback, with user ratings and lists preserved.

Local tests passed; the production dry run returned all 130 intended ISBN-bound reviews. Production application and mobile verification are recorded separately after execution.
