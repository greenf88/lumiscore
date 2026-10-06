# Personal taste results

## Scope and dependency

This review branch is stacked on Draft PR #9, at b757e747f4ef7d4a486db4f30aa5393db8775f50. Main was freshly fetched at 02a5d9073d1c93914018945f38c9dbb9d1fd675a. Neither branch may be merged or deployed by this task. Boekmatch will be separately reviewable and disabled outside development/Preview.

## Rules fixed before implementation

Only explicit integer ratings 1–10 contribute. Each distinct Work contributes once. The signed preference is (rating − 5.5) / 4.5: low scores reduce affinity, high scores increase it. Old valid ratings contribute to the total profile, never to a new round's answer count.

Use only the existing taste_traits_v1 evidence with a per-trait confidence of at least 0.6, or the existing explicitly reviewed corrections. No title, author, cover, pilot classification or candidate inference is allowed. Within a book, divide positive trait weights by their sum, so a multi-label book has a total evidence mass of one, not several books. For each trait, sum signed preferences times evidence mass. Affinity = round(50 + 50 × signed sum / (evidence mass + 3)). The three neutral prior books shrink sparse evidence towards 50. Scores are affinities, not probabilities or a distribution summing to 100.

A numeric affinity requires at least three distinct supporting Works. Otherwise show insufficient information, not a percentage. Confidence remains provisional below ten classified rated Works; classify at least half the valid rated Works before labelling an archetype. An archetype additionally requires at least five classified rated Works, three positive ratings (7+) supporting its defining trait, and affinity at least 60. Highest qualifying affinity wins deterministically: fantasy → Wereldbouwer/Worldbuilder; thriller_mystery → Speurneus/Sleuth; science_fiction → Ontdekkingsreiziger/Explorer; romance → Verhalenverbinder/Story connector. No Time traveller archetype is inferred from publication year.

Genre, narrative/style and publication era are separate facets. The current approved evidence has no reliable history/war topic or audience dimensions: show this gap explicitly, do not manufacture scores. Classic/contemporary denote publication era, not historical subject matter. Missing classification is counted and disclosed, not treated as a dislike.

Use the same shrunk signed profile for result recommendations. Exclude rated/read Works and require an available Edition in the chosen round language. Rank the weighted signed overlap, with a small existing aggregate-quality tie-breaker and stable ID tie-break. A concrete reason names only a reliable candidate trait with three supporting rated Works and positive profile evidence; otherwise label the suggestion exploratory. Do not display numeric match probabilities. Return at most twenty unique book cards to the browser; keep the candidate catalog and raw ratings server-side, with private no-store responses.

## Round compatibility

New rounds offer 10, 15 or 30 ratings. Existing rounds retain their default goal of 20 and their identifiers, offers, scores and completion status. Results are available at ten new answers, after an older completed twenty-rating round, or as an honest partial result on exhaustion. An explicit extension raises a 10/15 target to 15/30; it does not invent answers, reset offers or change completed legacy twenty-rating rounds. Skips never count. Retried actions preserve original ratings and a per-user transaction lock serializes advances.

## Empty recommendations investigation

No screenshot was attached with this request. Source inspection confirms that the old completed-round UI only links to /recommendations, with no inline result cards. loadHomepagePersonalization also catches every server failure and returns an unauthenticated empty list, concealing a loading failure. The new result endpoint will distinguish authentication, failure, no classified evidence, no candidates and a partial set. The legacy overview will receive an explicit unavailable status as a narrow correction. An exact screenshot diagnosis remains unverified.

## Verification and recovery boundaries

Use only disposable local databases or synthetic project hlvujbrmfdlrfxdjwsmb. Preserve old migration bytes/history and add a forward migration with explicit PUBLIC/anon revokes. Verify actual effective function privileges, anonymous denial, authenticated success, two-reader RLS, saved ratings and the legacy twenty-round contract. No production SQL, imports, accounts or ratings. Application rollback must preserve new goal values, ratings, offers and progress; retain the forward migration and do not run a destructive down migration. A separate release review must approve hashes and deployment after all gates pass.
