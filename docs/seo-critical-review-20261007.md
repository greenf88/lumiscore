# LumiScore Critical SEO fixes voor lokale review

Status: lokaal geïmplementeerd en gericht geverifieerd, niet gepubliceerd. Dit pakket behandelt uitsluitend SEO-001 en SEO-002: DEV-001/002/003/004, plus de daarvoor noodzakelijke taalalternates uit DEV-014. Alle overige auditpunten blijven open.

Branch: `fix/seo-locales-ssr-descriptions-20261007`. Basis: `7f5ad98524887d920ba1ac8f04fd0d3238d66408`, gelijk aan de opgehaalde `origin/main`. Deze basis bevat de reeds gemergede PR #15 met Lora/Inter, coveroptimalisaties en compacte bediening, en PR #16 met de compacte smaaktestuitslag. Geen andere werkruimte of PR is aangepast.

## Bevestigde oorzaken en wijzigingen

| Bevinding | Bevestigde oorzaak | Lokale oplossing |
|---|---|---|
| SEO-001, DEV-003/004 | Eén taalneutrale URL koos taal via cookie/Accept-Language; metadata en canonical bleven gedeeld. Een beperkte productiecontrole op 7 oktober bevestigde EN/NL `html lang` op dezelfde homepage, Engelse titel en nul hreflang-tags. | Vaste `/en` en `/nl` routes. De URL bepaalt server-HTML én clienttaal, niet cookies of browsertaal. Crawlbare taalwissellinks behouden pagina en query. Self-canonicals en wederkerige `en`, `nl-NL`, `x-default` (EN) in pagina en sitemap. Metadata en primaire UI-tekst zijn gelokaliseerd. |
| SEO-002, DEV-001/002 | De boektemplate haalde de synopsis pas na hydratatie op via `/api/books/:id/description`; `robots.txt` blokkeert algemeen `/api/`. De productiebron van `/book/1` bevatte geen beschrijvingskop. De bestaande resolver gebruikt publieke bibliografische bronnen, geen privéprofielen. | De boekroute gebruikt deze resolver rechtstreeks op de server. Beschikbare tekst, kop en bronlink staan in de eerste HTML; uitklappen werkt met native `details`, ook zonder JavaScript. Geen clientfetch voor de synopsis. `/api/` en `/auth/` blijven geblokkeerd en de API-rechten zijn niet verruimd. |

Interne links, zoek-/filterformulieren, paginering, terugkeerlinks en noodzakelijke navigatiedestinations gebruiken dezelfde locale-helper. Sessievernieuwing, vernieuwde requestcookies, responsecookies en private cacheheaders blijven behouden. De smaaktest-API ontvangt uitsluitend de gewenste presentatietaal expliciet; bestaande ronde-identiteit, opgeslagen boektaal, lengte, ratings en voortgang blijven ongewijzigd.

## URL impact en inhoudsgrenzen

Oude `/`, `/browse`, `/book/123` en andere HTML-links krijgen een permanente 308 naar de vaste Engelse standaard, onafhankelijk van voorkeur of bot. `/books/123` gaat direct naar `/en/book/123`. De NL-tegenhanger is `/nl/book/123`. Work-ID's, collectie-identiteiten, queryparameters en bestaande terugkeercontext blijven behouden. Assets, sitemap, robots en Auth-/API-acties blijven taalneutraal. Niet-bestaande boeken blijven 404/noindex; er worden geen boeken of vertalingen verzonnen.

De bestaande indexeringsbedoeling blijft staan: schone Browse is indexeerbaar; queryvarianten blijven noindex met de schone canonical binnen dezelfde taal. Dit pakket voert DEV-005 niet uit. Sitemap bevat uitsluitend canonical EN/NL-paren, wederkerige alternates en de bestaande boek-/collectiedekking. Geen nieuwe `lastmod`, structured data of massale noindex-wijziging.

NL-synopsissen vereisen een passende, aan de Work gekoppelde Nederlandse editie of exacte ISBN-bron met Nederlandse taalmetadata. Work-brede talen kunnen naar vertaalde edities verwijzen en bewijzen geen Nederlandse synopsis; die fallback is daarom verwijderd. Bij ontbrekende passende tekst verschijnt één eerlijke Nederlandse melding. Bestaande boektitels en auteursnamen worden niet kunstmatig vertaald.

Alleen reeds ondersteunde publieke Open Library-/Google Books-synopsissen worden weergegeven, met vaste bronattributie. Er worden geen volledige boeken, gebruikersgegevens of nieuwe databronnen gepubliceerd. Open Library geeft geen algemene vrijwaring van bestaande auteursrechten. Google Books-gebruik blijft gebonden aan API-voorwaarden, attributie en verwijderverzoeken. Bronmetadata bewijst niet zelfstandig het auteursrecht of de feitelijke taal van iedere individuele tekst. Dit pakket claimt dus geen algemene publicatielicentie; bestaande verwijderverzoeken moeten ook voor SSR worden gerespecteerd. Er is geen aanwijzing dat de algemene robotsregel een auteursrechtelijke blokkade per boek vormde.

De serverfetch krijgt een gedeeld outboundbudget van vier seconden, gecombineerd met bestaande requesttimeouts. Bestaande begrensde, taalgescheiden publieke cache en fout-TTL blijven behouden. Retry-overhead kan dit budget kort overschrijden; koude externe bronnen kunnen de boekresponse vertragen. Er is geen gemeten performanceverbetering of volledige description-coverage geclaimd.

## Gerichte verificatie

- 147 gerichte tests geslaagd voor i18n, descriptions, metadata, terugnavigatie, Auth-contracten en bestaande smaaktest-/UI-contracten. Twee aanvullende proxytests slagen en bewijzen met synthetische adapters het doorgeven van vernieuwde cookies, private cacheheaders en het negeren van gespoofte locale-/pathheaders.
- 92 HTTP-bron-HTML-tests geslaagd op de echte Vinext-router met synthetische loaders: homepage, Browse en queryvarianten, categorieën, collecties, boeken met/zonder beschrijving, informatiepagina's, private metadata, oude links, 404, sitemap en robots. Iedere gecontroleerde pagina heeft één robots-instructie en canonical, zonder dubbele OG/Twitter-tags. Tegengestelde cookies/Accept-Language en gespoofte headers veranderen de URL-taal niet.
- Browser-DOM afzonderlijk gecontroleerd: Nederlandse homepage; EN/NL boektekst en metadata; echte taalwissel; Browse pagina 2 → NL-wissel → boek → terug naar dezelfde pagina. Geen consolefouten in deze controle. Desktop-viewport: 1265 CSS-pixels documentbreedte. Geen claim over mobiel of echte productiegebruikerssessies.
- TypeScript, ESLint, Vinext-build, Vercel-bundelbuild, client-secretscan (128 bestanden; geen serversecret-identifiers) en `git diff --check` slagen. De Vercel-bundelbuild vereiste een herhaling buiten de sandbox wegens een lokale `readlink`-toegangsblokkade; er is niets gedeployd.
- Een aanvullende historische brede testselectie was niet volledig groen. Onder meer de oude productievoorbereiding verwacht 13 migratiebestanden terwijl de basis al 16 bevat, en `reader-rows.test.mjs` verwacht een synchrone homepage-catch terwijl de basis al een async-catch heeft. Die ongerelateerde, verouderde assertions zijn niet gewijzigd. De bovenstaande gerichte suites zijn wel groen; dit is geen claim dat de gehele historische suite groen is.

De loopbackpreview gebruikt uitsluitend synthetische data en geen databaseverbinding, accounts of externe descriptionrequests. De echte resolver is apart met gecontroleerde bronresponses getest. Dit bewijst routing/SSR en bronselectie, niet de beschikbaarheid, rechten of taal van alle 10.134 productieboeken. Geen nieuwe hosted testwrites of herstelmails zijn uitgevoerd.

Reproduceerbaar: start `node scripts/seo-critical-local.mjs`; voer `node --experimental-strip-types --test scripts/test-seo-critical-html.mjs` uit. De bestaande `test:seo-html` is bijgewerkt voor beide talen en kan met `SEO_TEST_ORIGIN` en een passende `SEO_TEST_COLLECTION_PATH` draaien.

## Review en latere release

Lokale preview: [EN](http://127.0.0.1:3120/en), [NL](http://127.0.0.1:3120/nl), [NL boek met synthetische synopsis](http://127.0.0.1:3120/nl/book/1). Dit zijn geen telefoon- of hosted links.

Bewijs staat in `C:/Users/rickg/Documents/Codex/2026-09-18/ga-x20/outputs/seo-critical-20261007/`: succesvolle testlogs, buildbewijs, volledige Nederlandse boekscreenshot en de exacte commitdiff. De volledige lokale commit-SHA staat in de bijgewerkte auditbacklog en oplevering.

Nul nieuwe migraties, dependencies, Auth-instellingen of productiedatawijzigingen. Voor publicatie resteert afzonderlijke review/goedkeuring van de vaste EN-default en URL-overgang, daarna push/PR, passende hosted verificatie met echte publieke bronresponses en bestaande toegestane testsessies, CI, merge en de normale deployment. Controleer daarna live redirects, HTML/DOM, wederkerige alternates en sitemap. Publicatie- en bronbeschikbaarheid moeten bij die gate opnieuw worden bevestigd. Geen nieuwe configuratiegoedkeuring wordt hiermee verondersteld.

Bij applicatierollback blijft de database onaangeroerd. Omdat permanente redirects kunnen worden gecachet, moet de URL-overgang vóór release bewust worden goedgekeurd; een terugrol kan niet garanderen dat eerder gecachete 308's direct verdwijnen. Productiestatus van SEO-001/002 blijft open tot live verificatie.

## Officiële bronnen

- [Google meertalige websites](https://developers.google.com/search/docs/specialty/international/managing-multi-regional-sites) en [gelokaliseerde versies](https://developers.google.com/search/docs/specialty/international/localized-versions).
- [Google JavaScript SEO](https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics).
- [Open Library licensing](https://openlibrary.org/developers/licensing).
- [Google Books API-voorwaarden](https://developers.google.com/books/terms) en [attributie](https://developers.google.com/books/branding).
- [Supabase SSR en vernieuwde cookies/cacheheaders](https://supabase.com/docs/guides/auth/server-side/creating-a-client?queryGroups=framework&framework=nextjs).

Controle afgerond: 7 oktober 2026, 21:18 UTC. De audit zelf is niet opnieuw uitgevoerd.
