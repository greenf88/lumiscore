# GSC URL cleanup, 18 November 2026

Fresh Search Console access confirmed the report remains dated 13 November. All four soft-404 examples, both Google-selected canonical conflicts, all 166 unspecified-canonical examples, 580 redirects, 61 robots exclusions and 35 noindex examples were inspected, along with the 1,000 examples exposed by each of the crawled/discovered reports. These are samples of the two larger groups, not the entire 12,061/3,160 URL populations.

The public HTTP audit covered 2,849 distinct URLs. All requests ended in HTTP 200: 676 followed redirects and 728 final responses deliberately used noindex. No broken redirect chain, unexpected canonical or noindex URL in the existing sitemap was found. The robots examples are login routes; their exclusion remains deliberate. Existing book records were checked against the public production catalogue. No sampled book was proven deleted, so no book was retired, redirected to an unrelated book, or removed from the catalogue.

The four old soft-404 examples now behave as follows:

- `/book/9733`, `/book/4873`, `/book/8?returnTo=/` redirect once to their full English book pages, with meaningful descriptions and query-free canonical URLs. The return route remains usable.
- `/en/book/1219` (KliFi) remains accessible with noindex and is absent from the English sitemap because no verified English edition exists. Its Dutch book remains intact.

`/en/book/4884` and `/en/book/8856` have one self canonical, while `/book/4884` and `/book/8856` permanently redirect to them. Search Console still records earlier crawl decisions. Soft-404 validation was started on 18 November; final validation results depend on Google recrawling.

## Confirmed change

The sitemap matched its existing generator but the generator advertised six empty collection translations. These contained no eligible books and no original editorial guide:

- NL: `the-locked-tomb`, `the-stormlight-archive`, `the-poppy-war`, `once-upon-a-broken-heart-companions`.
- EN: `geef-me-de-ruimte`, `kinderen-van-moeder-aarde`.

Shared collection eligibility now requires at least one eligible book in that language or an editorial guide. Empty translations remain HTTP 200 for existing readers/progress, with noindex and no canonical; they leave the sitemap and reciprocal hreflang sets. When eligible editions arrive, they automatically become indexable again. Substantive editorial guides can remain indexable without cards. Missing covers, scores and Google indexing status never enter the selection rule.

Public catalogue reads paginate memberships deterministically and use the existing strict edition selector. Read failures throw or return the sitemap's existing 503 rather than silently publishing an empty sitemap. No database, rating, list or reading-progress writes are involved.

Expected sitemap change: pages 170 → 164; English books remain 6,373 and Dutch books 3,414; total 9,957 → 9,951. This is a six-URL policy correction, not a claim that thousands of GSC exclusions have disappeared.

## Verification

- Twenty targeted sitemap, collection-eligibility, legacy-redirect and book-lifecycle tests passed, including automatic restoration when an edition is added and preservation of editorial guides.
- Type checking and targeted lint passed.
- Full CI and post-release verification are recorded in the pull request and local `seo-audit-20261118/url-cleanup` evidence folder. Do not infer Google validation success from live HTML checks alone.

The replayable `scripts/audit-gsc-url-cleanup.mjs` uses only public catalogue reads and saves no keys or reader data. GSC DOM exports and the public HTTP audit are stored in the local audit folder; account UI snapshots are not committed.
