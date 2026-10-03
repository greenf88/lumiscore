# +5134 selection policy (fixed before fresh discovery)

User supersedes the requested +5000 size with exactly **5134 net-new Works**.
Preparation only: no production import, migration, merge or production deployment.
Fresh base: `ebb6bf03066c446d73b13a56c21ff26047737707`.

Re-use reviewed unused reserves and previously cached discovery first, excluding
all current production identities/ISBNs/translated titles/aliases. Bounded fresh
Search queries fill gaps, not individual-book harvesting. Verify all source facts
offline against the already-downloaded complete official 2026-09-30 dumps.
No paid sources, new accounts, HTML scraping or bulk cover downloads.

Priorities, in deterministic order:

1. Proved missing series titles and named NL/Flemish author gaps.
2. Dutch Editions: aim for 1500, subject to source-identity quality.
3. Broad non-fiction discovery: aim for 1800 across biography, history, science,
   psychology, society and economics, with Dutch-language lanes also represented.
4. International general fiction and remaining broad lanes.
5. Specialist speculative/thriller/dystopia discovery never above 750 combined;
   the user's personal genre preference is not the platform selection boundary.

Search `want_to_read` order is a popularity proxy, not measured search demand.
Within a priority use source rank, then source Work ID. Retain old and recent
source-publication years; do not invent first-edition accuracy. Report resulting
language, period and discovery-lane distribution and any actual coverage gap.
Dutch Edition language does not prove original language or writer nationality.

At most 120 sequential new batch Search requests, >=1100ms start spacing.
Cached identical requests never count as new or get requested again. Query lanes
and page caps are recorded by the discovery script; no distributed requests.
Source policy: https://openlibrary.org/developers/api ; dump policy:
https://openlibrary.org/developers/dumps . Use dumps for bulk metadata verification.

Accept one unique print ISBN Edition with one exact parent Work and one author.
Allow missing Edition authors only from a hashed, matching single-parent Work
record, as already reviewed. Reject contradictory authors, bundles, composites,
derivatives, ambiguous author IDs and any existing Work/Edition/ISBN/title/alias.
Known earlier quarantines remain excluded. Native candidates without the existing
strong identity route remain out. Report a real deficit instead of loosening rules.

Final input exactly 5134, one new batch selection, 5134 memberships and private
provenance rows. Calculate actual Editions/Authors from input and the fresh plan.
All categories, traits and Collection links empty; classification/original-language/
nationality unknown unless separately established. Series hints stay separate.
Cover metadata is not HTTP/image-quality proof. Reserves are not import actions.
