# Password recovery review — 23 October 2026

## Scope and current decision

Separate branch `fix/password-recovery-flow-20261023`, based on main
`c3af98bb6e0a778c832734a55573ac08ab79cecb` after the independently approved PR54 release.
No PR51 changes, schema changes, production Auth changes, ratings or reading-progress changes.
**Not ready for production:** real delivered test email, password mutation and subsequent login remain unproved.
The reported production failure has not been reproduced with an actual mail link yet.

## Source-level findings and targeted fix

* The old reset redirect used the canonical SEO origin, which also sends Preview recovery to production.
  Request, callback and save now remain on the current request origin, with fixed NL/EN destinations.
  Caller-provided `next`, Host and forwarded-host values do not select a recovery destination.
* The old landing redirects without first processing a code/fragment. It now renders a bridge first,
  scrubs the URL, and either completes the legacy PKCE callback or presents the new-password form.
* Legacy PKCE still requires the matching original-browser state, a verified user and recent recovery AMR.
  It cannot authenticate a different browser opened by a mail app. This is a likely failure mode, not yet
  a reproduction of the user's incident.
* The proposed email template uses a one-use recovery token hash in a fragment, not a query/access token.
  Opening a GET does not consume it. The save POST verifies it with **fixed `type: recovery`**, checks the
  returned/current user identity, updates that account, and signs out locally. An existing ordinary login
  is not recovery proof. A new incoming proof takes precedence over an older recovery session.
* Expired/used proofs are rejected by Supabase at save, with the localized invalid-link/new-mail action.
  Showing the form alone does not assert that a proof is still valid. No arbitrary OTP AMR is accepted.
* Proof stays in component memory/hidden POST only. Language switching carries it in a same-origin
  fragment; the destination scrubs it again. Reloading a scrubbed, unverified page requires reopening
  the original email. No local/session storage, behavior buffer, secret log or external redirect is added.
* CSRF checks and private/no-store responses remain. Landing/callback use no-referrer policy.
  Password mismatch is caught before native submit; server validation also precedes token verification.

## Read-only test configuration observed

Project `hlvujbrmfdlrfxdjwsmb` is ACTIVE_HEALTHY. Its Site URL and three allowed redirects point to the
older PR8 Discovery test deployment, not this new branch. The currently installed recovery template
uses `{{ .ConfirmationURL }}`. Custom SMTP is enabled with Resend, port 465; no stored credentials were
read or changed. Historical October 11 notes describing SMTP as disabled are not the current state.

An attempted aggregate inspection of test Auth email metadata was refused by the security reviewer.
It was stopped, not retried through another route. Only a specifically designated test mailbox/account
may be used next; no mother's account or other production account is in scope.

## Verification

* 83 Auth/i18n tests passed: strict code/state parsing, bounded fragment, no open redirects, fixed
  recovery verification, wrong identity, provider failure, one-use retry, password validation and locale.
* TypeScript, full lint and the production build passed. The first Windows sandbox build failed on dependency readlink permissions; a build
  with the required local filesystem access passed. No dependency/configuration change was needed.
* Local tests use fake providers/synthetic proofs. They are **not delivered-mail or hosted-storage proof**.
* No real recovery message has been sent, no password changed, and no account created by this change.
* Local browser checks show the new-password form with a synthetic fragment, a clean address bar,
  retained form through EN→NL, and the invalid-link/new-mail action without proof. This uses the built
  application, not a real Auth token. Screenshots are outside the repository in
  `outputs/password-recovery-20261023/`. The check also exposed an already-open-tab hashchange case;
  the targeted listener fix was rechecked on the final build. Eight browser combinations (NL/EN,
  Paper/Ink, 390/1280px) have visible fields, a scrubbed address bar and no horizontal overflow.
* GET-only smoke checks on the final build: four NL/EN request/update pages returned 200 with H1,
  noindex and private/no-store; two missing-proof callbacks returned a localized safe 303. The
  landing/callback referrer policy was `no-referrer`. The local adapter deliberately refuses POST.
* Secret scan: 70 generated client files, no privileged key identifiers or configured secret values.
  The broader unit suite/remote CI are reported separately, not inferred from the targeted checks.

## Minimal test setup still required

1. Designate one reachable, separate test mailbox and say whether it has an account on the isolated test project.
   Do not share a password or recovery link in chat. Do not enumerate other users to find an account.
2. Approve branch-only public Supabase configuration for this branch if absent.
3. After the exact Ready URL is known, approve only its NL/EN update-password redirects on the test project,
   retaining existing allowlist entries and Site URL. Save the prior template/allowlist before any change.
4. Approve installing `test-support/password-recovery/recovery-email.html` only on the test project.
   Do not enable click tracking, broaden domains or change SMTP/secrets.
5. Send one real recovery email through the app to the designated test address. Verify destination and
   template without logging proof/URL. Open it in the normal browser and a fresh/mobile browser context.
6. The user must enter/confirm/submit the new test password in the browser. Then verify actual login;
   no password is requested in chat. Test a used link, errors, NL/EN and Paper/Ink. Do not describe browser
   emulation as a physical phone/mail-app test.

## Deployment and recovery proposal (not authorized for production)

Deploy compatible application handling before changing the mail template. Add only exact approved
redirect destinations; keep existing redirects needed by other deployments. Change the recovery template
only after application/SMTP tests. Existing original-browser PKCE links retain their checks.

Rollback the template to the saved ConfirmationURL version first. Keep the new application handler while
issued fragment links remain valid, if practical; an urgent application rollback can invalidate these
outstanding links, in which case users must request new links. Restore only this task's added redirect
entries, with an expected-value check; never overwrite later legitimate settings. No database rollback,
account reset or user-data restoration is involved.

## Primary references

* https://supabase.com/docs/guides/auth/passwords
* https://supabase.com/docs/guides/auth/auth-email-templates
* https://supabase.com/docs/guides/auth/server-side/advanced-guide
* https://supabase.com/docs/reference/javascript/auth-resetpasswordforemail
* Supabase Auth `internal/api/verify.go`: recovery hash verification and the distinction between explicit
  recovery verification and a generic OTP authentication method. Do not broaden the legacy AMR guard.
