# Three remaining English taste-test covers

The user authorized another verified English edition for the three remaining starter books without covers. Three publisher-primary paperback editions were added to production on 2026-11-17. No application code or ranking rules changed.

| Work | English edition | ISBN-13 | New edition ID |
| --- | --- | --- | --- |
| 68 | Love in the Time of Cholera — Vintage | 9780307389732 | 11248 |
| 376 | For Whom the Bell Tolls — Vintage Classics | 9780099289821 | 11249 |
| 596 | Eye of the Needle — Penguin Books | 9780143132042 | 11250 |

Each official publisher page links the exact-ISBN jacket. The jacket was downloaded and visually checked for the English title and author. Independent Open Library ISBN records confirm the canonical Work, author and language. Publisher reissue metadata takes precedence over Open Library's sometimes older reprint metadata; these ISBN editions therefore have no Open Library edition key. The existing older editions remain unchanged.

`proposal.json` records the source URLs, hashes and identity checks; `sources/*-isbn.json` preserves the independent ISBN evidence. Downloaded publisher HTML and jackets are local audit artifacts excluded from Git. `baseline.json` and `production-receipt.json` capture the exact rows before and after the additions. The approved cover metadata is bound to the new edition, author, language and ISBN. It cannot be attached to the old editions.

`production.sql` defaults to a transaction rollback. It checks the unchanged baseline, ISBN conflicts, identity-sequence state, all-or-nothing additions, and selection by the current SQL search function. A production rollback rehearsal passed before commit. Repeating the committed operation is a no-op; it rejects a partial pre-existing state. No existing editions, Dutch presentation, Works, ratings or lists were modified.

Validation: `node --experimental-strip-types --test scripts/three-english-covers.test.mjs` passes three PostgreSQL-backed tests covering dry run, commit, repeat, atomic conflict rejection, preservation of existing data, NL/EN selection parity, and exact-edition cover binding. The production search function snapshot is test-only reference material, not a migration.

Live mobile and public-loader verification are recorded separately after publication. This closes the three known English starter gaps; it is not a claim of complete coverage for the entire catalogue.
