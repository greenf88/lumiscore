# Registratiereparatie — 11 oktober 2026

Status: gerichte codecorrectie; **echte mailflow en productie-release nog niet vrijgegeven**. Geen migraties. Bestaande accounts, beoordelingen en voortgang blijven intact.

## Productiebasis en incidentbewijs

- Repository: `greenf88/lumiscore`; basis `b750486b7b981ffb080dc2a6af080959e203a64a`.
- Productie: `https://lumisco.re`, Ready deployment `dpl_2ihWErpQCbp36f1wx4Fab31mGJyT` (`lumiscore-c21emq5a7-rgkgroeneveld-9102.vercel.app`).
- Productieproject: `qvplwejffhjvxaypmjut`; uitsluitend testproject voor synthetische tests: `hlvujbrmfdlrfxdjwsmb`.
- Supabase-logvenster: 10 oktober 00:00–24:00 CEST, oftewel 9 oktober 22:00–10 oktober 22:00 UTC. Alleen technische velden geselecteerd; geen e-mailadressen, IP-adressen, gebruikers-ID's, wachtwoorden of tokens vastgelegd.

| Tijd CEST, 10 oktober | Auth-gebeurtenis | Betekenis |
| --- | --- | --- |
| 15:04:14 | `/signup`, 200; `user_confirmation_requested`; confirmation-mail-event | Verzoek geaccepteerd, geen bewijs van inboxbezorging. |
| 15:04:19 | `/token`, 400; `email_not_confirmed` | Een login werd geweigerd omdat het adres nog niet bevestigd was. |
| 15:04:51 | `/token`, 400; `invalid_credentials` | Algemene weigering; oorzaak niet verder afgeleid. |
| 15:05:09 | `/signup`, 429; `over_email_send_rate_limit` | **Aangetoonde registratieblokkade door de mailverzendlimiet.** |

In de geretourneerde dagselectie is geen `/verify`-event gevonden. Deze gebeurtenissen worden niet zonder bewijs aan dezelfde persoon gekoppeld. De logs bewijzen niet het verloop van iedere gemelde registratie. Vercel-logconnector gaf 403; bestaande CLI-toegang werkte en leverde vier corresponderende applicatieverzoeken op. Geen rechten aangepast.

## Actuele configuratie en oorzaak

Read-only Management API-controle op 11 oktober:

| Instelling | Productie | Test |
| --- | --- | --- |
| Publieke signup toegestaan | Ja | Nee |
| Emailprovider actief | Ja | Ja |
| Bevestiging vereist (`mailer_autoconfirm=false`) | Ja | Ja |
| Eigen SMTP geconfigureerd | Nee | Nee |
| Auth-mails per uur | 2 | 2 |
| Serverwachtwoordminimum | 6 | 6 |
| Appminimum | 8 | 8 |
| Bevestigingstemplate gebruikt `.ConfirmationURL` | Ja | Ja |

De standaard Supabase-maildienst levert uitsluitend aan organisatie/teamadressen en is niet bedoeld voor publieke productie-registratie. De huidige configuratie verklaart waarom registratie voor gewone bezoekers niet betrouwbaar kan werken. De daglogs bewijzen specifiek de limietweigering, niet een aparte `email_address_not_authorized`-melding. Geen bewijs van een defecte SMTP-login: er is geen eigen SMTP ingesteld.

Productie-Site-URL is `https://lumisco.re`; `/auth/callback` is toegestaan. NL/EN lopen bewust via dit neutrale endpoint met een veilige, gelokaliseerde `next`-parameter; er is geen aparte `/nl/auth/callback` vereist. Test heeft alleen oudere Preview-callbacks toegestaan. Nieuwe Preview-mailtests vereisen een gericht toegevoegde callback voor die deployment. Bezorging, definitieve redirect en sessie blijven echte testgates.

Het app-/serverminimumverschil is vastgelegd, maar verklaart de gemeten mailfout niet. Dit pakket verandert geen wachtwoordbeleid of ander geparkeerd werk.

## Minimale codecorrectie

1. Veilige, gelokaliseerde foutcategorieën voor maillimiet, niet-toegestaan ontvangeradres, uitgeschakelde signup, wachtwoordafwijzing en onbereikbare Auth. Geen providertekst of accountbestaan tonen; geen automatische retry/resend.
2. Signup-fouten houden het registratieformulier actief. Onbevestigde login toont een gerichte inbox-/spam-instructie.
3. Gewone PKCE-bevestiging redirect naar dezelfde deployment als waar cookies zijn gezet, niet naar de SEO-canonical-host. NL/EN, onboarding en veilige terugkeerquery blijven behouden; externe `next` wordt geweigerd.
4. Bestaande CSRF-controle, verplichte bevestiging, PKCE-codewissel en private cacheheaders blijven behouden. Recovery-implementatie blijft ongemoeid.

Dit herstelt foutafhandeling en een onafhankelijke Preview-callbackfout. **Het vervangt geen SMTP-inrichting en maakt publieke productie-registratie op zichzelf nog niet werkend.**

## Uitgevoerde controles

- 50/50 gerichte Auth- en i18n-tests, waaronder vijf nieuwe tests voor foutcategorieën, één poging zonder retry, NL/EN, veilige callback-omgeving en behoud van beveiligingsgrenzen.
- TypeScript (`tsc --noEmit`), ESLint, Vinext-build, Vite-build voor de Preview, client-secretscan en `git diff --check`: geslaagd. Alleen bestaande buildwaarschuwingen over dynamische imports.
- Unit-/broncodebewijs is **geen** bewijs van ontvangen mail, bevestiging, sessiebehoud of opnieuw inloggen. Hosted formulier-/negatieve callbackcontrole wordt afzonderlijk in het releasevoorstel vastgelegd.
- Geen accounts aangemaakt, mails aangevraagd, beoordelingen gewijzigd of testgegevens te verwijderen. Oorspronkelijke testgebruikers en 64 ratings behouden.

## Afzonderlijk goed te keuren mail- en releasepakket

Aanbevolen concrete optie, zolang geen bestaande geschikte SMTP-dienst wordt aangewezen: **Resend Free**, $0/maand, maximaal 3.000 mails/maand en 100/dag volgens het tarief van 11 oktober. Geen automatische betaalde upgrade. Dit zijn harde capaciteitsbeperkingen, geen onbeperkte productiegarantie.

Voorgestelde instellingen: SMTP `smtp.resend.com`, TLS-poort `465`, gebruikersnaam `resend`, wachtwoord uitsluitend een veilig aangeleverde sending-key; afzender `LumiScore <no-reply@auth.lumisco.re>`. Senderdomein `auth.lumisco.re` moet worden geverifieerd met uitsluitend de door Resend uitgegeven DKIM/SPF-records. De exacte DNS-waarden zijn pas beschikbaar na provider-/domeinvoorbereiding; geen fictieve waarden of wijziging van bestaande website-/MX-records. DMARC bestaande toestand eerst controleren. Niet uitgevoerd.

Bundel toestemming voor: gratis SMTP/domeinverificatie en noodzakelijke DNS-records; test-SMTP en tijdelijk signup toestaan op het bestaande testproject; uitsluitend de concrete Preview-callback allowlisten; maximaal twee synthetische registraties met door Rick aangewezen, bereikbare mailboxen; na echte NL/EN-bezorging, bevestiging, reload en opnieuw inloggen pas productie-SMTP en de app-merge/automatische deployment. Emailbevestiging blijft aan. Stel de Auth-mailgrens expliciet in op 30/uur bij SMTP-activatie, met de providergrens van 100/dag zichtbaar als beperking. Geen extra gebruikersdatawrites.

Deze toestemming is nog niet gegeven. Provideraccount-/domeintoegang en twee toegestane testontvangers zijn nog niet vastgesteld; vraag nooit om hun wachtwoorden of bevestigingslinks in chat. Bevestigingslinks moeten in dezelfde browsercontext openen wegens PKCE. Laat een menselijke mailboxhouder de mail openen wanneer de beschikbare automatisering geen toegestane mailboxroute heeft.

## Gegevensbehoudend herstel

App: revert uitsluitend deze reparatie bovenop de actuele main of herstel de hierboven vastgelegde productiebasis, met behoud van `/nl` en `/en`; geen herstel naar een versie zonder taalroutes. Geen databaseherstel, accounts verwijderen of ratings/voortgang terugzetten.

Voor eventuele latere SMTP-wijziging: beveiligd de huidige configuratie vastleggen, alleen gewijzigde SMTP-/limietvelden herstellen bij mislukking en bevestiging verplicht laten. Terugkeer naar standaardmail betekent expliciet dat publieke registratie opnieuw beperkt is; presenteer dit niet als functioneel herstel. Test-signup en tijdelijke callback na verificatie naar de vooraf vastgelegde toestand terugzetten, uitsluitend eigen accounts en hun eigen gegevens opruimen. Geen eerder toegestane callbacks of oorspronkelijke gebruikers verwijderen.

## Officiële bronnen

- [Supabase custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp): standaardmailbeperkingen, 2/uur en custom SMTP.
- [Supabase redirect URLs](https://supabase.com/docs/guides/auth/redirect-urls): Site URL, allowlist en Preview-callbacks.
- [Supabase rate limits](https://supabase.com/docs/guides/auth/rate-limits).
- [Resend tarieven](https://resend.com/pricing) en [Supabase SMTP-instructies](https://resend.com/docs/send-with-supabase-smtp).

Exacte reparatie-SHA, PR en Ready Preview staan in het afzonderlijke releasevoorstel. Geen merge of productieconfiguratiewijziging binnen deze voorbereiding.
