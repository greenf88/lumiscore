# LumiScore technische SEO en hero validatie

De in de opdracht genoemde SEO-fouten zijn op 30 september 2026 opnieuw gecontroleerd tegen de publieke server-HTML. De tegenstrijdige Browse-robots en dubbele metadata zijn bevestigd en lokaal hersteld. De bestaande hero is geoptimaliseerd met hetzelfde beeldmateriaal. Er is niets gepusht, gemerged of gedeployd: de productiebevindingen blijven daarom op de live site aanwezig totdat een afzonderlijke release wordt goedgekeurd.

De taalrouting is niet gewijzigd. Het [afzonderlijke NL en EN migratieplan](NL-EN-plan.md) is uitsluitend een voorstel. Taxonomie, categorieën, schema, productiedata, DNS en Vercel-instellingen zijn buiten deze wijziging gebleven.

## Bewijs en meetmethode

- [Productie vóór wijziging](production-before/audit.json): 48 anonieme HTTP-responses, inclusief ondersteunde en ongeldige Browse-parameters, negen paginatypen met Googlebot-achtige user-agent, Nederlandse taalheader en Nederlandse cookie. Geen JavaScript vereist voor de tagtelling.
- [Lokale productiebuild na wijziging](local-after/audit.json): dezelfde 48 aanvragen. Iedere uiteindelijke HTML-pagina heeft één robots-tag, één canonical en geen dubbele metadata-sleutels.
- [Productiesitemap](production-before/sitemap.xml) en [lokale sitemap](local-after/sitemap.xml): volledige lijsten, inhoudelijk gelijk.
- [Browsermetingen](browser-measurements.json), [bestandsformaten en bytes](image-sizes.json) en [testresultaten met commando's](validation.json).

`scripts/audit-server-seo.ts` haalt de oorspronkelijke response-tekst op. De inspecteur negeert scripts, styles en HTML-commentaar, zodat geserialiseerde React/RSC-tekst niet als extra HTML-meta-element wordt geteld. De ruwe publieke HTML is lokaal bewaard maar wordt niet gecommit. De audit volgt redirects; regressietests controleren redirectstatus en bestemming afzonderlijk zonder ze te volgen. Tellingen zijn steekproeven van route-implementaties, geen crawl van alle 2.541 boekpagina's.

## Bevindingen per auditclaim

Alle canonical-waarden hieronder gebruiken `https://lumisco.re`. I betekent `index, follow`; N betekent `noindex, follow`. Een herhaalde canonical had bij de onderzochte routes dezelfde bestemming, dus geen inhoudelijke canonical-tegenstrijdigheid.

| Route in productie | Robots vóór | Canonicals vóór | OG en Twitter vóór | Bestaande codebedoeling en resultaat na herstel |
| --- | --- | --- | --- | --- |
| `/` | 1 × I | 1 × `/` | Basisvelden 2 × | I; één homepage-canonical en één set sociale tags |
| `/browse` | 1 × N én 1 × I | 2 × `/browse` | Basisvelden 2 ×; ook verschillende titels, omschrijvingen en OG-URL | Schone pagina indexeerbaar volgens route-export en sitemap; nu uitsluitend I |
| `/browse?pageSize=32` | 2 × N | 2 × `/browse` | Als Browse | N behouden; één canonical naar schone Browse |
| `/browse?page=2` | 2 × N | 2 × `/browse` | Als Browse | N behouden; één canonical naar schone Browse |
| `/browse?genre=fantasy`, `?language=nl` | 2 × N | 2 × `/browse` | Als Browse | N behouden; ook lege, herhaalde, standaard- en onbekende parameters worden niet indexeerbaar |
| `/browse?sort=title`, `?category=fantasy` | 2 × N | 2 × `/browse` | Als Browse | Ongeldige/onbekende varianten blijven N; geen wijziging aan filterfunctionaliteit |
| `/collections` | 2 × I | 2 × `/collections` | Basisvelden 2 ×, met homepage-context naast collectiecontext | I behouden; eigen directory-context |
| `/collections?type=series` | 2 × N | 2 × `/collections` | Als collections | N behouden; directory-canonical |
| `/collection/a-court-of-thorns-and-roses` | 1 × I | 2 × eigen pad | Basisvelden 2 ×, met tegenstrijdige homepage-context | I behouden; collectienaam en omschrijving behouden |
| `/book/1` | 1 × I | 2 × eigen pad | Titel, omschrijving, afbeelding en Twitter-velden 2 ×; OG-type, site en URL 1 × | I behouden; boek, auteur, cover, article-type en eigen canonical behouden |
| `/over-ons` | 2 × I | 2 × eigen pad | Basisvelden 2 ×, inhoud gelijk | I behouden; Nederlandse/Engelse informatiecontext behouden |
| `/zo-werkt-het` | 2 × I | 2 × eigen pad | Basisvelden 2 ×, inhoud gelijk | I behouden |
| `/voor-uitgevers` | 2 × I | 2 × eigen pad | Basisvelden 2 ×, inhoud gelijk | I behouden |
| `/contact` | 2 × I | 2 × eigen pad | Basisvelden 2 ×, inhoud gelijk | I behouden |

De ruwe JSON bevat alle afzonderlijke OG/Twitter-velden en waarden; afbeeldingsafmetingen/alt waren doorgaans slechts één keer aanwezig. Op de homepage verschilden de twee OG-URL-strings alleen door de afsluitende slash, niet door een andere bestemming.

**Bevestigd:** de schone Browse verstuurde tegengestelde indexeringsinstructies. **Bevestigd:** dubbele canonicals en sociale metadata. **Weerlegd als algemene claim:** iedere onderzochte pagina zou tegenstrijdige robots hebben; de meeste duplicaten waren inhoudelijk gelijk. **Nog onzeker:** de feitelijke indexeringsschade, door Google gekozen canonical en eventuele rankinggevolgen. Hiervoor is geen Search Console-bewijs beschikbaar.

Aanvullend bevestigd: `/forgot-password` combineerde `noindex, nofollow` met `noindex, follow`; login, zoekpagina en wachtwoordherstel hadden geen canonical. De helper behoudt de strengere route-intentie voor wachtwoordherstel en het bestaande noindex-beleid voor persoonlijke/zoekroutes. De Taste Test blijft indexeerbaar. Beschermde pagina's zijn niet met een echt account of resetlink doorlopen.

404-pagina's gebruiken nu één door Vinext gegenereerde `noindex` en een request-relative canonical. Er wordt geen tweede robots-tag vanuit de boek-not-found-component toegevoegd. Vier foutpaden zijn getest, inclusief ongeldige boek-ID, ontbrekend boek, ontbrekende collectie en onbekende route.

## Oorzaak en exacte wijziging

De geïnstalleerde Vinext-versie is `1.0.0-beta.3`. `dist/shims/metadata.js` implementeert `MetadataHead` en `renderMetadataToHtml` voor robots, alternates, OG en Twitter; `dist/server/app-page-route-wiring.js` voegt deze metadata aan de server-render toe. De oude `LumiScoreMetadata.tsx` was een workaround voor een eerdere metadata-beperking en renderde dezelfde elementen nogmaals in JSX. Die renderer is verwijderd. `lib/seo/page-metadata.ts` maakt voortaan de volledige route-metadata; pagina's hebben geen tweede JSX-eigenaar meer.

Voor Browse werd de handmatige `noIndex` afgeleid van de navigatie-return-URL. `updateBrowseReturnPath` voegt de standaard `pageSize` toe, ook wanneer de bezoeker alleen `/browse` opvroeg. De officiële metadata keek juist naar de aangevraagde URL. De twee bronnen konden daardoor tegengestelde waarden produceren. SEO gebruikt nu uitsluitend de oorspronkelijke queryparameters; de navigatie-normalisatie zelf blijft ongewijzigd.

De bewuste keuze is: alleen parameterloze Browse is indexeerbaar; alle parameter-varianten zijn uitgesloten van indexering en houden de bestaande schone canonical. Dit is geen verzoek aan Google om uitgesloten pagina's alsnog te indexeren. Noindex wordt hier behouden als expliciete productkeuze voor varianten, niet ingezet als algemene methode om duplicaatsignalen te bundelen. Google behandelt canonical en noindex verschillend; canonical alleen is de gebruikelijke aanwijzing voor duplicaten die niet expliciet moeten worden uitgesloten. [Google over canonicalisatie](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

De sitemapcode hoefde niet te veranderen: die bevat al uitsluitend de schone Browse. Er staan exact 2.608 URL's in: 2.541 boeken, 59 collecties en 8 vaste routes (`/`, `/browse`, `/collections`, `/taste-test`, `/over-ons`, `/zo-werkt-het`, `/voor-uitgevers`, `/contact`). Geen queryvarianten, zoek-, login- of persoonlijke pagina's. Geen boek-URL is verwijderd of op noindex gezet.

De root-layout heeft een request-relative canonical als fallback voor foutpagina's; normale routes overschrijven die expliciet. Vinext serialiseert de homepage-canonical als `https://lumisco.re`, gelijkwaardig aan de sitemap-URL `https://lumisco.re/`. Boek-returnTo verandert geen SEO-identiteit. De bestaande 308 `/books/1` → `/book/1` en 307-beveiligingsredirects voor wachtwoordherstel en leesvoorkeuren zijn ongewijzigd en getest.

## Homepage afbeeldingen en mobiele LCP

De twee productie-PNG's zijn HTTP 200, ongecomprimeerd op transportniveau en byte-identiek aan de bronbestanden in Git. `scripts/optimize-home-hero.mjs` genereert met de vastgelegde Sharp-versie 0.34.5 AVIF (kwaliteit 60) en WebP (85), op 1024 en 1536 pixels breed. Geen uitsnede, andere afbeelding, kleurbewerking of nieuwe compositie. De bron-PNG's blijven beschikbaar voor reproduceerbaarheid maar worden niet meer door de hero geladen.

| Modus | PNG vóór in bytes | AVIF 1024 | AVIF 1536 | WebP 1024 | WebP 1536 |
| --- | ---: | ---: | ---: | ---: | ---: |
| Ink | 1.659.147 | 17.526 | 31.594 | 31.176 | 59.664 |
| Paper | 1.920.889 | 20.568 | 40.635 | 38.218 | 77.006 |

CSS kiest het ondersteunde formaat via `image-set`, met WebP-fallback. Vanaf 1100 CSS-pixels of DPR 1,5 wordt de 1536-versie gebruikt. Het bestaande vroege thema-script maakt uitsluitend op de homepage een high-priority AVIF-preload voor het actieve thema en de passende grootte. Het houdt rekening met een opgeslagen thema, systeemvoorkeur en geblokkeerde localStorage. In een browser zonder AVIF-ondersteuning wordt de preload door het type overgeslagen en gebruikt CSS WebP. Die oude-browserfallback is niet visueel getest.

De CSS-achtergrond blijft bewust behouden: dit bewaart de bestaande theme-switch, `cover`-uitsnede, mobiele 66%-positie en gradients zonder twee concurrerende thema-afbeeldingen te downloaden. De nameting zag per herlading precies één hero-request, initiator `link`, met de verwachte AVIF-URL. De mobiele transfermetingen waren 17.826 bytes Ink en 20.868 bytes Paper; dit is inclusief de door Resource Timing gerapporteerde protocoloverhead. De bovenstaande tabel vergelijkt bestand/body-bytes zonder die overhead.

| Mobiele labmeting | Drie runs vóór in ms | Mediaan vóór | Drie runs na in ms | Mediaan na |
| --- | --- | ---: | --- | ---: |
| Ink | 1344, 1472, 1200 | 1344 | 1016, 884, 640 | 884 |
| Paper | 1628, 1340, 1116 | 1340 | 856, 636, 636 | 636 |

Het LCP-element was in alle runs `DIV.hero-photo`. Methode: lokale productiebuild van de oorspronkelijke main en van de gewijzigde code, dezelfde ingebouwde Chromium-browser, 390 × 844, DPR circa 1, responses met `Cache-Control: no-store`, geen CPU- of netwerkvertraging. De uitsluitend lokale meetproxy injecteert identieke PerformanceObservers en buffert HTML; zij maakt geen deel uit van de productieapp. Catalogusresponsen en externe covers zijn niet deterministisch. Serverresponsverschillen beïnvloeden dus ook LCP; de mediane winst is geen geïsoleerd causaal effect van compressie.

Windows blokkeerde de agent-browser executable via toepassingsbeleid. Dat beleid is niet omzeild. De ingebouwde browser kon rechtstreeks productie visueel bekijken maar bood geen directe Performance API op die oorsprong. Daarom is **productie-LCP op een echte telefoon, Lighthouse-mobiele throttling en CrUX nog onzeker**. Dit rapport claimt uitsluitend de gemeten lokale labuitkomst. Voor de oude CSS-afbeeldingen ontbraken Resource Timing-entries; hun bytes zijn apart via HTTP gecontroleerd, niet geschat.

Visueel vergeleken: Ink en Paper op mobiel 390 × 844 en desktop 1440 × 1000; aanvullend Nederlandse Ink op 390 × 844 en Paper op 360 × 800. Compositie, uitsnede, teksten en layout bleven intact. Geen horizontale overflow, geen geobserveerde layout-shift-events en geen browserconsolefouten of waarschuwingen. De desktopbrowser selecteerde daadwerkelijk de 1536-AVIF's. Geen fysieke hoog-DPR-telefoon getest; de selectielogica is wel afgedekt door regressietests.

## Taalbevinding

Zonder taalheader/cookie geeft de server `lang=en` en Engelse interface/inhoud; met Nederlandse taalheader of cookie geeft dezelfde URL `lang=nl` en Nederlandse interface/inhoud. Dit is ook met een Googlebot-achtige user-agent bevestigd. De absolute stelling dat Googlebot alleen Engelse HTML kan krijgen is dus weerlegd; de standaardaanvraag krijgt wel Engels. Het gebruikte user-agent is een simulatie, geen geverifieerde aanvraag vanaf Google-infrastructuur. Welke varianten Google werkelijk heeft gecrawld of geïndexeerd blijft onzeker.

De code kiest een geldige `lumiscore-locale`-cookie vóór `Accept-Language`, en valt terug op Engels. Het root-HTML-attribuut en de content volgen die keuze. De gecontroleerde HTML-responses waren `no-store, must-revalidate`. Er is geen taalrouting- of cachebeleid aangepast. Google documenteert dat Googlebot geen `Accept-Language` meestuurt en adviseert afzonderlijke locale-URL's. [Google over locale-adaptieve pagina's](https://developers.google.com/search/docs/specialty/international/locale-adaptive-pages).

## Tests en builds

- 54 SEO-, navigatie-, taal-, informatie- en performance-contracttests geslaagd.
- 151 bestaande boek-, authenticatie- en collectie-/bibliotheektests geslaagd.
- 32 HTML-integratietests geslaagd, waaronder meerdere URL-varianten, NL-headers/cookies, redirectstatus én bestemming, sitemap en 404's.
- TypeScript `--noEmit`, ESLint en `git diff --check`: exitcode 0.
- Bestaande client-secret-scan: 88 bestanden in `dist/client` en `.vercel/output/static`, geen secret-identifiers of geconfigureerde secretwaarden aangetroffen. Deze builds gebruikten geen server-secrets; er kon dus geen vergelijking met echte productie-secretwaarden plaatsvinden.
- Standaard `vinext build`: geslaagd. Vercel-productiedoel via `VERCEL=1`, `VERCEL_ENV=production`, `NITRO_PRESET=vercel`, `vite build`: geslaagd. Lokale meetbuild via dezelfde Vinext/Nitro-configuratie en `NITRO_PRESET=node-server`: geslaagd. Geen deploycommando gebruikt.
- Bestaande bundlerwaarschuwingen over ineffectieve dynamische imports en plugin-timing; geen buildfouten. Vinext meldt de homepageclassificatie als onbekend bij statische analyse; de daadwerkelijke productie-render is afzonderlijk getest.

De React/Next-controle behield bestaande parallelle data-loads, request-cache en server/client-grenzen. De tijdelijke testomgeving gebruikt alleen de publieke URL/publishable key, geen beheersleutels. Enkele bestaande cover-cache-read-meldingen ontstonden server-side zonder beheerrechten; die zijn geen hero-/metadatafout en zijn niet via schema- of rechtenwijzigingen opgelost. Er zijn geen aanmeldingen, resetmails of schrijfacties uitgevoerd.

Herhalen: installeer de lockfile, bouw en start een lokale productieversie met de normale publieke configuratie. Zet `SEO_TEST_ORIGIN` op die lokale server en voer `pnpm test:seo-html` uit. Zonder oorsprong faalt dit commando expliciet; integratietests worden niet stil overgeslagen. Voor de visuele labmeting draait de productieversie op `127.0.0.1:3100` en `node scripts/seo-lab-proxy.mjs` op poort 3101. Gebruik die proxy nooit als deploymentserver.

## Branch en behoud van de oorspronkelijke werkruimte

Branch: `fix/seo-metadata-hero-20260930`. Basis: opnieuw gefetchte `origin/main`, commit `5a91c735db0b9b94181e0e525db8b265003b6ae2`. De wijziging is geïsoleerd onder `work/lumiscore-seo-hero-20260930` en alleen lokaal gecommit.

De oorspronkelijke werkruimte bleef op `0fa25cff7b751903bd26bb2eaaa091f1be05ba4b`, met dezelfde 95 statusregels en 93 niet-gevolgde bestanden. De samengestelde SHA-256 over status, tracked diff en niet-gevolgde bestandsinhoud was vóór en na gelijk: `1a9ed159ab2553169d1d2ca3e3b91989ca10b644c352bba349b76f52ca18e74a`. Geen oorspronkelijke bestanden zijn aangepast. Buildoutputs, ruwe HTML en lokale meetconfiguratie blijven genegeerde lokale artefacten.
