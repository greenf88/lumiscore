# Historical catalog test contracts

These are read-only public bibliographic/review contract projections, NOT live
production database fixtures, executable importer plans or new source verification.
No production database export, user row, credential or protected baseline was copied.
The source artifacts and their generators were already available locally from the
original V1 reviews. They were inspected read-only, not regenerated against production.
Neither original file ever existed in the reachable Git history.

## Why projections, not invented synthetic evidence

The tests added in `0fa25cff7b751903bd26bb2eaaa091f1be05ba4b`
(collections) and `169e0ecd6090f2f7fb2f31bf93b0c08965f60070` (Option B)
deliberately freeze review counts/identities. Arbitrary synthetic substitutes would
not prove those contracts. Every original assertion and expected value is retained.
Only test input locations change. These projections preserve the historical review
facts those tests consume, excluding unrelated operational/protected metadata.

| Contract | Historical source | Source timestamp | Source byte SHA-256 |
| --- | --- | --- | --- |
| Collections | `collection-v1-quality-audit.json` (58,160 bytes) | 2026-09-17T22:55:20.922Z | `f4afe11d63e6f5c1ff9e13515fe72666af6747212876ce259aaf9bd4207aab49` |
| Option B | `catalog-expansion-trait-enrichment-option-b-write-plan.json` (6,995 bytes) | 2026-09-16T18:02:57.461Z | `3aff38e83dadf41fa9ee4a9f3b40a3dcdb393830d6343d45534ed9a3e62a4c2c` |

Source hashes identify historical artifacts, not secret material. They do not
claim that those historical reviews are current or independently reverified.

## Deterministic projection rules

`collection-v1-quality.contract.json` (12,160 bytes): preserve `productionWrites`;
four tested counts (`collections`, `seriesCollections`, `memberships`,
`missingPublishedBooks`); all 59 public review entries projected to `slug`, `type`,
`positions`, `currentPublishedMainSeriesTotal`, `missingPositions`, `classification`;
all 31 gap references projected to `collectionSlug`, `position`, `title`; and
`writeGate.passed`. Discard database IDs, matching database rows, protected table
fingerprints, embedded research records and unrelated audit sections. The original
write gate is false. This is the pre-completion review, not the later frozen plan.
The three final-plan tests still read the existing tracked final release plan.

`catalog-expansion-option-b.contract.json` (5,255 bytes): preserve `mode`,
`explicitlyUnusedPlan`, scope `rowCount`/`targetWorkIds`, **all five original reviewed
rows including their exact public ISBN/Edition/Work provenance**, and `rowsSha256`.
Discard pre-write database observations, writable table/production count fields and
unrelated policy/review metadata. Retained historical Work IDs are the already
asserted release identity references, not newly exported production rows. Do not
reinterpret the historical nonfiction decision as a new independent classification.

Both envelopes identify `fixtureKind=historical-public-review-contract`,
`productionExecution=false`, source filename/hash/date. JSON is UTF-8 without BOM,
compact `JSON.stringify` in the projection's insertion order, followed by one LF.
The original Option B canonical rows hash is independently pinned in its test:
`eaab592ae6079a10fcc3a8d1f5895299fad31e20d469344746d88d72c05bf192`.
It was recomputed using the original generator/test canonical key ordering before
the projection was accepted. The original generator also verifies the five exact
ISBNs, matching normal editions/parent Works and reviewed Google Books evidence.

No credentials or legacy audit files are needed at test time; no generator reaches
the network. Both fixture byte hashes are independently pinned in the tests.
`.gitattributes` marks only these contracts `-text`, preserving hashes under both
`core.autocrlf=true` and `false`. Input paths are relative to `import.meta.url`, not
the caller's working directory. The checkout regression also runs the seven
original tests from an unrelated directory with database/source credentials removed.

Run `pnpm test:fixture-contracts` (8 tests), or `pnpm test:unit` for all repository
unit/contract tests. Changing a frozen fact requires an explicit reviewed contract
revision and provenance update, not automatic hash/expectation replacement.
