# PR17 — routecompatibel applicatieherstel, lokaal gereed

Datum: 8 oktober 2026. Releasebron: `4fb96c77934c6c4d34ea849e62353b3c9d63697c`.
Vorige applicatiebasis: `7f5ad98524887d920ba1ac8f04fd0d3238d66408`.
Herstelbranch: `recovery/seo-locales-compatible-20261008`.
De definitieve herstel-SHA en tree worden na commit gebonden in het bestaande externe releasevoorstel; dit document behoort zelf tot die commit.

## Precieze werking en grens

Dit is geen blinde checkout van de oude basis. Het bewaart de vorige applicatiefuncties, PR15/PR16-styling, compacte smaaktest/uitslag, ratings en voortgang, met de noodzakelijke reeds gereviewde taalcompatibiliteit uit PR17. Alle `/en`- en `/nl`-bestemmingen blijven echte pagina's. Metadata, sitemap, taalwissel, querycontext, veilige aanmeldbestemmingen en cookie-/cachecompositie blijven behouden. Geen database-, Auth-, package-, lockfile- of platformconfiguratiewijziging.

Alleen vier runtimebestanden verschillen van de release: de proxy gebruikt tijdelijke 307/no-store-redirects, de boekpagina en detailcomponent wachten niet meer op een synopsis, en de beschrijvingscomponent herneemt de eerdere asynchrone client/API-opvraag. De reviewed bron-/taalcontrole, attributie en eerlijke fallback blijven behouden. De onderliggende resolver, API, robotsblokkade, privacy B en autorisatie wijzigen niet. Een optionele bronfout verhindert daardoor niet het openen van het boek.

**Bewuste herstelconcessie:** beschikbare synopsis staat in deze versie niet meer in de oorspronkelijke server-HTML, alleen de fallback. SEO-002 kan bij herstel tijdelijk terugkeren; de herstelversie mag niet als oplossing voor beide SEO-Criticals worden aangemerkt. SEO-001 blijft compatibel. Dit artefact is evenmin een bewezen oplossing voor iedere denkbare fout in de behouden taal-/sessielaag. Als een regressie juist daarin zit en dit artefact haar reproduceert, niet blind omschakelen: release tegenhouden of een apart gereviewde minimale forward-fix gebruiken.

Browsers kunnen een eerdere 308 blijven uitvoeren zonder de oude URL op te vragen. Daarom nooit `/en/book/{id}` terug naar `/book/{id}` redirecten. Nieuwe legacy-redirects in deze herstelversie zijn 307 met `Cache-Control: no-store`. De bestaande Vinext-normalisatie van bijvoorbeeld `/nl/` naar `/nl` gebeurt vóór de proxy en blijft 308; ook die bestemming wordt blijvend bediend. Serverheaders kunnen geen reeds opgeslagen browserredirect wissen. Browsercache wissen is geen herstelstrategie.

## Nieuw gericht bewijs

- 91/91 tests: echte clientbeschrijvingscomponent met gecontroleerde hook/HTTP-adapters; optionele fout, verkeerde taal/bron, afgebroken oude aanvraag, geen dubbele request; bestaande resolver-, i18n-, Auth-, cookie- en terugnavigatiecontroles.
- 28/28 echte loopback-HTTP-tests op Vinext met synthetische loaders: oude links → vaste bestemming, rechtstreeks EN/NL home/Browse/boeken/collectie/login/smaaktest/uitslag, querybehoud, hoogste-score-terugkeer, juiste locale/canonical, echte onbekende boeken blijven404. Loginformulier gebruikt de neutrale Auth-actie en juiste taalbestemming. Bestaande slashnormalisatie en neutrale API/robots blijven intact.
- De permanente-cache-situatie is getest door de daadwerkelijke omgeleide bestemmingen rechtstreeks op te vragen; geen echte browsercache of hosted CDN nagebootst als bewijs. Proxytest voert de echte proxycode met synthetische sessieadapter uit en controleert vernieuwde requestcookies, responsecookies en private cacheheaders. Dit is geen echte Auth-login/recoverytest.
- TypeScript, volledige ESLint, Vinext-build, lokale Vercel-bundelbuild, client-secretscan (128 bestanden, nul secret-identifiers/-waarden) en diffcontrole zijn geslaagd. De Vercel-bundelbuild slaagde onder de normale bevoegde Windowsidentiteit na de beschreven sandbox-readlinkfout. Nitro meldt optionele, niet gebruikte traceInclude-pakketten; exitstatus0 en de Vercel-serverfunctie zijn aanwezig. Geldig releasebewijs en aangeleverde HTML/sitemap zijn niet opnieuw onderzocht.

De bestaande SSR-only assertion in `description-resolution.test.ts` is uitsluitend op de herstelbranch veranderd in het expliciete client-recoverycontract; resolver-/taal-/bronassertions blijven staan. Het releasepakket en zijn SSR-tests zijn onaangeroerd. `DetailPreview` kreeg uitsluitend de noodzakelijke prop-aanpassing. Testloaders en hersteltests worden niet in de applicatie gebruikt.

## Reproduceerbare lokale build

Werkruimte: `C:/Users/rickg/Documents/Codex/2026-09-18/ga-x20/work/lumiscore-seo-recovery-20261008`.
Node `v24.20.0`, pnpm `11.24.0`, lockfile SHA-256 `96b1c52fa5b021a784e65c54b13117b80469cdd11863ae3d75b22484e42c0ebb`.
`pnpm install --offline --frozen-lockfile --ignore-scripts` gebruikt de bestaande lokale store; 521 pakketten, nul downloads. Eigen node_modules, geen junction naar een andere werkruimte.

Van de exacte herstelcommit, zonder `.env` of application-secrets in het buildproces:

```powershell
node --experimental-strip-types --test scripts/seo-recovery.test.ts 'lib/i18n/*.test.ts' 'lib/navigation/*.test.ts' 'lib/auth/*.test.ts' 'lib/books/*description*.test.ts'
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js . --ignore-pattern dist --ignore-pattern .next
node node_modules/vinext/dist/cli.js build
```

Voor lokale routingcontrole, apart proces: `node scripts/seo-critical-local.mjs --port=3123`; daarna `node --experimental-strip-types --test scripts/test-seo-recovery-html.mjs`. Uitsluitend loopback en synthetische gegevens; geen externe requests, accounts of writes.

Voor de lokale Vercel-bundel zet alleen in dat buildproces `VERCEL=1`, `VERCEL_ENV=preview`, `NITRO_PRESET=vercel`; voer `node node_modules/vite/bin/vite.js build` uit, daarna `node --experimental-strip-types scripts/scan-client-secrets.ts`. Dit bewijst compilatie zonder productiecredentials, **niet** een productiegericht of hosted herstelartefact. De productie-buildguard blijft intact en weigert ontbrekende productieclientconfiguratie. Sandbox-Nitro-tracing kan `EPERM readlink C:/Users/rickg` geven; dezelfde lokale build mag dan onder de normale bevoegde Windowsidentiteit, zonder ACL/configuratieaanpassing, opnieuw draaien. Niet als applicatiefout of succesvolle sandboxbuild rapporteren. Buildoutputs staan uitsluitend in genegeerde lokale mappen; geen bitidentieke binaire hashgarantie over verschillende builds.

## Gebundelde latere hosted herstelgate — nog niet uitgevoerd

Deze lokale toestemming dekt geen push/deployment. Het definitieve productieakkoord moet ook de **exacte herstelcommit** en één niet-live, Production-gerichte hersteldeployment met bestaande instellingen omvatten. Geen testgerichte Previewbuild naar productie promoveren. Geen nieuwe configuratie, resources, migrations of testaccounts nodig.

Vóór merge van PR17:

1. Verifieer source-SHA/tree, bestaande Vercel-team `rgkgroeneveld-9102`/project `lumiscore`, huidige domeinbinding en bestaande productieclienttarget `qvplwejffhjvxaypmjut`. Bestaande toegang gebruiken, waarden niet tonen. Nul datawrites/migraties.
2. Onder exact goedgekeurde herstelcheckout één officiële Vercel `deploy --prod --skip-domain`: bouw met bestaande Production-variabelen, zonder domeintoewijzing. Exacte CLI-versie en toegang vooraf vastleggen; lokaal is nu geen bestaande CLI beschikbaar. Een officiële bevoegde MCP-route mag dezelfde niet-live workflow uitvoeren als die aantoonbaar ondersteund is. Geen Preview-promotie, geen auto-main-push, geen force, geen security-bypass improviseren.
3. Bind Ready-deployment-ID aan herstel-SHA en **Production-target**, zonder `lumisco.re` eraan toe te wijzen. Via bestaande toegestane geauthenticeerde toegang uitsluitend publieke leescontroles: oude boeklink/query → tijdelijke vaste bestemming, rechtstreeks `/en/book/{bestaand-id}` en `/nl/book/{id}`200, geen lus, juiste taal/terugkeercontext/loginbestemming; home en Browse. Dezelfde vaste bestemmingen bewijzen bereikbaarheid voor een browser met oude308. Werkelijke browsercache/CDN- en productieconfiguratiecontrole kunnen niet lokaal worden afgevinkt.
4. Behoud het geldige hosted testbewijs voor login/smaaktest/aanbevelingen uit de release; geen bestaande ratings wijzigen en geen productie-testlogin uitvoeren. Als een specifiek nieuw hosted sessiebewijs toch vereist blijkt, geldt alleen een bestaande toegestane testsessie op een aantoonbaar testgerichte omgeving; scope-uitbreiding niet veronderstellen.
5. Bij een ontoegankelijke hersteldeployment of mislukte route-/targetcheck **niet mergen**. Bestaande bescherming behouden; geen afgewezen toegang omzeilen. Dat is een uitvoergate in het gebundelde voorstel, geen nu uitgevoerde hosted controle.

## Concrete uitvoering bij bewezen release-regressie

Stop verdere releaseacties en noteer fase, fout en data-impact. Gebruik uitsluitend de vooraf Ready/geteste **Production-gerichte hersteldeployment**, niet de oude taal-onbewuste basisdeployment. Controleer opnieuw herstel-SHA, target en artefact-ID. Officiële `vercel promote <herstel-deployment-id>` schakelt naar die eerder gebouwde Production-versie zonder Preview-rebuild; dit is applicatieherstel. Controleer domeinbinding/status, oude en vaste taalboekroutes, queries, publieke home/Browse en de fallback. Bewaar alle nieuwe ratings/voortgang. Geen databaseherstel, down-migratie, tabelverwijdering, Auth/DNS/configuratiefix of browsercache-wisopdracht.

Leg vast dat herstel SEO-002 tijdelijk terugbrengt en opnieuw releasebeoordeling vereist voor een vervolgreparatie. Vercel `rollback` kan automatische domeintoewijzing stoppen; dit plan gebruikt de vooraf geteste Production-hersteldeployment via de officiële promotieroute. Eventuele onverwachte platformtoestand niet improviserend corrigeren. Als het herstelartefact dezelfde regressie vertoont of niet Ready is: niet naar de oude 404-veroorzakende basis terugrollen; exacte afwijking rapporteren en afzonderlijk herstelbesluit vragen.

Officiële bronnen: [Vercel staged deployment/promotie](https://vercel.com/docs/deployments/promoting-a-deployment), [Vercel rollback](https://vercel.com/docs/deployments/rollback-production-deployment), [Supabase SSR-cookies/cache](https://supabase.com/docs/guides/auth/server-side/creating-a-client), [RFC9110 permanente308](https://datatracker.ietf.org/doc/html/rfc9110#section-15.4.9).
