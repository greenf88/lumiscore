# Soft 404 · Dark Heritage en Domain-Driven Design

Scope: twee nieuwe gecontroleerde Engelse samenvattingen in de bestaande centrale opslag. Geen Work-, editie-, route-, taal- of indexeringswijziging. Geen productieschrijfactie, sitemapinzending of indexeringsaanvraag.

| Oude URL | Publieke keten vóór | Laatste opgeslagen crawl | GSC-livetest op 10 november (CET) | Exacte editie |
| --- | --- | --- | --- | --- |
| `/book/9733` | 308 → `/en/book/9733` 200, index/follow en self-canonical | 25 oktober 01:43:56, Soft 404 | 08:34, Soft 404, opgegeven canonical `/en/book/9733`. Googles screenshot toont de juiste titel, auteur en cover. | 9892, Harlequin, EN, 9780373106301 |
| `/book/4873` | 308 → `/en/book/4873` 200, index/follow en self-canonical | 24 oktober 21:58:49, Soft 404 | 08:36, Soft 404, opgegeven canonical `/en/book/4873`. Googles screenshot toont de juiste boekcover. | 5032, Addison-Wesley, EN, 9780321125217 |

De oorspronkelijke publieke HTML voor beide Engelse bestemmingen bevatte de juiste titel en breadcrumbs, en de voltooid gestreamde beschrijvingssectie bevatte een tijdelijke foutmelding zonder bronlink. Met de gewone desktop-UA en twee gesimuleerde Google-UA’s zijn beide oude en beide directe routes opgehaald. Beide Engelse doelen horen in de Engelse deelsitemap. De twee taalloze URL’s horen daar niet in.

Er was voor geen van beide Works een gecontroleerde tekst of duurzame snapshot. De directe Open Library-proef gaf 200 voor de twee edities zonder beschrijving. De Work-response voor Dark Heritage had wel een beschrijving, die voor Domain-Driven Design niet. De openbare Google Books ISBN-proef gaf voor beide 429 RESOURCE_EXHAUSTED, zonder Retry-After. Dit is bewijs uit de afzonderlijke proef. Zonder de logs van de specifieke liveaanvragen blijft onzeker of de app toen quota, cooldown, een time-out of een ander tijdelijk probleem trof. Googles Soft 404-classificatie is bevestigd op de oude URL’s. De precieze invloed van de ontbrekende beschrijving op Googles classificatie is onbekend.

De resolver gebruikt alleen editie-/ISBN-gebonden broninhoud. De Work-tekst van Dark Heritage valt dus buiten zijn huidige directe bronpad. De bestaande gecontroleerde-opslagloader gebruikt de nieuwe tekst vóór optionele providers en snapshots. De twee samenvattingen worden aan de juiste auteur, het Work en EN gebonden. [Bronnen, teksten en actuele ouderrecords](review.json)

## Testbewijs

- De regressietest draait de bestaande editie- en beschrijvingsselectie voor beide ISBN’s. Een geforceerde tijdelijke bronfout geeft vóór invoegen een tijdelijke fout. Met de gecontroleerde rij is de juiste EN-tekst inclusief bron beschikbaar, ook wanneer provider en snapshotopslag uitvallen.
- De lokale databaseproef met de exacte productie-SQL bevestigt rollback van de dry-run, twee gecommitteerde inserts, nul mutaties bij herhaling, weigering van een verkeerd receipt, bescherming van latere wijzigingen en herstel van de uitgangstoestand. Synthetische ratings en voortgang zijn mee vergeleken.
- Op het geïsoleerde project `hlvujbrmfdlrfxdjwsmb` zijn twee eigen auteurs, Works en editieouders geplaatst. Bijbehorende Work-ID’s zijn 995020101 en 995020102. Vooraf gaven de twee oude links op de bestaande geïsoleerde Preview de juiste Engelse 200 zonder bronvermelde beschrijving. Na de twee testinserts bevatten beide pagina’s hun originele server-HTML met de juiste samenvatting en bron, zonder de tijdelijke beschrijvingsfout. De herhaalimport gaf nul mutaties. [Geteste geïsoleerde Preview](https://lumiscore-hxlrt4e97-rgkgroeneveld-9102.vercel.app)
- De gecommitteerde hosted herstelproef gaf `INVALID_ARGUMENT`, `status: expired`, `This confirmation expired after 2 minutes.` De read-only nacontrole vond beide testbeschrijvingen en hun eigen ouders nog terug. Het lokale herstelbewijs blijft geldig. Hosted herstel staat open en er is geen identieke herhaalpoging gedaan.

## Uitvoering na afzonderlijk akkoord

1. Verifieer de exacte manifest- en bestandshashes, productiebasis en beide werken, auteurs en edities. Bevestig afwezigheid van beide beschrijvingen. Bij drift stoppen.
2. Bewaar een read-only snapshot. Voer de gehashte production-dry-run uit. Verwacht twee proefinserts met rollback.
3. Voer production-apply transactioneel uit en bewaar het eerste volledige commitreceipt. Lees beide rijen terug. Herhaal exact dezelfde import en verwacht nul mutaties.
4. Controleer oorspronkelijke HTML en zichtbare tekst/bron op de beide oude en beide directe URLs. Controleer ook de NL-redirect 6398, de bewust uitgesloten Engelse variant 1219 en de eerder herstelde 8856 en 9050.
5. Voer de vier echte GSC-livetests uit. Noteer per URL tijd, resultaat, canonical en geteste hoofdinhoud. Registreer opgeslagen indexstatus, crawl en Google-canonical apart. Houd een resterende Soft 404 open.

Herstel alleen met production-restore.sql en het eerste volledige productiereceipt. Het bestand weigert afwijkende identiteit, latere tekstwijzigingen en afhankelijkheden. Gebruik het uitsluitend op het gehashte doelproject. De testplannen en fixture-ouders horen nooit in productie.
