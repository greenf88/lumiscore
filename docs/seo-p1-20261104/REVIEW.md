# PR76 — afgebakend releasevoorstel, nog niet publiceren

## Probleem en reparatie

Op productie `a8f98a8dbed362c321cf913dac53e1545c9ce7a9` (`dpl_F6j6cQ9TTBm3RUnXxfEJDeDPXDwN`) tonen de gewone Browse-pagina's 2 en 3 andere groepen boeken, maar leveren `noindex, follow` en een canonical naar pagina 1. De bestaande a-href-paginering was al crawlbaar. `browseHasQuery` beschouwde ieder queryveld als filter; `editorialHref` voegde bovendien ook voor standaardpaginering expliciet pageSize/sort toe.

Alleen de normale ongefilterde reeks (hoogste score, 16 kaarten) krijgt nu `/nl/browse?page=N` of `/en/browse?page=N`, met index/follow en een self-canonical. Pagina 1 blijft `/browse`. Eerdere standaardlinks met `pageSize=16&sort=highest` blijven bruikbaar en wijzen canoniek naar dezelfde compacte reeks. Filter-, zoek-, andere sorteervolgorde-, ander paginaformaat-, onbekende en ambigue varianten behouden noindex. Geen robots.txt- of sitemapwijziging.

De ongewijzigde RPC klemt een te hoog paginanummer af. Gewone paginering verwijst in dat geval met 307 naar de echte laatste pagina, in plaats van een eigen indexeerbare kopie daarvan aan te bieden. Er is geen extra database-/externe aanvraag vanuit metadata toegevoegd. Selectie vóór paginering, taalvoorwaarden, scores, rangschikking en bestaande 16-kaartweergave blijven gelijk.

Vervolgpagina's krijgen geen automatische hreflang: NL en EN verschillen in aantal en volgorde, zodat pagina N geen bewezen vertaling van pagina N is en soms niet in beide talen bestaat. De hoofdpagina behoudt de drie wederkerige alternates, inclusief bestaand x-default. Alle overige bestaande metadatabeleid blijft gelijk.

## Productiehercontrole en cohort

Zie `COHORTS.md`, `cohorts.json`, `pagination-before.json` en `PRIORITIES.md`. De vaste 30 historische uitsluitingen en 12 prioriteiten zijn 42 unieke URLs. Alle 42 geven 200 met één juiste canonical in geldige oorspronkelijke head. Alle twaalf prioriteiten hebben een aangetoond publiek navigatiepad. Voor 18/30 historische uitsluitingen is geen inlink gevonden binnen de 158 documenten; geen volledige orphan-claim.

Bij de twintig uitgesloten boek-URL's: vijf zichtbare beschrijvingen, elf ontbrekendmeldingen, vier tijdelijke bronfouten. Elf melden geen geverifieerde editie in de gevraagde taal. Dit zijn deels dezelfde records, geen optelbare groepen. Geen catalogusmutaties en geen massale noindex. De bestaande tien redactionele boekdossiers en PR74/75 zijn hergebruikt. Geen nieuwe Google-indexstatus of rankingherstel geclaimd.

## Geteste applicatie en Preview

Applicatiecommit: `c7ed81dda41ccc6e0d528a73bc399b56efe87482`.

Ready-Preview: https://lumiscore-1dbfua4b1-rgkgroeneveld-9102.vercel.app/nl/browse?page=2

Deployment: `dpl_ECMkGMQ67ermLV7V9mtv2UqHQZjV`, target Preview (`null` in API), uitsluitend branchgebonden publieke configuratie van testproject `hlvujbrmfdlrfxdjwsmb`. De eerste automatische build had die nieuwe branchconfiguratie nog niet; die build is geen acceptatiebewijs. Daarna is één noodzakelijke Preview-build gemaakt met de juiste bestaande testconfiguratie. Productieconfiguratie en bescherming ongewijzigd.

- **52 oorspronkelijke hosted GET-responses** met bestaande officiële Vercel CLI-authenticatie; 40 nieuwe Preview / 12 baseline. Canonical binnen de geldige head, geen dubbele tags. Desktop-, Googlebot- en InspectionTool-UA voor pagina's 1–3 in beide talen. Dit zijn UA-simulaties, geen echte crawlerbezoeken.
- Beide talen: drie opeenvolgende pagina's × 16 kaarten = 48 verschillende Works, geen doublures. Exact dezelfde Work-volgorde als de eerdere PR74-test-Preview op dezelfde actuele testcatalogus.
- Expliciete oude standaardparameters, filters, sortering, paginaformaat en te hoge paginanummers gecontroleerd. Filtervarianten noindex; 307 naar echte laatste pagina; detailcanonical blijft zonder returnTo.
- Browser: NL-paginering met toetsenbord, Engelse kaart → detail → terug naar pagina 3, herladen en echte taalwissel. 12 responsive combinaties (320/390/1280 × NL/EN × Paper/Ink), 16 kaarten, zichtbare titel, geen horizontale overflow. Bestaande stijl/CSS/componentindeling ongewijzigd. Geen ingelogde privétest nodig voor deze openbare paginering; geen accounts of userwrites.
- **215 lokale oorspronkelijke HTML-responses**, vijf UA's, echte Vinext-router met synthetische loaders: inclusief 404/redirects, noindex en vertraagde optionele cover-/beschrijvingsbronnen. Head en hoofdinhoud blijven onafhankelijk van die 2s-bronnen; late inhoud blijft verschijnen. Acht parsercontroles blijven behouden.
- TypeScript, lint, build en client-secretscan geslaagd. Gerichte regressies geslaagd. Definitieve volledige CI-status wordt op de exacte PR-head in de PR vastgelegd.

Preview heeft een platformheader `x-robots-tag: noindex`; dat is de behouden Previewbescherming, afzonderlijk van de gecontroleerde applicatie-metadata die na een goedgekeurde productierelease index/follow moet leveren.

## Begrensde timing, geen productieclaim

Twaalf GET-timingmetingen per versie over dezelfde zes NL/EN-pagina's, twee herhaalde waarnemingen per route. Oude en nieuwe immutable Preview, dezelfde testcatalogus. Curl response-start sluit CLI-bootstrap uit; geen gecontroleerde koude cache, geen productieveldmetingen en geen LCP/INP-claim.

| Maat | Baseline mediaan (min–max) | Nieuwe Preview mediaan (min–max) |
|---|---:|---:|
| TTFB | 427,7 ms (278,0–1696,1) | 318,2 ms (226,3–577,2) |
| Volledige HTML-response | 553,1 ms (302,6–2334,9) | 330,5 ms (235,9–609,3) |

Deze kleine, niet gerandomiseerde steekproef toont geen gemeten vertraging; zij bewijst geen causale versnelling. Zichtbare hoofdtitel is browsermatig gecontroleerd, geen vergelijkbare paint-/CrUX-nameting beschikbaar. Coveroptimalisatie of andere performancewijzigingen zijn niet opgenomen.

## Uitrol na afzonderlijk akkoord en rollback

1. Exacte PR-head, groene CI, runtimehashes en compatibiliteit met actuele main controleren. Previewbewijs mag voor uitsluitend documentatie-/testwijzigingen worden hergebruikt als runtimehashes gelijk blijven.
2. Alleen deze PR mergen en de productiealias aan de resulterende Ready-deployment controleren. Geen migraties, imports, environmentschakelaars of cache-/beveiligingsinstellingen nodig op productie.
3. Oorspronkelijke productie-HTML opnieuw controleren voor NL/EN Browse 1/2/3, oude standaardparameters, filtervariant, hoge pagina en detailreturn. Behoud metadataherstel, PR74-kopij, PR51 en bestaande indexerings-/toegangsregels.
4. Bij regressie alleen deze codecommit terugdraaien of de vastgelegde vorige Ready-productiedeployment herstellen. Geen dataherstel nodig: dit pakket heeft geen databasewrites.
5. Eventuele GSC-nacontrole en gerichte aanvragen apart na akkoord; geen aanvragen of sitemapinzendingen in deze opdracht.

**Advies:** gerichte releasebeoordeling zodra de exacte head-CI groen is. Geen bewijs dat dit de volledige organische terugval verklaart of rankings herstelt. Overige P1/P2-dossiers blijven in de onderbouwde backlog.
