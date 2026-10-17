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
- [x] Run the initial local validation and reproduce the existing test failures on unmodified main.
- [x] Repair outdated test contracts for shared components, localized navigation, the owner-profile loader and evidence-filtered recommendation fixtures.
- [x] Keep the historical PR8 migration test scoped to its original thirteen-version baseline and two release files.
- [x] Fetch Git history in CI so byte tests can inspect the exact reviewed migration blob.
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
- [x] Publish code/CI and review PR #28 through the authorized GitHub account greenf88.
- [x] Verify GitHub CI actually runs remotely; inspect the final result on PR #28 before merge.
- [x] Sign in through the secure browser flow and verify LumiScore project/deployment access. The connector API scope remains a separate limitation.
- [ ] Evaluate semantic search after classification evidence is satisfactory.
- [ ] Evaluate trained collaborative ranking after sufficient independent overlap.

No reader-model training, fabricated predictive percentages or bulk classification
activation is implied by completing source collection or writing proposals.

## Integration checkpoint — 17 October 2026

The GitHub authorization was repaired and verified with actual branch writes and
PR #28 creation. Vercel project metadata and deployment listing are accessible
through the connector using the explicit LumiScore project ID. A redundant team
scope selector returns 403, so it is not used for that project. The operations
preview at commit 3feb813 is Ready. GitHub publishing through greenf88 is
explicitly authorized; a bot is not required. Use the connected GitHub API for
publication because git CLI has no push credentials.

## Test maintenance

The initial fifteen local failures were reproduced on unmodified historical
main. The first remote run also lacked two historical Git blobs because checkout
was shallow. Repairs follow the current shared component/owner-loader boundaries,
use supported evidence for localized explanations and apply the current reliable
trait filter in the legacy catalog test fixture. No runtime ranker, migration
bytes, privacy thresholds or production data change. Tests remain mandatory;
the final full-suite and build results are recorded on PR #28.
