# Dutch reading-list completion — 16 November 2026

Eleven routes now have all 125 selections backed by Dutch editions: ten routes with ten books and the 25-book fantasy/science-fiction route. The existing complete dystopia route remains a regression check. Fourteen untranslated or not-yet-published original candidates are replaced on the Dutch routes by suitable existing works; the English selections remain unchanged.

The reviewed batch adds 55 editions and 57 original Dutch summaries, completes 60 exact-ISBN cover bindings, and corrects the original publication year of *Aanpakken!* to 2005. Individual Dutch ebooks are explicitly labelled in the reading guidance. Older editions are not represented as guaranteed current retail stock.

Each edition record contains bibliographic sources, work/author identity, format, and the SHA-256 of a downloaded and visually inspected cover. Query-free cover URLs were accepted only after their bytes matched the observed source image. Existing approved descriptions are retained. Existing metadata receives a cover only when its entire before-image still matches.

`apply.sql` is an atomic, guarded data operation, separate from deployment. A rollback-only execution was checked against production before applying. `rollback.sql` is an emergency inverse; it checks the batch and exact identities and will fail if later dependencies prevent deletion. It is not part of deployment.

Validation covers source identities across environments, locale-specific substitutions, full rendered counts and links, partial availability, structured data, content-bound sitemap dates, mobile grid rules, and all pre-existing quality checks. Public live checks after release cover every Dutch list and the affected book pages.
