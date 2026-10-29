# NL-aanbevelingen: editieonderzoek — 29 oktober 2026

## Uitkomst en scope

Basis main/productie: 246c379db1c674ac14e2959893f874c00b9330b2, Ready dpl_6FV5kzqQHkBzKFE2y4gCmiqYNzK9.
PR58 blijft onaangeraakt (af6dd83fdeb83df7cae26ef94960ff4e355d15f7); PR51/accountverwijdering buiten scope.
Alle productiequery's waren SELECT op openbare bibliografie. Geen account-, rating- of statusgegevens gelezen. Geen databasewrites op productie of test.

De gemelde meerderheid is verklaarbaar en gereproduceerd, maar er is in de onderzochte keten **geen gemeenschappelijke codefout aangetoond**. Daarom bevat deze PR uitsluitend regressietests en bewijs/afzonderlijke catalogusvoorstellen, geen cosmetische schijnfix, nieuwe selector of wijziging van de ranker.

Een begrensde, publieke read-only guest-aanvraag met locale=nl, limit=20 en tien synthetische questionnairekeuzes 'left' gaf HTTP 200 (37.957 ms, één observatie; geen prestatiebenchmark): **8 NL + 12 gelabelde EN-fallbacks**. Dit is geen uitlezing van het profiel van de gebruiker en geen reconstructie van diens precieze ingelogde ratingronde. Onderstaande tabel hoort bij die aanvraag. Volledige openbare editie-identiteiten/ISBN's staan in public-edition-snapshot.json.

| Positie | Work | NL-edities | EN-edities | Gekozen editie / titel | Reden |
|---|---|---|---|---|---|
| 1 | 1411 | 1463 | 1464 | 1463 — De moord op Roger Ackroyd | NL eerst |
| 2 | 1397 | geen vastgelegd | 1444 | 1444 — Robinson Crusoe | EN-fallback; geen geschikte vastgelegde NL-editie |
| 3 | 1407 | 1457 | 1458 | 1457 — Ik, robot | NL eerst |
| 4 | 1402 | 1451 | 1450 | 1451 — Les misérables | NL eerst |
| 5 | 2130 | geen vastgelegd | 2333 | 2333 — Sons and Lovers | EN-fallback; geen geschikte vastgelegde NL-editie |
| 6 | 2825 | geen vastgelegd | 2984 | 2984 — 2666 | EN-fallback; geen geschikte vastgelegde NL-editie |
| 7 | 180 | geen vastgelegd | 180 | 180 — Carrie | EN-fallback; geen geschikte vastgelegde NL-editie |
| 8 | 1894 | geen vastgelegd | 2068 | 2068 — The Haunting of Hill House | EN-fallback; geen geschikte vastgelegde NL-editie |
| 9 | 1381 | 1421 | 1420, 10308 | 1421 — Dierenboerderij | NL eerst |
| 10 | 1393 | 1437 | 1438 | 1437 — Hof van vleugels en verwoesting | NL eerst |
| 11 | 93 | 1308 | 1307 | 1308 — Harry Potter en de steen der wijzen | NL eerst |
| 12 | 1824 | 1975 | 1976 | 1975 — Het slot | NL eerst |
| 13 | 6155 | 6314 |  | 6314 — Vervloekte dochters | NL eerst |
| 14 | 164 | geen vastgelegd | 1335 | 1335 — Leviathan Falls | EN-fallback; geen geschikte vastgelegde NL-editie |
| 15 | 151 | geen vastgelegd | 151 | 151 — Gideon the Ninth | EN-fallback; geen geschikte vastgelegde NL-editie |
| 16 | 1993 | geen vastgelegd | 2187 | 2187 — The Prince | EN-fallback; geen geschikte vastgelegde NL-editie |
| 17 | 189 | geen vastgelegd | 189 | 189 — Six of Crows | EN-fallback; geen geschikte vastgelegde NL-editie |
| 18 | 125 | geen vastgelegd | 125 | 125 — The Passage | EN-fallback; geen geschikte vastgelegde NL-editie |
| 19 | 1951 | geen vastgelegd | 2134 | 2134 — The Call of the Wild | EN-fallback; geen geschikte vastgelegde NL-editie |
| 20 | 199 | geen vastgelegd | 199 | 199 — The Testaments | EN-fallback; geen geschikte vastgelegde NL-editie |

Bij Work 1397 bestaat daarnaast editie 1443 (Robinson Crusoë, ISBN 9789076268644, OL47115090M) met language=NULL. De titel/cover/ISBN-prefix zijn geen taalbewijs. Een gevonden secundaire vermelding betreft een geïllustreerde uitgave van 123 pagina's; mogelijke bewerking vereist aparte identityreview. **Niet blind naar nld corrigeren.**
Bij Works 164 en 1951 bestaan eveneens onbekende-taaledities (164 en 2133), maar geen vastgelegde geschikte NL-editie. De overige negen fallback-Works hebben alleen een vastgelegde EN-editie. 'Ontbreekt in catalogus' betekent niet 'bestaat niet in de wereld'.

## Volledige keten

1. RatingTasteTest geeft locale expliciet mee aan /api/taste-test/rounds en buildRoundRequest; redirect naar resultaat is localizedHref(...,locale).
2. taste_rating_rounds.language bewaart de ronde-/selectietaal. Questionnaireantwoorden bewaren keuzes, géén leeseditietaal. user_reading_preferences bewaart uitsluitend leesperioden/onboarding. Er is geen oudere opgeslagen Engelse leestaalvoorkeur die als override moet worden gemigreerd.
3. TasteRatingResult vraagt /api/taste-test/result?locale=... met no-store. RecommendationOverview verzendt locale in de guest-POST. Beide negeren antwoorden van een andere UI-locale en annuleren verouderde requests.
4. loadRatingResult gebruikt de actuele requestlocale voor catalogus, presentatie en hydratatie. Het geretourneerde language-veld beschrijft alleen de opgeslagen ronde, niet de te tonen editie. Een oude EN-ronde mag bij NL-presentatie intact blijven.
5. loadRecommendationCatalog haalt alle evidence/correction-kandidaten op, niet eerst twintig Works. loadEditionRows haalt alle edities in batches van 200 Works en stabiele pagina's van 1.000 edities op. Daarna mapCatalogWorks → selectStrictEdition: geschikte NL eerst, anders toegestane EN.
6. Ranker, smaakvector, kwaliteitsprior, diversiteit en bestaande beperkte Dutch-nudge blijven ongewijzigd. Hydratatie haalt dezelfde Work-ID's opnieuw in dezelfde locale op. Covers worden uitsluitend aan die editie gebonden.
7. BookCard/RecommendationRow tonen EditionPresentationLabel; LocaleLink houdt de detailroute in dezelfde taal. Detail gebruikt dezelfde mapper/selector en alle edities.
8. Guest-cataloguscache is per Locale en bevat uitsluitend openbare bibliografie/evidence. Geen persoonlijke resultaten in gedeelde cache. Persoonlijke API-responses blijven private/no-store; React cache is request-lokaal. Covercache is edition-keyed en controleert Work/titel/ISBN/taal opnieuw.

Een correctie die een werkelijk geschikte NL-editie toevoegt kan de **bestaande** beperkte Dutch-nudge activeren en daardoor de positie wijzigen. Dat is geen nieuwe rangschikkingsregel. Deze PR wijzigt zelf geen data of rangschikking.

## Gericht bewijs

scripts/recommendation-edition-language.test.mjs draait echte Supabase-client + lokale PGlite en de daadwerkelijke books/taste-test/rating-result-loaders via Vite SSR. Alleen transport, synthetische accountstate en evidence/scores zijn geïsoleerde fixtures. Geen externe testwrites.

- Openbare bibliografische momentopname: 8 NL / 12 EN en passende fallbackvlaggen.
- Alle twintig aanbevelingsidentiteiten gelijk aan detail (Work, editie, titel, taal, ISBN, OLID, cover-URL's).
- NL→EN→NL en herhaalde cachehit: identieke NL-uitkomst; EN sluit het NL-only Work uit.
- Legacy-account zonder voorkeurrecord: dezelfde NL-presentatie.
- Bestaande EN-ronde + huidige NL-request: opgeslagen ronde blijft EN, alle kaarten volgen NL.
- NL-editie ná 1.000 EN-editieregels: wordt alsnog geselecteerd; geen vroege cut-off.
- Work-matches blijven gelijk; geen rating-/voortgangmutaties.
- Client/API-locale, expliciete labels en private-cachecontracten bewaakt.
- Bestaande editie-, taalvoorkeur- en catalogue-performance-regressies apart uitgevoerd.

## Hosted bewijs en beperkingen

Draft-PR: https://github.com/greenf88/lumiscore/pull/60
Geteste applicatiecommit: 552337f588c30029a75d78e8097e0f6ca3b1f47a (runtime identiek aan main; uitsluitend tests/bewijs toegevoegd).
Ready-Preview: https://lumiscore-67u332p29-rgkgroeneveld-9102.vercel.app
Deployment: dpl_GtrdavWjhbeEdQ3mHMjDCX93i51k, target=null/Preview, dezelfde commit.
Alleen de twee goedgekeurde publieke branchvariabelen zijn op test ingesteld. De eerste Git-build startte vóór de URL was ingesteld; één noodzakelijke rebuild is uitgevoerd. Deployment Protection bleef intact; HTTP-controles gebruikten de officiële vercel curl-toegang.

hosted-api.json bevat de drie daadwerkelijk teruggelezen HTTP-API-uitkomsten met dezelfde tien synthetische questionnairekeuzes. NL → EN → NL gaf telkens twintig kaarten; alle NL-keuzes waren nld/nl, alle EN-keuzes eng/en. Beide NL-uitkomsten zijn exact gelijk, inclusief Workvolgorde, titel en editie-ID. Deze testcatalogus heeft veel synthetische NL/EN-paren en is **geen kopie van de productiecatalogus**: hij hoort de verhouding 8/12 niet te reproduceren. De verhoudingsverklaring is aanvullend gereproduceerd met de openbare momentopname in de geïsoleerde lokale PostgreSQL-test.

Totale CLI-aanvraagduur was respectievelijk 6.395 / 6.464 / 3.437 ms. Dit omvat CLI-start, toegangscontrole en transport; het is geen TTFB-/LCP- of productiesnelheidsclaim.

Browser, desktop 1265×712, Paper/Ink:
- NL-test Work 924100151: Gideon the Ninth, ISBN 9781250313195, geladen Engelse cover en zichtbaar 'Engelse editie'; EN dezelfde identiteit zonder fallbacklabel.
- NL-test Work 928101411: gedeelde boekkaart kiest De moord op Roger Ackroyd, editie 928201463, ISBN 9789024511624. Doorklikken/herladen behoudt die identiteit en de cover. EN kiest The Murder of Roger Ackroyd, editie 928201464, ISBN 9780735105850; terug naar NL herstelt de Nederlandse editie. Zoekterm/teruglink blijven behouden.
- Screenshots: nl-english-fallback-ink.png, en-edition-paper.png, nl-preferred-card-paper.png, nl-preferred-detail-paper.png, en-preferred-detail-paper.png.
- De Ackroyd-beschrijving gaf tijdelijk een bronfout. Geen verkeerde taaledities teruggevallen; beschrijvingsherstel/PR58 blijft afzonderlijk.

Geen toegestane bestaande Preview-login beschikbaar en geen nieuw account aangemaakt. De guest-antwoorden zijn via de echte hosted read-only API aangeboden; er is geen volledige ingelogde smaaktestronde opgeslagen. Legacy-account en oude ronde zijn met de echte loaders en lokale synthetische accountstate getest, **niet als hosted accountbewijs**. Het gast-vragenformulier vereist de oorspronkelijke anchor-Work-ID's, die op deze testcatalogus ontbreken. Er zijn daarvoor geen extra catalogusrecords toegevoegd. Geen fysieke telefooncontrole of nieuwe volledige layoutcampagne geclaimd; geen vormgevingswijziging in dit pakket.

CI 40945838780 op de geteste commit: success (LumiScore quality). Nieuwe regressies 2/2, bestaande gerichte regressies 21/21, TypeScript, ESLint, gewone lokale productiebuild en secretscan geslaagd. Vercel-productiepackaging op Windows strandde op de bestaande gedeelde node_modules-junction/file tracing; de Linux hosted Vercel-build en CI-build zijn wel geslaagd.

## Afzonderlijk datavoorstel

catalog/nl-recommendation-editions-20261029/proposals.json bevat drie onderbouwde Nederlandse printedities die de huidige fallback kunnen vervangen zonder nieuw Work. Geen uitvoerbare import of productieakkoord; coverbinding, import-dry-run, testtoepassing en gerichte rollback moeten vóór een latere datarelease worden afgerond. De overige negen gevallen blijven onderzoekspunten. Onbewezen taalvelden worden niet aangepast.

## Releaseadvies

Geen runtime-codefix nodig op basis van dit bewijs. Deze bewijs-/regressie-PR kan afzonderlijk worden beoordeeld; hij maakt de twaalf ontbrekende NL-edities niet beschikbaar. Een claim 'opgelost, nu overwegend NL' zou onjuist zijn. Meer Nederlandse resultaten vereist een apart geverifieerd editie-aanvulpakket, niet lossere taalregels of een verborgen rankeraanpassing.
