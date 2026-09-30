# Voorstel voor vaste Nederlandse en Engelse LumiScore URLs

Dit is een afzonderlijk migratievoorstel, niet geïmplementeerd in de SEO- en hero-wijziging. Het doel is een vaste taal per URL, zonder bestaande links, boek-ID's, collectiecontext of persoonlijke navigatie te verliezen. Uitvoering vereist een apart besluit en Search Console-baseline.

## Waarom een aparte wijziging nodig is

De huidige server kiest Nederlands of Engels op basis van cookie en taalheader op dezelfde URL. De uitgevoerde HTTP-proeven tonen beide talen aan; een standaardaanvraag zonder voorkeur geeft Engels. Google documenteert dat zijn crawler geen `Accept-Language` meestuurt en dat daardoor niet alle locale-varianten ontdekt worden. Dat ondersteunt het risico, maar bewijst niet wat voor LumiScore al geïndexeerd is. [Google over locale-adaptieve pagina's](https://developers.google.com/search/docs/specialty/international/locale-adaptive-pages).

## Voorgestelde routeafspraken

Een expliciete `/nl/`- of `/en/`-prefix bepaalt altijd de servertaal, ongeacht cookie, IP of user-agent. UI, `<html lang>`, titel en omschrijving volgen dezelfde keuze. Geen automatische omleiding op basis van vermoedelijke taal; de gebruiker krijgt normale links naar de andere versie. Dit is een voorstel om te bespreken, niet een al genomen productbesluit.

| Huidige identiteit | Nederlandse URL | Engelse URL |
| --- | --- | --- |
| Homepage | `/nl/` | `/en/` |
| Browse | `/nl/browse` | `/en/browse` |
| Collectiedirectory | `/nl/collections` | `/en/collections` |
| Informatie, bijvoorbeeld contact | `/nl/contact` | `/en/contact` |
| Bestaande informatie-slugs | `/nl/over-ons`, `/nl/zo-werkt-het`, `/nl/voor-uitgevers` | Dezelfde slugs onder `/en/`; vertalen van slugs is niet noodzakelijk |
| Collectie-identiteit, latere fase | `/nl/collection/{slug}` | `/en/collection/{slug}` |
| Boekidentiteit, alleen na afzonderlijk besluit | `/nl/book/{workId}` | `/en/book/{workId}` |

Behoud bestaande workId's en collectie-slugs. Maak geen nieuwe boekidentiteit of editie-identiteit door alleen een taal te kiezen. Een interfacevertaling maakt een onvertaalde boekomschrijving niet automatisch tot volwaardige nieuwe taalcontent. Beoordeel de contentgereedheid van boeken afzonderlijk voordat duizenden alternatieve URL's worden gepubliceerd; geen automatische bulk-noindex of bulkverwijdering uit de bestaande sitemap.

## Canonicals en hreflang

Een volwaardige indexeerbare NL-pagina krijgt één zelfverwijzende NL-canonical, de EN-pagina één zelfverwijzende EN-canonical. Verwijs niet alle Nederlandse vertalingen canoniek naar Engels. Publiceer op beide versies een wederkerige en zelfinclusieve set absolute `hreflang=nl` en `hreflang=en`-links. Een eventueel `x-default` kan naar de goedgekeurde Engelse fallback wijzen. Gebruik alleen werkelijk bestaande, bereikbare tegenhangers. [Google over taalalternatieven](https://developers.google.com/search/docs/specialty/international/localized-versions).

Beheer de mapping op één plek en genereer daaruit zowel metadata als taalwissellinks. Geen bot-specifieke HTML. Houd het bestaande noindex-beleid voor zoek-, persoonlijke en Browse-parameterroutes in beide talen gelijk; canonical van een Browse-variant blijft de schone Browse in dezelfde taal. Ontbrekende content blijft een echte 404 en geen redirect naar een irrelevante homepage.

## Sitemap en behoud van bestaande links

Publiceer in de sitemap de canonieke, indexeerbare 200-URL's van de goedgekeurde migratiefase. Beide echte taalversies krijgen een eigen URL-entry. Gebruik HTML voor de hreflang-sets; een tweede XML-hreflang-implementatie is niet nodig. Niet-gemigreerde boeken en collecties blijven op hun huidige URL in de sitemap.

Maak vooraf een volledige mapping van oude naar nieuwe bestemmingen. Voor ongetaalde legacy-URL's is één stabiele, expliciet goedgekeurde bestemming nodig. Engels is een mogelijke keuze vanwege de huidige cookieloze standaard, maar controleer verkeer, backlinks en taalintentie eerst in Search Console. De bestemming mag niet wisselen op basis van cookie of Googlebot-detectie.

Voer pas na goedkeuring permanente, éénstaps-redirects in voor de betreffende oude routes. Houd redirects langdurig beschikbaar en voorkom ketens: ook `/books/{id}` moet uiteindelijk direct bij de goedgekeurde canonieke boek-URL uitkomen. Bewaar veilige queryparameters voor navigatie, en inventariseer ankers en bookmarks. Raak auth-callbacks, herstel-URL's en accountflows niet automatisch aan; valideer hun allowlists en absolute callbacks afzonderlijk voordat een toekomstige uitbreiding ze kan beïnvloeden.

## Taalwissel en navigatiecontext

De taalwisselaar wordt een echte crawlbare link naar hetzelfde boek, dezelfde collectie of dezelfde informatiepagina in de andere taal. Een cookie mag de voorkeur onthouden, maar niet de inhoudstaal van een expliciete locale-URL overschrijven. Bewaar toegestane paginering, filters en sortering. Vertaal veilige interne `returnTo`-paden via de mapping; externe of ongeldige waarden blijven geweigerd. Bij een ontbrekende taaltegenhanger geen verzonnen hreflang of stille identiteitssprong: communiceer de beschikbare taal en gebruik de bestaande content-URL.

## Gefaseerde uitvoering en vrijgave

1. Verzamel Search Console-data over verkeer, canonicals, indexering en taal-/landverdeling; inventariseer alle huidige interne links, redirects en sitemap-URL's. Leg de legacy-bestemming per routeklasse vast.
2. Bouw de locale-resolver en route-mapping op een aparte featurebranch. Begin met homepage en vier informatiepagina's. Gebruik bestaande vertalingen; geen taxonomie-, data- of domeinwijziging in dezelfde release.
3. Test in een afgeschermde preview de uiteindelijke server-HTML: één robots/canonical, juiste taal onafhankelijk van headers/cookies, wederkerige hreflang, beide thema's, sitemap, taalwissel, 404 en éénstaps-redirects. Test boek- en collectie-returnTo-contracten vóór uitbreiding naar die routes.
4. Vraag expliciete vrijgave voor de kleine pilot. Publiceer locale-routes, interne links, canonicals, redirects en sitemap als samenhangende wijziging. Geen gedeeltelijke rollout waarbij canonicals naar nog ontbrekende URL's wijzen.
5. Controleer na vrijgave statuscodes, zoekverkeer, door Google gekozen canonicals en indexeringsdekking. Beslis op basis daarvan over Browse, collecties en uiteindelijk boeken. Leg een rollback vast die routes en oude links bereikbaar houdt; wissel permanente redirects niet herhaaldelijk heen en weer.

Geen van deze migratiestappen is met de huidige opdracht uitgevoerd. Het plan bevat geen belofte over rankings, rich-resultsterren of indexeringssnelheid.
