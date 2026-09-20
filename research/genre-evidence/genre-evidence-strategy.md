# LumiScore genre evidence strategy (read-only research)

Status: **research proposal only**. No classification in this folder is approved for production and no database write is performed by the POC.

## Decision summary

Thema 1.6 is suitable as LumiScore's internal subject backbone, while a smaller 16-category LumiScore layer remains the reader-facing browse vocabulary. Store the most specific source Thema code(s), the publisher-declared main subject and qualifiers; derive the broad browse label. Never store both a detailed code and its ancestor. Audience, format, publication period, story period and recommendation traits remain separate.

The best evidence hierarchy is:

1. exact-ISBN publisher ONIX 3 with publisher-declared Thema main/additional subjects, under a contract that permits the intended use;
2. exact-identifier national bibliography metadata (especially KB NBT for Dutch editions), with dataset-specific reuse terms verified;
3. agreement between exact-ID Wikidata, exact-ISBN Google Books and normalized Open Library dump evidence;
4. one supporting source alone goes to review; title-only matching is never accepted.

## Source comparison

| Source | Role | Quality | NL/Flanders | International | Level / identity | Licence, cost and access | Recommended use / risk |
|---|---|---|---|---|---|---|---|
| Publisher ONIX + Thema | Primary | Highest when maintained by publisher | Strong through CB and Meta4books | Strong where feeds exist | Edition/product; exact ISBN, later reconciled to Work | Contract/feed required; pricing not public and must be quoted; ONIX 3 bulk/update feeds | Primary decision source. Edition disagreement and publisher marketing miscoding still require checks. |
| Thema 1.6 vocabulary | Taxonomy backbone, not book evidence | Controlled, hierarchical and multilingual | Official Dutch and Flemish labels exist | Designed internationally | Taxon, not Work/Edition identity | Browser/download publicly available; copyright/reuse terms must be confirmed with EDItEUR before redistributing a local full code list | Use codes and hierarchy internally after licence confirmation; map to reader labels. |
| KB Nederlandse Bibliografie / NBT | Primary-supporting | Professionally catalogued | Strong Netherlands; weaker newest-title freshness is disclosed | Limited | Edition/title record; exact bibliographic identifiers | NBT linked open data advertised under a free licence; other datasets may require a request/contract | Pilot exact-ISBN subject coverage and licence fields before ingestion. |
| Meta4books / Boekenbank | Primary commercial | Publisher-supplied ONIX including Thema | Strong Flanders and Dutch-market ISBNs; >1.8m ISBNs claimed | Foreign market titles included | Edition/product; ISBN | REST Products API returns ONIX 3; demo/membership and quote required | Best Flemish/Dutch commercial candidate; obtain quote and permitted caching/display terms. |
| CB | Primary commercial | Publisher-supplied Thema/NUR/BISAC/keywords | Strong Netherlands | Foreign titles also present | Edition/product; ISBN | CB Online/webservices/ONIX access is account/product specific; no free bulk entitlement established | Request startup quote and rights for subject caching; do not scrape CB Online. |
| Wikidata | Supporting | Variable but inspectable | Uneven | Broad long tail | Often Work or Edition; exact ISBN/Open Library ID required | Structured data CC0; SPARQL, API and dumps; shared endpoint limits | Corroboration and discovery. Inspect entity modelling; never link by approximate title. |
| Google Books | Supporting | Categories can be useful but broad/inconsistent | Moderate, edition dependent | Broad | Volume/Edition; exact returned ISBN-13 | Public read API; key/quota terms apply; bounded cached calls | Accept categories only after exact ISBN-13 validation; never primary alone. |
| Open Library | Supporting | Large but noisy/community-sourced | Uneven | Broad | Work plus Editions; stored OL IDs | Monthly dumps are intended for bulk; low-volume API is not a third-party bulk backend | Normalize dump subjects, retain provenance, reward cross-edition agreement, route compound/noisy labels to review. |
| Library of Congress | Supporting | Controlled headings, strong for US holdings | Low-to-moderate | Strong US/international | Bibliographic record; ISBN/LCCN | loc.gov API is limited to digital items; MARC open dataset and linked-data services are the bulk paths; dataset-specific terms | Useful corroboration for exact identifiers, not a Dutch primary source. |
| Official publisher/author page | Manual supporting | Potentially authoritative | Variable | Variable | Edition/Work; ISBN or explicit edition required | Page-specific copyright and robots/terms; no copied protected description | Human review evidence only unless a licensed structured feed exists. |

Excluded: Goodreads/Amazon scraping, hidden APIs, copied protected descriptions, fuzzy title-only identity and per-render external lookups.

## Thema operating rules

- one main subject; usually no more than three or four subject codes;
- additional codes only when they materially describe the whole book;
- keep the most specific descendant, not its ancestor too;
- subjects A–Y and qualifiers 1–6 are separate; qualifiers never stand alone;
- Children/Teenage uses a Y code as main subject and an age qualifier where required;
- the Thema time qualifier is story/content period, never original publication year;
- a publisher code is source evidence, not an automatically accepted truth.

The proposed 16-category mapping is in `thema-lumiscore-mapping.json`. Broad prefixes marked `deterministic: false` need a specific-code mapping or human review; a whole top-level family is too broad for a single consumer category.

## 200-Work proof of concept

The reproducible script performs paginated/batched read-only catalog and evidence queries, then bounded exact-ISBN Wikidata SPARQL queries. It writes a controlled summary, not raw external bulk caches. Selection contains 20 Suzanne Vermeer, 35 Dutch-market, 10 exact-ISBN Google-evidence, 25 classics, 25 nonfiction, 20 YA/children, 20 polluted/conflicting-subject, 25 legacy-gap and 20 international-fiction Works.

Result:

| Outcome | Count | Meaning in this POC |
|---|---:|---|
| HIGH | 101 | At least two independent usable content signals agreed sufficiently for a proposal. Still not production-approved. |
| REVIEW | 46 | One plausible content source, or missing corroboration. |
| REJECT | 53 | No trustworthy genre/content signal from connected sources. |

Coverage observations:

- 110/200 sampled Works had usable stored Open Library content labels;
- 10/200 had existing exact-ISBN Google Books category evidence;
- 198/200 had an ISBN-13;
- all four bounded Wikidata ISBN batches completed, but returned 0 exact P212 matches for this sample; therefore Wikidata is not a dependable ISBN genre backbone here;
- no licensed ONIX/Thema feed was connected, so publisher Thema was correctly recorded as unavailable, not as negative evidence;
- official publisher pages were not scraped or manually guessed.

The 101 HIGH results demonstrate that existing corroborated evidence can help; they do **not** prove catalog-wide quality. The 49.5% REVIEW/REJECT share shows that a publisher/national-bibliography feed materially changes feasibility.

## Classification architecture for a later migration

Minimal future model (not implemented now):

`work_classification_evidence`

- `id bigint generated always as identity primary key`
- `work_id bigint references works(id) on delete cascade`
- `dimension text` constrained to genre, subgenre, fiction_status, audience, format, story_period
- `taxon_system text` (for example `thema-1.6`, `lumiscore-browse-v1`)
- `taxon_code text`
- `taxon_label text`
- `is_primary boolean`
- `source_type text`
- `source_identifier text`
- `source_value text`
- `confidence numeric`
- `method text`
- `review_status text` (`pending`, `approved`, `rejected`)
- `evidence_note text`
- `reviewed_at timestamptz null`
- `reviewed_by uuid null` (private operational field)
- `created_at`, `updated_at`
- unique evidence identity across work, dimension, taxon, source and source identifier

Keep `works.first_publish_year` outside this table. A separate approved mapping table/version can derive browse categories from source taxons. Recommendation traits remain in `work_trait_evidence` and are not genre facts.

## Scale, review and cost

The POC implies about 49.5% manual review without a primary feed: roughly 1,258 of 2,541 current Works and 2,743 of 5,541 Works. At an explicit planning assumption of 3–6 minutes per reviewed Work, that is 63–126 hours now and 137–274 hours at 5,541 Works. At €35–€60/hour, the review-only planning ranges are about €2.2k–€7.6k and €4.8k–€16.5k respectively. These are estimates, not supplier quotes.

CB and Meta4books prices and reuse rights require a quote. A paid feed is economically sensible if its annual fee plus integration is below the avoided review cost and exact-ISBN Thema coverage is proven on a representative trial. Request a 200–500 ISBN evaluation export before contracting.

## Direct answers

1. **Can Thema be the internal standard?** Yes, after confirming code-list reuse terms; it is the best semantic backbone.
2. **Where do per-book Thema codes come from?** Publisher ONIX via CB/Meta4books or another licensed aggregator, not from the vocabulary itself.
3. **Best Dutch coverage?** CB/Meta4books publisher metadata plus KB NBT; test overlap and freshness.
4. **Highest accuracy combination?** Publisher Thema primary, national bibliography validation, then two-source supporting corroboration.
5. **POC outcomes?** 101 HIGH, 46 REVIEW, 53 REJECT.
6. **Manual review for 2,541?** Approximately 1,258 without a primary feed; measure again after a feed pilot.
7. **Cost for 5,541?** Estimated review labour €4.8k–€16.5k plus unknown feed/integration costs.
8. **Conflict authority?** Reviewed current publisher Thema for the exact edition, unless national-bibliography evidence or obvious miscoding triggers review.
9. **Deterministic mappings?** Specific stable Thema leaves to broad LumiScore categories; never whole ambiguous top-level families.
10. **Mandatory human review?** Cross-source conflicts, adult versus juvenile ambiguity, compound/noisy subjects, Work/Edition mismatch, and any identity below exact external ID/ISBN.
11. **Paid feed economical?** Potentially yes; only after quote, rights review and a representative coverage trial.
12. **Minimal later schema?** One provenance-first multi-row evidence table plus versioned mapping; no single genre column.

## Reproduction

```powershell
node --env-file=<local-server-env> --experimental-strip-types scripts/research-genre-evidence-poc.ts
```

The script requires only the public Supabase URL/publishable key for RLS-readable catalog evidence. It has no write calls. External matching is exact ISBN; failed external queries are not negative evidence.

## Source record

- EDItEUR Thema 1.6 browser and golden rules: https://ns.editeur.org/thema/en
- Meta4books Thema guidance: https://www.meta4books.be/thema
- Meta4books data API: https://www.meta4books.be/boekendata-afnemen
- CB Thema/ONIX documentation: https://servicemedia.cb.nl/hc/nl/articles/50171322220177-Wat-is-Thema-en-wat-kun-je-ermee and https://servicemedia.cb.nl/hc/nl/articles/5136176120593-Wat-is-ONIX-en-wat-kan-ik-ermee-als-boekverkoper
- KB Nederlandse Bibliografie and data services: https://www.kb.nl/over-ons/diensten/de-nederlandse-bibliografie and https://www.kb.nl/onderzoeken-vinden/voor-onderzoekers/dataservices-apis-en-downloads
- Wikidata CC0 and dumps: https://www.wikidata.org/wiki/Wikidata:Licensing and https://www.wikidata.org/wiki/Wikidata:Database_download
- Google Books Volume API: https://developers.google.com/books/docs/v1/reference/volumes
- Open Library API/bulk guidance: https://openlibrary.org/developers/api and https://openlibrary.org/developers/dumps
- Library of Congress APIs: https://www.loc.gov/apis/
