# SEO-daling: oorzaakonderzoek en regressiepreventie — 4 november 2026

**Conclusie:** de oorzaak van de foutieve metadata is bewezen; de volledige daling vanaf 25 oktober niet. Er is geen nieuwe productiebuild op 24–26 oktober gevonden. De metadatafout bestond al eerder. De beschikbare Googlebot-verzoeken tonen geen algemene blokkade, maar wel oplopende functieduur rond24–26 oktober. Zonder historische responsebodies en nieuwe Google-indexbeslissingen kan de bijdrage daarvan niet worden gekwantificeerd.

Dit is een afzonderlijk test-/onderzoekspakket vanaf main46ae50bce9603f8c0c847c9d300bf2a5258b41e2. Geen applicatie-, catalogus-, account-, rating-, voortgangs-, PR51-, dashboard-, social- of productie-instelling gewijzigd. PR74 en de drie prioriteitsbestemmingen blijven apart.

## Wat aantoonbaar is

- **Mechanisme:** LumiScore draait Vinext 1.0.0-beta.3/React 19.2.6/Vite 8.0.13/Nitro 3.0.260903-beta. Next 16.2.6 levert compatibele APIs; Vercels projecthint `nextjs` beschrijft niet de werkelijke build. `vercel.json` kiest framework:null en de Vinext/Nitro-build. Alle zeven onderzochte versies hebben dezelfde dependency-lockhash.
- Vinexts `server/streaming-metadata.js` gebruikt standaard de HTML-limited-botregex uit `utils/html-limited-bots.js`: InspectionTool past daarin, gewone Googlebot niet. Met de oude lege next.config worden async Metadata API-tags daarom voor gewone browsers/Googlebot na de head gestreamd. Dit is geen aangetoonde opzettelijke inhoudsvariant.
- **Oud/nieuw:**63 oorspronkelijke GETs op zes bewaarde versies/huidige productie. De bewaarde7-oktoberversie heeft een correcte statische homepagecanonical, maar een bodycanonical op boek8856 voor gewone/Googlebot-UA. Broncommit79026affc88b67cf4b7becb487f04c8305a23239 maakt root/home-metadata async en voert stabiele taalroutes in. Op de publiek gekoppelde PR17-versie b750486b7b981ffb080dc2a6af080959e203a64a van 9 oktober zijn ook de taalhomepages fout. Dezelfde fout reproduceert op 18,19 en 23 oktober; dus niet nieuw op 24/25 oktober en niet door PR42 van 19 oktober geïntroduceerd. Boekmetadata was al langer async; de vroegste historische productie-introductie daarvan is hiermee niet volledig vastgesteld.
- Dit zijn **reconstructies op 4 november met actuele data/configuratie**, geen opgeslagen oktoberbodies. Het gedeeltelijke GSC-fragment van de echte24-oktobercrawl is onafhankelijk historisch bewijs voor `/en`; het is geen volledige HTML-export. De gewone browser-DOM van de oude18-oktoberversie laat de canonical onder een DIV staan; de huidige DOM heeft hem in HEAD.
- **Reparatie reeds live:** PR69, head fc0df4d36b9c1bb9f1eb01fbe9be21e435d27a87, applicatie fc33bc0e5fb1feb95608d4cd4dcacea6194e6a3c, merge4d0d66b27b2026811b16486d85e1c1a1fb48208b. Publicatie2 november10:47:31.335UTC /11:47:31.335CET, deployment dpl_5f2maia3YPeDpZiRX4C4e7JhKmei. De platformactiviteit is apart getimestamped op 10:47:31.472UTC; dat is niet hetzelfde veld. `htmlLimitedBots: /.*/` houdt Metadata API-output voor alle UAs in de head; optionele body-Suspense blijft. Metadata wacht niet meer op een externe cover. Geen nieuwe concurrerende applicatiereparatie nodig.
- Actueel4 november: productie46ae50bce9603f8c0c847c9d300bf2a5258b41e2, dpl_DbrP399SVJeLGwP5YpDnqUFXtXDV, custom alias read-only bevestigd. **32/32** nieuwe cookie-vrije live responses: prioriteitsroutes NL/EN en legacy8856 met returnTo, desktop/mobile/Googlebot/InspectionTool. Unieke juiste canonical/hreflang in geldige head, geen onbedoelde noindex of duplicaten. Legacy308 en schone voorkeurscanonical bevestigd. UA-simulaties zijn geen echte Googlebezoeken.

## Uitrol → crawl → GSC

Volledige19 productieperiodes, IDs, URLs, volledige SHAs, vorige main-SHAs, commit/build/Ready/alias-eventtijden: [TIMELINE.md](TIMELINE.md) en [timeline.json](timeline.json).

| Gebeurtenis | UTC | Europe/Amsterdam | Betekenis |
|---|---|---|---|
| Eerste hier bevestigde publieke taalhomepageversie PR17 |9 okt10:24:24.437|12:24:24.437CEST|b750486; metadatafout reconstructeerbaar. Eerdere tijdelijke10:13-build alleen op Vercel-alias, niet gelijkgesteld aan lumisco.re.|
| PR41-positionering |18 okt20:44:25.070|22:44:25.070CEST|8f337dd; fout reeds aanwezig.|
| PR42-home/coverstreaming |19 okt19:31:47.337|21:31:47.337CEST|385948b; eerdere fout blijft, geen dependency/config-bump.|
| Laatste productie-assignment vóór daling, PR55 |23 okt19:28:03.600|21:28:03.600CEST|2651c364eb879dc6ec7416034744b3e947458449; wachtwoordherstel. Vier builds die dag: PR52–55; relevante verschillen zijn bekeken.|
|24–26 oktober|geen build/activiteit gevonden|zomertijd eindigt25 okt01:00UTC|Lege all-types-activiteitsquery; geen bewijs dat iedere externe DNS/WAF/providerwijziging uitgesloten is.|
|Begin GSC-prestatiedag25 oktober|25 okt07:00|08:00CET|00:00America/Los_Angeles, nog PDT. GSC-inspectie-UI-tijden zonder bewezen zone niet omgerekend.|
| Volgende productie-assignment, PR56 |28 okt19:37:30.462|20:37:30.462CET|0c0470e; nieuwe toplijsten, na het omslagpunt.|
| Metadatarelease PR69 |2 nov10:47:31.335|11:47:31.335CET|Werkelijk publicatiemoment voor volgende GSC-crawls.|

Alias-events zijn deployment-breed, gekoppeld aan de bewaarde domeinlijst. Ze geven geen volledige atomische per-domein-audithistorie. Een Ready-build is nergens zelfstandig als publieke omschakeling gebruikt. Git/source-/deploymentverschillen zijn gescheiden. De later gecontroleerde SHA9c74ecaa van 3 november is niet het oorspronkelijke PR69-releasemoment.

GSC-exporthashes zijn gecontroleerd:2.486→115 vertoningen en 27→0 klikken,18–24 versus25–31 oktober, Pacific Time. Crawl-export:1.314→185 verzoeken op de gerapporteerde datums; tijdzone van die afzonderlijke CSV-dagen niet onafhankelijk bewezen. De indexrapportage stopte op 23 oktober. De 15-oktobercrawl met Googlecanonical `/book/8856` bewijst geen nieuwe de-indexering op 25 oktober. Alle 5 ZIP-hashes en grenzen staan in gsc-and-requests-daily.json; afgekapt pagina-/query-exportmateriaal is geen volledige populatie.

## Logdekking en wat de verzoeken zeggen

| Bron | Werkelijk beschikbaar | Grens |
|---|---|---|
| Deployment-/aliasactiviteit |19 productiebuilds18 okt–eerste grens1 nov; aanvullende7/9-oktoberversies en PR69-release|Commit, Ready en assignment zijn verschillende instanten; geen volledige externe configuratiehistorie.|
| Vercel requestaggregaties |18 okt00:00–1 nov00:00UTC; Googlegroepen onder100-groepslimiet|Geen raw access-logexport, responsebody of individuele requestlatency; sampling/retentiegarantie niet in respons opgegeven.|
| Googlebot-identiteit A |1.176 provider-geclassificeerde verzoeken;34 IP-groepen passen op 4 november in officiële common-crawlers-CIDRs|Huidige IP-ranges bewijzen historische allocatie niet perfect; verificatiemethode/datum/hash vastgelegd.|
| Inspectie B |440 provider-geclassificeerde InspectionTool-verzoeken, apart gehouden|Niet automatisch Googlebot-crawls; geen onafhankelijke IP-check voor deze groep geclaimd.|
| Onbevestigde UAs C |12 Googlebot-UA- en 4 InspectionTool-UA-verzoeken zonder providerclassificatie|Kunnen simulaties zijn; niet als echte crawls geteld. Geen onbevestigde bezoekers-IP’s in het reviewpakket.|
| Runtime-console |Huidige historische zoekquery leeg; eerder vastgelegd1 browse-timeout24 okt09:14:26.135UTC op PR55|Geen volledig edge-/CDN-register; leeg betekent niet nul historische bots/fouten.|
| WAF/config/drains |Actieve custom-configquery404; geen huidige drains gevonden; beschikbare Google-UA-requestregels staan op allow|Default beveiliging is daarmee niet uitgeschakeld bewezen; geen volledige historische WAF-audit of afwezigheid van vroegere drains.|

Van 1.176 geclassificeerde Googlebot-verzoeken:935 HTTP200,239 HTTP308,2 HTTP404; geen 5xx/429/403 in deze opgehaalde groepen. Daarvan zijn1.115 op lumisco.re;61 redirects op andere bestaande domeinen. Alle opgehaalde Google-UA-requestgroepen hebben WAF-action allow. Prioriteitsgroepjes geven200/MISS/allow voor onder meer de homepages; een ontbrekende rij voor een boek/leesroute bewijst niet dat Google die nooit bezocht. HTTP200 bewijst niet dat de HTML inhoudelijk compleet of correct was. Retained responses zijn no-store/MISS; geen concrete gedeelde UA-cachevervuiling aangetoond.

**Tijdzonegrens:** `--bucket-timezone` wordt door de beschikbare nieuwe API geweigerd. Aangevraagde historische1h-vakken worden zelfs bij 84h-vensters naar4h afgerond, inclusief start/eindgrenzen. Die antwoorden zijn bewaard maar uitgesloten van exacte Pacific-Time-weekberekeningen. Geen dagtotalen pro rata verdeeld en geen exact GSC/Vercel-crawlpercentage uit ongelijksoortige populaties berekend.

Functieduur voor Googlebot-UA op de zes geverifieerde primaire-domein-IP’s:543 HTTP200-invocations,18–31 oktoberUTC; p50 165,32ms, p95 3.595ms. Per UTC-dag:23 okt n=27/p50 337/p95 1.552ms;24 okt n=57/699/4.164ms;25 okt n=69/1.065/4.200ms;26 okt n=42/1.062/4.208ms. Dit is serverfunctie-uitvoeringsduur, niet netwerk-TTFB, paint of volledige edgeverzoeken. Veranderde routemix en kleine dagpopulaties verhinderen een zuivere voor/na-per-paginaconclusie. De timeout en hogere staartduur maken beschikbaarheid een relevante mogelijke bijdrage, geen bewezen verklaring van alle zichtbaarheidsterugval.

## Hypothesen

| Hypothese / verwachte waarneming | Voor | Tegen / ontbreekt | Oordeel |
|---|---|---|---|
|Streaming maakt canonicals/hreflang onbruikbaar|Oude originele bytes, DOM, GSC-fragment24 okt; oude configuratie faalt deterministisch|Al veel eerder aanwezig; geen Google-experiment dat95,4% verlies hieraan toeschrijft|Mechanisme bewezen; bijdrage aannemelijk, omvang onbekend.|
|Nieuwe24/25-oktober-codewijziging veroorzaakt omslag|Geen positieve build-/codewaarneming|Geen productiebuild of platformactiviteit24–26; laatste wijzigingen23 okt auth/covers/teksten, dezelfde lock/config|Niet ondersteund; externe ongeregistreerde verandering niet volledig uitgesloten.|
|Legacy-/taalcanonicalverwarring|Google koos legacy8856 op 15 okt; locale-introductie9 okt; ontbrekende signalen|Snapshot vóór daling; huidige308/reciprocity correct. Oude bewaarde hostreturns307 zijn geen archief van custom-domain redirects|Historische signalenzwakte bewezen; geen nieuwe25-oktoberregressie bewezen.|
|WAF/robots/status blokkeren Google|Te toetsen met deny/429/5xx/robotsverandering|Beschikbare geverifieerde groepen200/308/404 en allow; geen relevante robotsbronwijziging|Algemene blokkade niet aangetoond; historische configuratiedekking beperkt.|
|Bronuitval/latency/soft200 of inhoudselectie|Browse-timeout24 okt; functiestaart rond4s; bronfallbacks kunnen onderdelen missen|Geen bewaarde Google-responsebody of requestgebonden completenessbewijs25–31;200 is geen inhoudbewijs|Open mogelijke bijdrage; geen brede nieuwe applicatiereparatie zonder reproduceerbare resterende fout.|
|Zoekvraag/ranking/indexselectie of rapportage|Brede merk/nonmerk-/land-/apparaatdaling, vertraagd indexrapport|Export/privacygrenzen; geen gemeld incident in eerdere controle; algoritmische beslissingen onbekend|Open. Geen penalty, volledige de-indexering of causaal rankingherstel geclaimd.|

## Gerichte preventie en tests

Alleen scripts/CI/onderzoeksbewijs wijzigen; runtimebestanden blijven identiek aan huidige main.

- Aangetoonde checkerleemte: de oude parser beschouwde een canonical na een ongeldige `<img>/<div>/<iframe>` vóór de expliciete `</head>` nog als headmetadata. Parser verwerpt dit nu; inert template-inhoud breekt een volgende geldige tag niet.8 parsertests groen, inclusief bestaande script-/comment-/UTF8-/duplicate-/body-/tweede-headgevallen.
- **165 werkelijke lokale Vinext-responses**: de bestaande150 plus15 echte legacyredirectgevallen; drie paden ×vijf UAs, incl.returnTo,308, ongewijzigde query en clean canonical. Langzame2s-bronnen, ontbrekende/temporair falende beschrijving, publieke/privé/noindex/404-regels behouden.25 SEO/locale-tests, TypeScript en gerichte lint groen.
- **9 negatieve gevoeligheidscontroles**: echte loopbackrouter met alleen de pre-PR69 lege nextConfig. Gewone/Googlebot-responses worden6/6 afgewezen; InspectionTool levert3/3 wel headmetadata. CI toetst nu zowel de goede als de aantoonbaar foute variant. De fault-mode bestaat alleen in de bestaande geïsoleerde testadapter; geen productieschakelaar. Bij toekomstige frameworkwijziging deze oude foutfixture opnieuw beoordelen.
- Handmatige postdeploymentcheck: `python scripts/operations/verify-production-seo.py --sha <via alias geverifieerde40hex-SHA> --deployment <id> --output <bewijsmap>`.32 begrensde GETs, originele bytes/heads, mobile/desktop/Googlebot/InspectionTool, echte legacyredirect. SHA/deployment vóór én na via bestaande Vercel-toegang controleren; uit HTML zelf wordt geen SHA verzonnen. Geen tweede periodieke monitor.
- Nieuwe livecontrolematen n=32: mediane headerontvangst198,6ms, complete head205,7ms, eerste H1-bron205,7ms, volledige response306,5ms. Geen browserpaint/LCP, geen gegarandeerd koude samples, geen snelheidseffect van dit test-only pakket. Eerdere gecontroleerde PR69-voor/nametingen blijven afzonderlijk geldig; er is nu geen nieuwe appwijziging die de productie kan vertragen.

## Overdracht en grenzen

Voor SEO: koppel nieuwe opgeslagen crawls aan **PR69-publicatie2 nov10:47:31.335UTC**, niet alleen aan de SHA van een latere controle. Actuele productie46ae50b /dpl_DbrP399SVJeLGwP5YpDnqUFXtXDV. De2 NL-uitlegpagina’s zijn volgens Rick4 november ingediend; homepages3 november; sitemap4 november geaccepteerd. Geen herhaalde aanvragen of sitemapinzendingen uitgevoerd. Een nieuw opgeslagen Google-crawl-/canonicalbesluit na de release is de volgende relevante waarneming; een oude snapshot is geen tegenbewijs van de livefix.

De volledige daling kan met het aanwezige materiaal niet aan één oorzaak worden toegewezen. Ontbrekend: Google-responsebodies/indexkeuzes uit 25–31 oktober en gegarandeerd volledige historische request-/WAF-dekking. Onderzoek is daarmee begrensd, niet stilzwijgend afgerond als causale verklaring. Er zijn geen nieuwe rechten of credentials nodig voor het voltooide technische preventiepakket.

Eventuele supportvraag, **niet verstuurd**: “Kunnen jullie voor project prj_44WeKduJU042ZAI85eAifSWwoY0i de historische metricdekking/sampling en beschikbare request-/WAF-/runtimearchieven van 23–26 oktober bevestigen? De bestaande Observability-API rondt aangevraagde1h-vakken voor 18–21 oktober af naar4h en ondersteunt bucketTimezone niet. Bestaan de oorspronkelijke request-/redirect-/latencyrecords nog, zonder nieuwe loggingdienst, rechtenuitbreiding of terugwerkende constructie? Wij vragen geen cookies, Authorization, tokens of gewone bezoekersprofielen.”

Reviewvolgorde: test-/bewijs-PR beoordelen; actuele CI en runtime-ongewijzigdcheck bevestigen; eventueel afzonderlijk akkoord voor merge. Geen productiepublicatie uitgevoerd of automatisch vrijgegeven. Herstel van dit pakket: uitsluitend deze test-/bewijscommit terugdraaien; PR69, PR51 en de inhoudsreleases blijven behouden. Geen databaseherstel nodig.

## Reproduceerbare bronnen

- Eigen bewijs: timeline.json; reconstruction-matrix.json; browser-dom.json; current-live-matrix.json; google-ip-verification.json; google-*.json; timezone-query-limits.json; gsc-and-requests-daily.json. Volledige eigen HTTPbytes blijven lokaal onder outputs/seo-cause-20261104; reviewpakket bevat hashes/posities, geen gekopieerde boekteksten.
- Historische GSC-map: social-media/search-console/20261102; LIVE-CONTROLE/verification-summary20261103; indexering/manifest en gebruikersbevestiging20261104. sources/ en deze projectbronnen niet gewijzigd.
- [Google-verificatiemethode](https://developers.google.com/crawling/docs/crawlers-fetchers/verify-google-requests), [huidige common-crawler-ranges](https://developers.google.com/static/crawling/ipranges/common-crawlers.json), [geldige metadata](https://developers.google.com/search/docs/crawling-indexing/valid-page-metadata), [canonical in head](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls), [GSC-datagrens](https://support.google.com/webmasters/answer/96568?hl=en), [Vercel-runtime-loggrenzen](https://vercel.com/docs/logs/runtime), [htmlLimitedBots](https://nextjs.org/docs/app/api-reference/config/next-config-js/htmlLimitedBots). Vinextbeta.3-gedrag is daarnaast tegen de werkelijk geïnstalleerde module en bewaarde runtime gecontroleerd.
