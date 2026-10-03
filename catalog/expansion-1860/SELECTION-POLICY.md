# +1860 selection policy — fixed before collecting new source results

Base: `22aae6dc720e5c79cc50aea9a6661166faf8cbd7`. Required net-new Works: 1860.
No production writes, migrations, main merge or deployment are authorized.

Priority order: existing named NL/Flemish search gaps and reviewed backlog;
verified missing series titles; NL-language discovery; internationally popular
general fiction and non-fiction; balanced speculative/crime discovery. A translated
Dutch Edition is not evidence of a Dutch/Flemish author or original Work.

Reproducible discovery lanes use Open Library `want_to_read` ordering, 500 results
per page, with page/position/Work ID tie-breaks. Subject hints are source discovery
metadata only, not editorial classification and never category writes.
Before final selection a named-author gap lane uses one NL query for the following
existing backlog authors: Tommy Wieringa, Herman Koch, Hugo Claus, Annelies Verbeke,
Bart Moeyaert, Lize Spit, Griet Op de Beeck, Dimitri Verhulst, Tom Lanoye, Stefan
Hertmans, Jeroen Olyslaegers, Jeroen Brouwers, Harry Mulisch, Hella S. Haasse,
Willem Frederik Hermans, Gerard Reve, Cees Nooteboom, Arnon Grunberg, Arthur Japin,
Connie Palmen, Anjet Daanje, Kader Abdolah, Murat Isik, Anna Woltz, Annet Schaap,
Tonke Dragt, Guus Kuijer, Jan Wolkers, Adriaan van Dis, Geert Mak, Frank Westerman,
Joris Luyendijk, Esther Verhoef, Saskia Noort, Simone van der Vlugt, Thomas Olde
Heuvelt. This is a priority list, not independently proven nationality/original
language metadata. Keep uncertain origin fields UNKNOWN.

Other pages: NL fiction 1–3; NL history 1; EN general fiction 1–4; EN biography,
history, science and psychology 1–2; EN society and economics 1; EN fantasy,
science fiction, thriller and dystopia 1. Total: exactly 23 Search requests,
with cache reuse (the 22 general-lane responses already obtained are not refetched).
NL-language lanes precede general fiction, biography, history, science, psychology,
society and economics; fantasy/SF/thriller/dystopia do not dominate the total.
No invented search-volume metrics; source want-to-read is only a popularity proxy.

Prefer up to 400 verified NL-language candidates and at least 500 non-fiction
discovery candidates when available. Remaining slots use deterministic lane rank;
specialist fantasy/SF/thriller/dystopia lanes together are capped at 500. If evidence
cannot support coverage, report the shortfall rather than silently claim it.
Reserve maximum: 100 independently validated, unused Works.

Controlled contingency decided before the additional response: if verified reserves
cannot replace production identity conflicts, use only the remaining 24th request
for EN general-fiction page 5. Reuse both downloaded official dumps and rescan
locally for its keys; do not increase the request cap or loosen evidence rules.

Reuse cached minimal public proofs first. Network discovery has a hard cap of 24
sequential batch Search requests, >=1100ms start spacing, stop on 429/5xx/timeouts;
no individual book/author API harvesting, HTML scraping, paid sources or accounts.
For new ISBN/Edition/parent verification use the official monthly Edition dump,
not bulk API metadata retrieval. Verify its advertised size/SHA-1 plus local
SHA-256; keep raw downloads ignored and outside published input. Freeze exact
minimal source records and their hashes, dump name/revision and source URLs.
When an Edition omits its authors, independently bind its single parent to the
same-month official Work dump, with matching canonical title and exactly one
author key. Retain both minimal records and source hashes; never invent an author
or accept contradictory explicit Edition authors. Missing ISBNs remain excluded.

Each selected identity needs one checksum-valid ISBN, exact Edition key, single
parent Work, matching source author and normal print form/page metadata. Compare
all available ISBNs, original and chosen Edition titles and author identities
against a fresh read-only production snapshot and aliases. Reject uncertainties,
omnibus/boxed sets, adaptations, duplicate translations and author collisions.

No genres or Collection memberships are imported. Record possible series links
separately for later review. Classifications, original language, period and cover
availability must distinguish supported facts from unknowns. No live cover bulk
downloads: dump cover metadata is availability evidence, not HTTP/quality proof.
