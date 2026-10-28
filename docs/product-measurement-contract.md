# LumiScore productmetingen — contract v3

22 oktober 2026. Dit vervangt de historische v2-implementatiebeschrijving.
Eventnamen en definities zijn behouden; toestemming, retentie en capaciteit zijn
nu technisch uitgewerkt. Alleen geïsoleerd testdoel. Op28oktober zijn echte
hosted opslag,10/10-rondeafronding, normale cron en browserbevestiging bewezen;
gerichte testcleanup blijft geblokkeerd. Zie het actuele installatie-reviewverslag.
De oudere reviews blijven checkpoints, geen actuele bewijsclaim.

## Optionele gebeurtenissen

Alle onderstaande gebeurtenissen zijn optionele productanalyse: altijd standaard
uit, ook in database-triggers, totdat de noodzakelijke keuze én kortlevende
autorisatie geldig zijn. Een client kan niets als 'operationeel noodzakelijk'
classificeren. Normale rating-, account- en voortgangsopslag staat hiervan los.

| Event | Definitie | Extra begrensde velden |
| --- | --- | --- |
| page_opened | Nieuwe gehydrateerde route/document-entry na geldige toestemming; herladen is een nieuwe pageview | surface |
| editorial_list_opened | Bijbehorende lijstinhoud aanwezig | surface, list_id |
| book_card_opened | Primaire/middel-/toetsenbordactivatie interne boeklink; 750ms dubbelklikonderdrukking | surface, list_id, work_id |
| book_detail_opened | Inhoud voor het betreffende Work aanwezig | surface, work_id |
| recommendation_impression | Kaart continu >=50% zichtbaar gedurende >=1s, eenmaal per gemounte kaart | surface, work_id, position, ranker_version |
| recommendation_open | Boeklink vanuit een daadwerkelijk vertoonde aanbevelingskaart | dezelfde velden |
| want_to_read_saved | Bevestigde echte overgang naar want_to_read; geen optimistische klik | work_id; ranker_version indien aanwezig |
| rating_saved | Committed INSERT of echte wijziging; ongewijzigde upsert/retry telt niet | work_id, operation=new/updated |
| taste_round_started | Server bevestigt INSERT van echte ronde | goal |
| taste_round_completed | Eerste NULL->completed_at-overgang volgens bestaande doelberekening | goal |
| taste_result_opened | Geldige resultaatinhoud getoond, niet loading/fout/gast; bewijst niet zelf voltooiing | surface |
| sign_in_succeeded | Geslaagde normale wachtwoordlogin, receipt per geverifieerde Auth-sessie | surface |

Common allowlist: locale(nl/en), surface, source, medium, campaign,
traffic=synthetic. Alleen facebook/organic_social/dystopie_202610 als campagne;
Google/Bing/andere bekende zoekreferrers worden vaste enums. Onbekende herkomst
blijft onbekend. Geen raw URL/referrer/zoektekst, naam, e-mail, user-ID, token,
ratingcijfer of vrije properties. Ranker-versie blijft 8f337dd; geen nieuw algoritme.
Een guest-preferences-vragenlijst is geen echte opgeslagen ratingronde.
Openbare botgevoelige observations sturen nooit scores, toegang of populariteit.

## Toestemming en identiteit

NL/EN-keuze met gelijkwaardige accepteren/weigeren en permanente wijzigknop.
HttpOnly noodzakelijke choice-cookie: alleen versie1, ja/nee, vervaldatum90dagen.
Onbekend/ongeldig/verlopen/DNT/GPC: uit. Er worden geen analyse-UUIDs, UTM-storage
of replaybuffers vóór toestemming aangemaakt. Accepteren speelt geen oude route
terug. Een geldig herstelde eerdere toestemming mag de huidige route meten.
Kortlevende HttpOnly bearer-grant30min pas na toestemming; private DB-registry,
geen bezoeker-/sessie-ID of eventdimensie. Database verifieert en lockt die grant
bij opslag; revoke gebruikt dezelfde rij. Na bevestigde revoke geen vertraagde
oude opslag; reeds gecommitteerde events kunnen niet worden teruggehaald.
Bij netwerkstoring is remote intrekking pending, niet ten onrechte 'bevestigd'.

Intrekken/expiry: queue/context wissen, requests afbreken; andere tabs stopsignaal.
Campagnecontext alleen vaste enums in sessionStorage, geldig tot grantverval
(max30min), geen identiteit. Gesuspendeerde tabs garanderen geen fysieke timer;
expirycontrole voorkomt hergebruik en wist bij volgend gebruik.
Geen permanente bezoekersidentificatie, fingerprinting of nieuwe externe tracker.
Speed Insights-bootstrap verwijderd om geen afzonderlijk niet-intrekbaar SDK-script
naast deze opt-in te laten draaien. Auth/locale/ratings/leesvoortgang blijven gelijk.
Eerder opgeslagen tellers volgen retentie, niet individueel uit globale totalen
te verwijderen. Receipts met ronde-/Auth-sessiehashes zijn pseudoniem, niet bewezen
anoniem; geen supported funneljoin. Noodzakelijke keuze staat apart van analyse.

## Retentie

Productvoorstel, geen wettelijke standaard: ruwe optionele gegevens maximaal
90dagen plus maximaal5min taakinterval en3s uitvoering, alleen bij tijdige start
en zonder storing/backlog. Schedulervertraging valt buiten die bovengrens.
Dagteller expires_at: START van UTC-bucketdag+90dagen (bijdrage89–90dagen).
Receipts random browser/rating/status24uur; round/login90dagen. Grants30min,
budgets1uur, operationele healthcounts/eigen cronhistory7dagen. Geen langer
bewaarde gedragsaggregaten. Backups/providerlogs hebben nog onbekende termijnen.

Zelfstandige pg_cron-taak iedere5min, max5000rijen per zes expiratietabellen,
expiry-indexen, SKIP LOCKED, lock_timeout100ms, job statement_timeout3s.
Geen cleanup op ingest, geen ratings/accounts/books/voortgang DELETE.
monitor.sql toont ontbrekend/stale succes>10min, SQLSTATE en backlog; operator
moet dit bewaken. Bij storing geen harde bovengrens; herhalen met dezelfde
begrensde batches tot backlog weg is. Geen onbeperkte inhaaltransactie.
Lokale cronfixture bewijst configuratie/command, niet een draaiende hosted daemon.

## Capaciteit, foutisolatie en volledigheid

V2-cap120/min was projectbreed, plus globale niet-wachtende mutex.
V3: gedeeld600events/min/project,60/min/kortlevende grant,60grantmints/min.
Geen permanent client-ID/IP-limiter. Atomische SQL-budgetten over appinstanties;
lockwait25ms, healthcounts best effort5ms. Geen globale advisorymutex.
Onderbouwing:20synthetische28-eventroutes=560/min;600 geaccepteerd, volgende
projectweigering, pergrant/reset/dedup lokaal getest. PGlite serialiseert
transacties: geen bewijs van daadwerkelijke parallelle hosted throughput.

SDK max20queued/max10perbatch/max2inflight/3s abort/100ms flush/geen retries.
Intrekken verwijdert alles, geen retry-storm of replay. Tijdelijke lokale
diagnostiek telt queue-drops/failed/rejected batches zonder payload of ID;
gewist bij intrekken, niet een tweede meetsysteem of complete remote verliesmeting.
DB-healthcounts: vaste reden/minuut/aantal, geen eventinhoud of persoonsgegevens.
Bekende rate/busy/storage-weigeringen betekenen onvolledige telling. Clientuitval,
offline verlies of kapotte healthwrites blijven onbekend.

Normale rating hoeft geen extra meetrequest te doen. Optional AFTER-observer is
fail-open, correcte normale opslag blijft werken zonder keuze of bij meetfout.
Loginmeting na response, 1s timeout; collector1s, consent1,5s, geen catalogusqueries.
Metingen mogen nooit native navigatie/aanmelden/rating als fout of retry behandelen.

## Rapportage en bewijs

Private tabellen ENABLE+FORCE RLS, nul clienttablegrants; expliciete wrapper/helper
rechten, lege search_path. Geen publiek rapport. Bevoegde operator gebruikt
report.sql plus monitor.sql. Testtraffic standaard uitgesloten uit productie.
Tellers zijn events/pageviews, geen sessies, unieke bezoeken/personen of gekoppelde
conversie. Ratio's tonen teller/noemer/periode en kunnen >1 zijn; cohort onbekend.
report.coverage.complete is false, bekende verliezen zichtbaar, onbekend is niet0.
517beoordelingen/19rondes blijven historische meldingen zonder gevalideerde herkomst.

Scripts product-metrics-* testen echt SQL lokaal. Echte testopslag/cron en volledige
browserronde zijn28oktober teruggelezen. SQL-,collectorHTTP- en DOM-browsermetingen
blijven afzonderlijke meetsoorten; geen pure browserpaint/LCP- of productieclaim.
De latere gerichte cleanup faalt opnieuw met Invalid or expired requestState;
oorzaak onbekend, geen bewezen sessie-expiry of beveiligingsweigering. Geen
identieke retry of alternatieve toegang; eerst aantoonbaar herstel en verse guards.
Zie privacy-capaciteitsanalyse en productievoorstel voor hashes, volgorde en rollback.
