# Registratie- en inlogincident — 24 november 2026

## Productie en bevestigde oorzaak

Onderzochte main/productie: `fd55d255602ab36549eac802508e3b826c351c2c`, Ready-deployment
`dpl_46vv55LzgGbGHKGPrT8WYz277vSu`, alias `lumisco.re`.
Productie is uitsluitend gelezen; geen gebruiker, wachtwoord, bevestigingsstatus,
SMTP-configuratie, limiet, accountgegevens, rating of voortgang is gewijzigd.

De foto toont een registratielimiet. De bijbehorende gebeurtenissen zijn:

| UTC / CET | Vastgesteld |
| --- | --- |
| 19:21:12 / 20:21:12 | Een nieuw Auth-account aangemaakt, met één identity. |
| 19:21:14 / 20:21:14 | Twee overlappende Auth-POSTs: één 200, één 500 met `users_email_partial_key`-conflict in `auth.users`. |
| 19:21:14 / 20:21:14 | Resend accepteert de bevestigingsmail en rapporteert `delivered`. Dit is geen bewijs dat de ontvanger de mail gelezen heeft. |
| 19:21:37 / 20:21:37 | Volgende registratie geweigerd: `over_email_send_rate_limit`. |
| 19:22:15–39 / 20:22:15–39 | Drie inlogpogingen geweigerd met `invalid_credentials`. De logs bewijzen niet welk wachtwoord is ingevuld. |
| 19:49:54 / 20:49:54 | Wachtwoordherstel: één 200 en een vrijwel gelijktijdige 429; Resend rapporteert de resetmail als afgeleverd. |

Bij de read-only controle was het nieuwe account nog onbevestigd en zonder succesvolle
login. De lezer moet zijn eigen bevestigingsmail openen in de browser waarin de registratie
plaatsvond. Een wachtwoordreset vervangt die verplichte bevestiging niet. Er wordt geen
bevestigingslink, privé-e-mailadres, providerbody, token of wachtwoord in dit verslag bewaard.

De maildienst is niet algemeen uitgevallen: het afzenderdomein is geverifieerd en verzenden
staat aan; Resend rapporteerde 2/100 dagverzendingen en 2/3.000 maandverzendingen.
De eerste conclusie dat de 500 een mailverzendfout zou zijn, is door de diepere logs weerlegd.
De 500 is een gelijktijdig account-insertconflict. Er is geen eigen trigger op `auth.users`
gevonden. Het unieke Auth-emailindex wordt behouden.

Het beginpunt van de dubbele productieaanroepen is niet bewezen. Eén native HTTP-POST
door de echte lokale router en SSR-client geeft precies één providerrequest. De bestaande
formulieren blokkeren echter geen tweede submit tijdens een lopende native POST. Daarom
is bescherming tegen dubbele formulierverzending een gerichte preventie, geen claim dat
een specifieke dubbele tik van deze bezoeker is bewezen.

## Afgebakende reparatie

- Eén gedeelde, synchrone blokkering voor een lopende formulierverzending op registratie,
  inloggen en wachtwoordherstel. De knop toont een wachtstatus; moduswisselen wacht mee.
  Terugkeer via browsergeschiedenis maakt het formulier weer bruikbaar. Geen automatische
  retry, resend, opslag van wachtwoorden of gedeelde toestand tussen bezoekers.
- Registratiemeldingen zeggen niet meer dat er geen mail is verstuurd. Een eerdere poging
  kan al geslaagd zijn; inbox/spam en bevestiging krijgen voorrang op herhaald registreren.
- Inloggen onderscheidt verkeerde gegevens, onbevestigde mail, 429, 5xx/netwerkfouten en
  een onverwacht ontbrekende sessie. Alleen een echte succesvolle sessie vervolgt de flow
  en de bestaande PR51-meting. Veilige categorieën worden gelogd, geen providerdetails.
- CSRF/same-origin, PKCE, veilige `next`, private/no-store en herstelbewijzen blijven gelden.

De browserblokkering is per formulier na hydration. Dit is geen projectbrede of persistente
server-idempotentievoorziening; requests uit andere tabbladen of zonder JavaScript blijven
onder Supabase-controles vallen. Het Auth-indexconflict wordt niet omgezet in fictief succes.

## Verificatie en grenzen

- `node --experimental-strip-types --test "lib/auth/*.test.ts"`: gerichte regressies, inclusief
  tien snelle claims, onafhankelijke formulieren, sessiebehoud en foutclassificatie.
- `node scripts/test-auth-availability.mjs`: twintig NL/EN-controles door echte routehandlers
  en `@supabase/ssr`, met een loopback-provider. Registratie, PKCE-bevestiging met originele
  cookie, login, ontbrekende sessie, 429, 503, onbevestigde mail, verkeerde gegevens, private
  headers, één provideraanroep per POST en cross-origin-weigering. Geen externe requests.
- `node scripts/test-auth-availability.mjs --baseline=fd55d255602ab36549eac802508e3b826c351c2c`:
  dezelfde regressiecontrole met oude route/vertalingen faalt op de oude misleidende melding.
- De workflow voert de nieuwe HTTP-controle voortaan uit naast bestaande tests, TypeScript,
  lint, metadata-/cataloguscontroles, productiebuild en secretscan.
- Preview uitsluitend gekoppeld aan testproject `hlvujbrmfdlrfxdjwsmb`; geen productie-account
  gemaakt of verwijderd en geen bestaande testaccountgegevens gewijzigd.
- Visuele browserbediening was tijdens dit onderzoek niet beschikbaar. HTTP- en gesimuleerde
  providercontroles zijn geen bewijs van echte mailboxontvangst of mobiele browserbediening.

## Vrijgave en herstel

Geen SQL, schema-, mailtemplate-, SMTP-, DNS- of beveiligingswijzigingen nodig. Bestaande
bevestiging blijft verplicht. Geen account- of catalogusimport. Deze branch is een Draft-PR;
publicatie gebeurt na beoordeling van de exacte head en groene samenvoegcontroles.

Vóór vrijgave: echte browsercontrole NL/EN op 320/390 px en desktop, Paper/Ink, toetsenbord,
dubbele tik/Enter tijdens een vertraagde respons, terugknop en ongeldige wachtwoordherhaling.
Gebruik alleen een door de eigenaar beheerd synthetisch testaccount. Echte bevestigingsmail
en opnieuw inloggen op test blijven afzonderlijke acceptatie; geen passwords/links in bewijs.

Na vrijgave: juiste productie-SHA/Ready/alias controleren, beide loginformulieren en bestaande
gastflow read-only controleren. Alleen met een aangewezen testmailbox één registratie,
bevestiging en opnieuw inloggen controleren. Geen herhaalde productie-registratiepogingen
bij een fout. Bestaande betrokken accounts worden niet opnieuw aangemaakt of automatisch
bevestigd. Bij regressie uitsluitend dit codepakket terugdraaien of het vastgelegde vorige
Ready-deployment herstellen; geen databaseherstel nodig.

Bronnen: [Supabase-rate limits](https://supabase.com/docs/guides/auth/rate-limits),
[Auth-errorcodes](https://supabase.com/docs/guides/auth/debugging/error-codes),
[Custom SMTP](https://supabase.com/docs/guides/auth/auth-smtp).
