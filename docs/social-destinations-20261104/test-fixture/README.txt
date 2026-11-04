PR74 — TEST ONLY — 4 NOVEMBER 2026
Project: hlvujbrmfdlrfxdjwsmb. Never execute these fixtures on production.
Application SHA:51539454fc2cd75d66096bd355faf0f56359e186; no runtime change in this follow-up.
User explicitly authorized these bounded test additions. No extra accounts are needed.

SCOPE (17 INSERTIONS; 0 UPDATES)
Reuse author91021002, six existing real Works/editions/summaries and collection11.
Add one Madonna Work+edition999740001, seven edition cover/format bindings, one migrated existing
reviewed Madonna summary and seven collection links. Leave52 original migration placeholders.
Six reused Works:91021002 All-inclusive;91021011 Noorderlicht;91021025 Roadtrip;
91021033 Koraalrif;91021044 Zomeravond;91021045 Dwaalspoor.
No production IDs are overwritten. These fixtures must never join a production import.

SOURCE AND FORMAT
Exact edition/ISBN evidence and unchanged reviewed summaries are preserved in manifest.json.
All-inclusive OL28313071M paperback, ISBN9789022996072, cover10242390.
Noorderlicht OL31888299M ISBN9789400502000: Bureau ISBN confirms NL paperback and directly binds
the selected image; https://metadata.isbn.nl/24274/noorderlicht.html.
Roadtrip OL37844978M ISBN9789400514492 cover12728038; format remains unknown rather than guessed.
Koraalrif ISBN9789400515178: official author page identifies paperback and selected cover.
Zomeravond ISBN9789044932560 and Dwaalspoor ISBN9789044933192: official page image containers
are explicitly bound to these EANs and specifications identify E-books. Do not call them print.
Madonna ISBN9789044970791: official page identifies Ebook,14pages; short story from De bestemming.
https://suzannevermeer.nl/boek/{madonna,koraalrif,zomeravond,dwaalspoor}/.
All seven images were downloaded, decoded and visually checked for title/author; all loaded in
actual Preview cards and details. Source transfer bytes46,169;90,307;68,203;276,121;329,432;
295,597;117,796 respectively for All-inclusive/Noorderlicht/Roadtrip/Koraalrif/Zomeravond/Dwaalspoor/Madonna.
Zomeravond329,432bytes remains above300kB; it is a correct readable exact-edition image, not a
broken/missing cover. These one-shot transfer measurements are not LCP or a speed benchmark.

EXECUTION AND PRESERVATION
Existing Supabase connector, exact project verified ACTIVE_HEALTHY before writes.
First committed import:2026-11-04T12:13:52.871232Z,17 inserted. Original receipt is retained.
An initial replay safely rejected Z/+00 timestamp-string differences without mutations. The
TEST script now compares typed record fields; successful replay0 inserts.
rollback-first-commit.sql then COMMITTED deletion of only the17 receipt-owned unchanged rows.
It locks parents, compares full current rows and checks all incoming FKs, including CASCADE.
Unexpected dependencies or later changes abort the transaction. No sequence reset.
Post-recovery:own Work/edition/metadata/description0; original collection members52.
71 original full rows unchanged; ratings/status fingerprints and account count2 unchanged.
Reapply:2026-11-04T12:15:42.008042Z,17 inserts; final replay0 inserts; collection59 links.
Final readback retained one own Work/edition,7 metadata,1 description and unchanged protected data.

CURRENT PREVIEW STATE AND CLEANUP
Fixtures intentionally remain for review; this is not uncleaned temporary user data.
cleanup-preview.sql uses the FINAL committed receipt, not the earlier receipt whose created_at
values differ. Before executing through the connector, verify project again and recheck current
dependencies. Stop on any drift. Do not delete other data or reset sequences. Remove only when
review no longer needs these fixtures. import.sql restores the exact approved Preview fixture.
No destructive negative-case dependency test is claimed; full-row/FK protection is in the bounded
recovery script and the real committed recovery succeeded with unchanged original data.

HOSTED ACCEPTANCE
Ready deployment dpl_6nCKBuNh3YWYBWm6jboBJhuTrQ8q on immutable application SHA above.
https://lumiscore-oi0pnlmaz-rgkgroeneveld-9102.vercel.app/nl/collection/suzanne-vermeer
7/7 actual editorial links -> correct detail -> collection return;7 card/detail covers loaded;
7 source summaries visible; exact ISBNs; card/detail both show insufficient ratings, not fabricated0.
Madonna and Noorderlicht NL contextual copy + metadata passed; EN copy absent with unavailable
verified-English-edition message. EN collection0 is expected; no English fixture was invented.
Mobile360 Paper/Ink collection, Noorderlicht Ink and Madonna Paper, reload/language switch:0overflow.
Retained broader unchanged-runtime evidence:36 browser cases,30 original HTTP responses,
150 slow-source metadata regressions, targeted tests/type/lint/build/client-secret scan and green CI.
The old zero-card limitation in the previous review is superseded by this fixture evidence.
Production remains unchanged. No merge, public deployment, GSC or social action.
