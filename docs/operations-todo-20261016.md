# LumiScore — automation implementation checklist

Scope: LumiScore only. Owner of automated work: LumiScore Automation, GitHub publication through greenf88 explicitly allowed from 17 October; never Rick's
personal LinkedIn/social/email identity. This list tracks this workstream, not the full
historical LumiScore Master To-do.

- [x] Inspect current code, database aggregates and available integrations.
- [x] Establish a private production baseline without exporting reader records.
- [x] Distinguish failed cover sources from Works with no resolved cache source.
- [x] Build SELECT-only snapshot SQL and an exception-report processor.
- [x] Implement stable finding keys, deduplication, resolution and reopening.
- [x] Add regression tests for invalid input, lifecycle and collection semantics.
- [x] Prepare credential-free CI workflow with pinned actions.
- [x] Implement public NL/EN HTTP/SEO smoke checks.
- [x] Select 100 pilot Works: 80 gaps, 19 controls and contradictory Work 276.
- [x] Run local validation; 10 new tests pass, TypeScript/lint/both builds pass. Full suite retains the same 15 failures and 14 skips as unmodified main.
- [x] Recheck 24 exact cover lookups; 2 resolved cache recoveries verified.
- [ ] Investigate the remaining 22 Works without a resolved cache source.
- [x] Collect all 100 exact-Work source records; 78 contain descriptions.
- [x] Assess all 100: 62 proposals, 38 abstentions; exact evidence snippets structurally checked, no production activation.
- [ ] Independently review reference labels and measure pilot quality/time.
- [x] Activate daily private monitoring from 17 October, morning Europe/Amsterdam; exception-only notifications.
- [x] Activate Monday-morning private growth/product analysis from 19 October.
- [x] Prepare three NL content drafts using existing editorial lists and Collections.
- [x] Define the product-event contract and measurement priorities; no events collected yet.
- [ ] Implement/activate product-event collection and dashboard.
- [ ] Publish code/CI and a review PR through the authorized GitHub account greenf88.
- [ ] Verify GitHub CI actually runs remotely.
- [x] Sign in through the secure browser flow and verify LumiScore project/deployment access. The connector API scope remains a separate limitation.
- [ ] Evaluate semantic search after classification evidence is satisfactory.
- [ ] Evaluate trained collaborative ranking after sufficient independent overlap.

No reader-model training, fabricated predictive percentages or bulk classification
activation is implied by completing source collection or writing proposals.

## Integration checkpoint — 17 October 2026

Secure browser sign-in now verifies both Vercel and GitHub. The Vercel LumiScore
project shows production Ready at main87345e0. The connector API has separately
returned scope403; successful browser access does not prove that API access changed.
GitHub publishing through greenf88 is explicitly authorized; a bot is not required.
Use the connected GitHub API for publication because git CLI has no push credentials.

## Existing test debt

A full run of unmodified historical base9b0850e independently reproduced the same 15 failures as this
branch. Most visible failures assert historical source structure; one test file
fails at file level. These require separate diagnosis, not silently weakening CI
or claiming all tests are green. Existing application/migration tests were not edited.
