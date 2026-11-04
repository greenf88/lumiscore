# PR77 — vier beschrijvingsfouten, begrensd releasevoorstel

**Status: uitsluitend test/Ready Preview. Niet gemerged, niet gepubliceerd, geen productiegegevens gewijzigd.**

Geteste applicatiecommit: `24b3ba6d39ddb34cb12e2f8650a1a566a6e79ec6`.
Hosted geteste head: `5d2917a79362762145ead301d8765295647c5c2d`; latere commits wijzigen alleen bewijs, import-/herstelscope en tests. De uiteindelijke volledige PR-head en exact-head CI staan in de PR en de oplevering; vergelijk de runtime-diff vóór vrijgave.

Ready acceptatie-Preview: https://lumiscore-fp2yl0bn0-rgkgroeneveld-9102.vercel.app
Deployment: `dpl_Ck5f5mkCHuBZNsnvaCSTbmUSrjiM`.
Basis main/productie: `9f230d56beca5eaccedd5f5d1c4b9127713e1024`, PR76 inclusief eerdere metadata-, Suzanne-, Paper- en PR51-reparaties.

## Oorzaak en reparatie

De vier doelcombinaties hadden geen bruikbare centraal opgeslagen tekst in de gevraagde taal. Drie exacte OL-edities hebben geen beschrijving; de vierde heeft een zeer korte Nederlandse annotatie. Work-teksten bestaan deels, maar zijn terecht geen automatisch taal-/editiegebonden bewijs. De Google-ISBN-fallback kreeg HTTP429 tijdens de begrensde broncontrole op de onderzoekscomputer. Dit bewijst niet welke upstreamstatus Vercel op eerdere bezoeken ontving.

1. Vier zelfstandige, feitelijke samenvattingen op basis van gecontroleerde uitgever-/bibliotheekbronnen, in de bestaande centrale opslag. Eén NL, drie EN. Geen gefabriceerde inhoud, geen volledige flaptekst, geen nieuwe clientuitzonderingen.
2. Goedgekeurde opgeslagen tekst direct in de eerste beschrijvingssectie van de oorspronkelijke HTML. Beschikbare opgeslagen tekst krijgt geen onnodige laadplaceholder. Externe optionele beschrijvingen/covers blijven streamen; titel en bediening wachten daar niet op.
3. De gedeelde bronfilter accepteert het exacte PRH Higher Education-formaat `/book/?isbn=<geldig ISBN13>`. Alle overige veiligheidsvoorwaarden blijven: HTTPS, geen credentials/fragmenten, één checksum-geldig ISBN, geen extra/duplicaat-/tokenparameters. Deze filter blokkeerde de nieuwe, correcte Castle-bron; de hosted test ontdekte en bewijst de gerichte oplossing.

Tijdelijke bronfouten blijven onderscheiden van werkelijk ontbrekende inhoud. Bestaande korte foutcache en cache-isolatie per taal behouden; geen versoepeling van Work-, ISBN-, taal- of editiecontroles. Smaakberekening, scores, PR51, CSS, navigatie en metadatahelpers ongewijzigd.

## Vier exacte presentaties

| Productie voor SEO-nacontrole na afzonderlijk goedgekeurde release | Testroute | ISBN |
|---|---|---|
| https://lumisco.re/nl/book/6272 | /nl/book/988110001 | 9789029564731 |
| https://lumisco.re/en/book/1995 | /en/book/988110002 | 9781619630628 |
| https://lumisco.re/en/book/1824 | /en/book/987110006 | 9780679417354 |
| https://lumisco.re/en/book/8783 | /en/book/988110003 | 9780345292568 |

De test-ID's verschillen; Work-OL-identiteit, auteur en geselecteerde editie-OL-ID/ISBN/titel/taal komen overeen. Geen andere editie als bewijs gebruikt. De Nederlandse Kafka-tekst blijft exact behouden en is na EN→NL→EN, herladen en Ink gecontroleerd.

## Acceptatie en beperkingen

- 26 volledige hosted GET-responses, zonder accountcookies: vier exacte doelpagina's × desktop/mobile/Googlebot/InspectionTool, zes Browse-pagina's en vier aanvullende controlepagina's. Parser controleert oorspronkelijke head, één canonical, robots en taalverwijzingen; boek-/bestemmingspagina's behouden BreadcrumbList. Beschrijvingen staan in de eerste echte HTML-sectie, niet uitsluitend in late RSC/scripts. Preview-bescherming kan afzonderlijk `x-robots-tag: noindex` geven; dit is geen productiebeleid.
- 13 browsergevallen: alle vier desktop/Paper, alle vier mobiel320/Paper, alle vier mobiel390/Ink, bestaande Nederlandse Kafka-tekst desktop/Ink. Gastsessie, juiste teksten/bronnen, geen horizontale overflow, herladen en taalwissel; geen consolefouten. Heen-/terugnavigatie van Suzanne→Madonna, fantasy→Hobbit en PHM→Mars werkelijk doorlopen. Bestaande nuttige vervolglinks behouden; geen onnodige nieuwe kruislinks.
- 225 echte lokale routerresponses, vijf UA's, acht parsertests, vijftien legacy-redirectgevallen, vertraging van optionele bronnen daadwerkelijk uitgeoefend; metadata/H1 blijven vroeg en optionele inhoud blijft aanwezig.
- TypeScript, lint, build, clientsecretscan en gerichte beschrijvings-/importtests slagen. Brede lokale ronde:1074 tests,1055 pass,16 bestaande skips,3 initiële fouten. Eén verouderde streamingassertie is bijgewerkt; historische Windows-checkoutbytes hersteld zonder inhoudelijke pakketwijzigingen. Alle15 betrokken hercontroles slagen. Daarnaast32 gerichte beschrijvingscontroles en vier real-data/CAS/hersteltests. Exact-head GitHub CI is vereist vóór release en wordt afzonderlijk bevestigd.
- Preview-TTFB voor16 beschrijvingsrequests: mediaan270,25ms, bereik218,31–460,41ms; complete response mediaan323,30ms. Geen gecontroleerde koude cache, geen LCP/paint- of productieverbeteringsclaim. De productie-vooropname heeft vier verzoeken en andere data/omgeving; geen causale snelheidsvergelijking.
- Bestaande covers zijn niet gewijzigd. Deze opdracht bewijst geen nieuwe coverreparaties. Geen wijziging van scores of rangschikking.

`ACCEPTANCE.json` bevat de compacte URL-/UA-matrix, exacte UA-strings, originele-responsehashes, browserbewijs, linkroutes en meetdefinities. Ruwe HTML en screenshots staan lokaal in `outputs/description-recovery-20261104/`. `FOLLOWUP.md` bevat alle15 taal-URL-dossiers:13 Works, waarvan4 doelcombinaties hersteld op test en11 afzonderlijk onderzochte vervolggevallen. Daaronder zes Nederlandse editiekandidaten met expliciete open cover-/tekst-/identiteitscontrole. Ze vallen buiten de vier productieacties.

## Gegevenspakket en bewezen herstel

`release-hashes.json` is het uitvoeringsmanifest; alle afzonderlijke SHA256's zijn reproduceerbaar getest. Productievoorstel: **uitsluitend4 inserts in catalog_work_descriptions**, geen nieuwe Works/edities, geen schema-/rechten-/account-/rating-/voortgang-/catalogusselectiewijziging; netto Nederlandse beschikbaarheid0.

Testproject: `hlvujbrmfdlrfxdjwsmb`. Elf eigen acties: vier teksten plus zeven testfixtures (één auteur, drie Works, drie exacte edities). Bestaande Kafka-Work/edities en twee auteurs hergebruikt. Geen nummerreeks gewijzigd.

Hosted bewijs via de bestaande ingelogde normale testdashboardroute:

1. Actuele volledige parent-/editie-/tekstvooropname en tellingen; project gecontroleerd.
2. Exacte transactionele import gecommitteerd, elf receipt-rijen bewaard; onafhankelijk vier teksten teruggelezen.
3. Herhaalimport: nul wijzigingen.
4. Herstel **ná commit** uitgevoerd, niet slechts een dry-run/ROLLBACK. Alle eigen rijen weg; beginsituatie terug, bestaande Kafka-NL-tekst en aantallen accounts/ratings/statussen/collecties behouden.
5. Definitief herstelbestand met extra binding van receipt aan exacte goedgekeurde seq/relation/key/before/after opnieuw gecommitteerd uitgevoerd. Alleen eigen elf acties; CAS en alle incoming-FK-guards intact. Volledige begintellingen wederom terug.
6. Goedgekeurde testtoestand opnieuw gecommitteerd toegepast. Receipt exact gelijk aan de eerder geaccepteerde toestand; browserbewijs blijft geldig.

Eén tussentijdse editorvervanging maakte een onvolledige dollarquote; de SQL-parser weigerde die aanvraag. Dit was geen autorisatieweigering en geen connectorretry. De reeds herstelde toestand is read-only bevestigd en de ongewijzigde import is daarna vanuit een lege snippet correct uitgevoerd. Geen rechten/RLS aangepast. De dashboardwaarschuwing over de tijdelijke receipt-tabel leidde niet tot een blijvende publieke tabel: die verdwijnt bij COMMIT.

Lokale echte PostgreSQL/PGlite-tests bewijzen bovendien: gemanipuleerde receipt geweigerd, latere tekstwijziging/afhankelijkheid/gewijzigde editie blokkeert herstel, alle overige rijen en synthetische private stand-ins behouden, herhaalde import en herhaald herstel zonder extra mutaties. Geen storingswrites op productie.

De zeven fixtures blijven uitsluitend op test beschikbaar voor PR-review. Er zijn geen testaccounts of testcollecties aangemaakt. Gerichte cleanup gebruikt `test-restore.sql` met `test-final-preview-receipt.json`; stop bij latere wijzigingen/afhankelijkheden. De productieimport bevat deze fixtures niet.

## Uitvoering pas na afzonderlijk akkoord

1. Exacte PR-head/CI, runtimegelijkheid, manifest en alle bestanden opnieuw controleren; actuele main/productie en parent-/editiewaarden read-only vergelijken. Stop bij afwijking. Controleer dat de vier doelteksten nog ontbreken of exact gelijk aan deze goedgekeurde voorstellen zijn.
2. Herstelbare actuele snapshot bewaren van vier Works/auteurs/edities en betrokken presentatiegegevens. Verifieer verbinding met `qvplwejffhjvxaypmjut`. Geen migratie nodig; centrale opslag/guards bestaan al.
3. Alleen `production-apply.sql` transactioneel uitvoeren. Vier wijzigingen bij eerste toepassing; eerste niet-lege volledige receipt veilig bewaren. Teruglezen; herhaal hetzelfde bestand, verwacht nul wijzigingen. Vervang de eerste receipt nooit door de lege herhaalreceipt.
4. Alleen goedgekeurde PR77-code volgens bestaande merge-/deploymentprocedure publiceren. Met bestaande test-/Previewbescherming geen productie-noindex toevoegen.
5. Vier oorspronkelijke productie-URL's, juiste bronnen en oorspronkelijke HTML/DOM controleren, plus NL/EN Browse1–3, bestaande leesroutes en PR51-default-uit. Geen productieaccounts/ratings of synthetische campagne-events maken.
6. Bij regressie: vorige code-deployment terugzetten. Gegevensherstel afzonderlijk: laad uitsluitend de eerste gecommitteerde receipt via `set_config('lumiscore.catalog_release_receipt',…,false)` en voer exact `production-restore.sql` uit. Het bestand bindt aan vier goedgekeurde acties, controleert volledige rijen/ouders/edities en weigert latere wijzigingen of afhankelijkheden. Code-rollback draait data niet automatisch terug.

Geen GSC-aanvraag, sitemapinzending, socialpublicatie of productieherstelclaim in dit pakket. Eerdere vier geadviseerde GSC-URL's worden niet zonder bevestiging als ingediend geregistreerd. Previewacceptatie bewijst geen Google-crawl, indexering of meetbaar verkeersherstel.

**Releaseadvies: afgebakend codepakket + vier samenvattingen ter beoordeling aanbieden zodra definitieve exact-head CI groen is. Elf resterende dossiers blijven afzonderlijk; geen onbewezen editie-/covercorrecties meeleveren.**

Uitvoeringsmanifest SHA256: 345afbc4b85558273c3049d60952cf3ef25fb2641e28a13a62e686f81e036af9.
