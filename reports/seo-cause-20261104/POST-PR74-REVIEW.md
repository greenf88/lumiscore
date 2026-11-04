# Afzonderlijke beoordeling na PR74 — 4 november 2026

Oorspronkelijk beoordeelde PR75-head: `8edb245612ba32357164ec676073275a8aef02db`, quality CI #170 geslaagd. De onderzoeksgegevens hieronder zijn historische waarnemingen; hun oude productie-SHA wordt niet stilzwijgend vervangen.

PR74 is afzonderlijk goedgekeurd en gepubliceerd op main `1cb54df60e99464787bce59ad50e1d272d17841f`, productie `dpl_Bp74s8TxZWsuV5F5f4DaSravkFjV`. De PR75-branch is zonder conflicten met deze main samengevoegd. De diff tegen deze nieuwe basis bevat uitsluitend scripts, CI en onderzoeksbewijs. `app/`, `lib/`, proxy, frameworkconfiguratie, package/lockfile en vercel.json zijn identiek aan main. De PR74-boekkopij, breadcrumbs, drie bestemmingen en de bestaande PR69-/PR51-werking blijven behouden. Geen productie- of databaseactie wordt door PR75 toegevoegd.

## Beoordeling

- Tijdlijn scheidt commit, build, Ready en daadwerkelijke alias-toewijzing. De begrenzingen zijn deployment-breed, geen gegarandeerde per-domeinregistratie van alle historische wijzigingen. UTC, Europe/Amsterdam inclusief de wintertijdovergang en GSC-performance in America/Los_Angeles blijven onderscheiden. Afgeronde API-vakken zijn uitgesloten van exacte GSC-weekvergelijkingen.
- De 1.176 Googlebot-requestevents en 34 IP-groepen zijn begrensde providergegevens, geen gegarandeerd volledige raw accesslogs. IP-controle gebruikt Google's officiële lijst van 4 november; historische IP-allocatie is daarmee niet volledig bewezen. InspectionTool en onbevestigde UA-simulaties blijven afzonderlijk. Geen willekeurige bezoekersgegevens of credentials in het pakket.
- De metadatafout is aangetoond op oudere retained runtimes en lag vóór de terugval van 25 oktober. Dat verklaart niet aantoonbaar de gehele daling. Verhoogde functieduur is een tweede aanwijzing, zonder gelijkwaardige routemix, paintmeting of sluitende causaliteit. Nieuwe GET-reconstructies zijn geen gearchiveerde Google-responsebodies uit oktober.
- De parser verwerpt nu metadata na ongeldige head-kinderen en respecteert inert template-inhoud. De bestaande positieve routermatrix bevat 165 responses en echte legacyredirects. De negatieve fixture toont waarom drie groene InspectionTool-responses de zes fouten voor gewone/Googlebot-UA niet uitsluiten.
- De handmatige postdeploymentchecker voert 32 begrensde, ongeauthenticeerde GETs uit. SHA/deployment moeten buiten HTML via de alias worden bevestigd. Het script wijzigt geen site, GSC of scheduler en claimt geen browserpaint, indexering of rankingherstel.

De relevante router-/parsercontroles en volledige CI worden opnieuw uitgevoerd op de bijgewerkte branch. De definitieve head en CI-run staan in PR75 en het afzonderlijke eindverslag; eerdere onderzoeksresponses blijven geldig voor de daarbij vastgelegde SHAs. Geen nieuwe historische exports of productie-aanvragen zijn nodig om de ongewijzigde bevindingen te herhalen.

Advies: inhoudelijk geschikt als afgebakend onderzoeks- en preventiepakket, mits de nieuwe CI slaagt. **PR75 blijft Draft; geen merge- of publicatieakkoord voor PR75.** Het onverklaarde aandeel in de SEO-daling blijft een expliciete onderzoeksgrens.
