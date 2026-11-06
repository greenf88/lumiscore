# LumiScore SEO review — 6 November 2026

Base: `e973988753aa3f167e0904d6704197de008ade2d` (main and the production code used for the before comparison). Production deployment: `dpl_BZjzkVL1p1ubRhMAMbrDqJJMBT9E`. The source audit was captured at 13:45:30 UTC. Its inventory and Browse totals agree with the fresh read-only query and public sitemap capture; this does not imply that every live HTML response was unchanged.

## Sitemap and metadata

Production served one flat XML sitemap. A read-only comparison used every public Work, edition, collection slug and the complete public Browse result sets. The candidate runs the exact app selector against those rows. A compatible edition is the one the detail route can actually select for the requested locale. A neutral unavailable presentation or the presence of a different-language edition does not qualify. There is no current allowed cross-language fallback in the strict detail loader.

| Locale | Book URLs before | Eligible after | Removed: Work has no edition row | Removed: has editions, none selectable for this locale | Allowed fallbacks | Non-book URLs before / after |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| EN | 10,445 | 6,377 | 170 | 3,898 | 0 | 84 / 84 |
| NL | 10,445 | 3,346 | 170 | 6,929 | 0 | 84 / 84 |

The underlying dataset is 10,445 Works and 10,928 editions. The eligible detail and unfiltered Browse Work-ID sets were equal for each locale; this was a set comparison, not a comparison of totals alone. No newly introduced URLs. Work 1 is a valid language pair. Work 10471 keeps its Dutch canonical and its EN direct route remains available, but only the Dutch route is listed. Work 3 is another example of an EN route without a selectable EN edition. The original XML was 7,018,462 bytes; generated candidate XML was 1,024,265 bytes before compression. The generator uses bounded ordered REST pages, not a per-Work query, and returns 503 on read failure instead of publishing a partial result. Public cache directives are unchanged.

Sitemap exclusion does not change routing, robots or indexability. The production audit's 198 sampled HTML pages returned 200 with self-canonicals and index/follow. The fresh book recheck found zero redirects, errors, canonical mismatches or noindex responses across the 30 sampled URLs. No full crawl of all book routes was made; HTTP status, canonical and robots are not claimed as directly observed for every Work. Internal discovery is covered by the exact Browse membership and the sampled links, not by an exhaustive whole-site crawl. An eligible Work absent from the collected link sample is a discovery risk, not a confirmed orphan.

Only valid NL/EN detail pairs advertise hreflang. The two pages self-reference and reference each other, and EN remains x-default for the pair. Single-language Works do not emit an alternate set; their self-canonical remains in the original HTML head. Canonicals are independent of return-navigation parameters. The existing non-book alternates, Browse paging/index policy, direct detail availability and 404 rules remain intact.

## Book content

The original extractor counted status messages as synopsis words and read only the first description section. Rechecking all 30 complete original HTML responses and the public source endpoint identified eight summaries already in initial main HTML and two valid late summaries in streamed HTML. The ten sourced synopses have a median of 74 words (65–151). Seven source resolutions reported temporary failure and had no approved same-language stored description in the read-only storage check. The other 13 lacked a selectable edition in the requested locale; an empty description result there does not prove the Work lacks a source. All eight approved same-language texts for eligible sampled pages were rendered initially. Two other approved rows were Dutch texts for Works 3 and 4, whereas the sample requested their EN URLs. There was no demonstrated loss, language mismatch or erroneous truncation of a stored eligible synopsis, so no description-selection or content change is included. The 22 insufficient-rating findings remain informational and do not influence sitemap or robots policy.

[Per-URL recheck and next actions](seo-audit-2026-11-06-book-sample.tsv). For eligible temporarily failing routes, verify the exact ISBN and a publisher or trusted bibliographic source, and prepare reviewed content separately if warranted. For unavailable locales, establish edition eligibility first. No invented summaries or editorial imports are part of this PR.

## Review and rollback

No database migration, import or policy change; no production deployment or Search Console action. Release only after reviewing the original-response checks and the actual CI for the final PR head. In a later approved rollout, verify the deployment SHA and alias, then read the live XML and sample paired, single-locale, unavailable and missing detail routes in both browser and Googlebot simulations. Check Browse page 1 and successors. Roll back only this code change or return the alias to the previous known-good deployment; take sitemap CDN caching into account when checking the rollback.

Audit links: SEO-001 (locale eligibility and book content evidence), SEO-006 / DEV-010 (sitemap eligibility), SEO-007 (sampled discovery) and DEV-022 (regressions). No site-wide noindex rules, search ranking changes or unrelated audit backlog changes.

Method references: [Google: localized versions](https://developers.google.com/search/docs/specialty/international/localized-versions). Googlebot user agents are simulations. The HTML checks establish the response contract. Google processing is tracked separately.
