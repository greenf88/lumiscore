# Recommendation edition covers — 17 November 2026

The fresh public catalogue audit found 527 Dutch and 1,096 English selected editions without an initial cover URL, across 1,784 NL and 4,431 EN recommendation candidates. Some were previously recovered by a later visibility-triggered source request; these counts are not a count of observed broken images in every visitor session.

## Result

| Locale | Initial URL gaps | Exact-edition additions | Still unverified |
| --- | ---: | ---: | ---: |
| NL | 527 | 310 | 217 |
| EN | 1,096 | 844 | 252 |

The post-change catalogue read preserves all 6,215 candidate records, including their edition IDs, titles, authors, ISBNs, language, ordering, scores and metadata. Only `coverUrls` changes. Existing approved covers retain precedence. No database migration or rating, account, recommendation-ranking or selection mutation is involved.

The server-only evidence index adds 1,007 exact Open Library edition records. A separate server-only index adds 137 images linked to the exact Dutch ISBN edition at metadata.isbn.nl and 10 public Internet Archive cover thumbnails independently bound to edition, Work, ISBN and language. Only selected URLs reach the browser; source inventories are not client imports.

Older records that supply only ISBN-10 now qualify when their checksum is valid and conversion matches the selected ISBN-13. A conflicting explicit ISBN-13, title, Work, edition or language still rejects the image. The six additional older-edition matches include the Dutch Exorcist.

## Verification

- All 1,360 retained distinct image URLs returned HTTP 200, decoded as JPEG/PNG/WebP and met a minimum 90 × 120 pixel threshold. One other URL repeatedly returned 503 and was not retained; its edition has another verified image.
- Exact edition metadata and image hashes, dimensions and timestamps are recorded in `audit.json`, together with every unresolved candidate. No full publisher descriptions or cover binaries are committed.
- Visual review includes both Exorcist editions, The Lost Symbol, representative Dutch registry editions and all twelve matching public archive thumbnails (two overlap stronger sources and are not needed).
- Nineteen targeted tests cover both catalogues, all reviewed mappings, identity boundaries, existing-cover precedence, malformed provider data and ISBN-10 checksums/conflicts. Typecheck and targeted lint pass.
- Four synthetic public guest profiles (NL/EN, thriller/fantasy) provide before/after production checks without writing public ratings or real account data. Final live verification is recorded separately after rollout.

## Limits and rollback

The remaining 469 editions have absent or conflicting source metadata/images. They remain eligible recommendations with the neutral fallback; no cover is borrowed across language or edition, and books are not hidden to improve the count. Public Google Books lookup returned a quota-zero 429 and was not bypassed. Original database records remain unchanged. Revert this commit to remove this release's evidence and ISBN-10 resolver change.

Sources: Open Library exact edition JSON and [Covers API](https://openlibrary.org/dev/docs/api/covers); [Dutch ISBN registry](https://metadata.isbn.nl/); Internet Archive public item metadata and listed public cover thumbnails. Per-edition source URLs are in `audit.json`.
