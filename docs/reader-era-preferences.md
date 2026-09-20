# Reader Era Preferences design

## Product choice

The signup form stays limited to display name, email and password. After successful signup/confirmation, the safe internal return path passes through a skippable `/reading-preferences` step. This avoids increasing account-creation friction and lets existing authentication continue unchanged.

Existing authenticated users receive at most one calm account-menu invitation. Dismissing it persists `onboarding_dismissed`; the settings link remains available in the account menu.

## Age/minor policy finding

No current LumiScore terms, minimum-age rule or explicit minor-user flow was found in the application. Broad birth period is not age verification. Therefore `2010 or later` is displayed disabled with an explanation and is absent from the accepted API/database values. Activating it is blocked until the owner establishes a legally reviewed young-reader policy. No exact birth date is requested or stored.

Accepted birth values: `before_1950`, `1950_1969`, `1970_1979`, `1980_1989`, `1990_1999`, `2000_2009`, `prefer_not_to_say`.

## Data use

- Birth period is optional, private and has zero recommendation influence.
- Direct reading-period preferences are optional and create only a maximum 0.035 ranking nudge for LOW-confidence profiles, 0.015 for MEDIUM and zero for HIGH.
- No candidate is filtered out. Taste Test/ratings remain weighted at 0.8 similarity and are not altered.
- `all_periods`, `no_preference`, empty preference and a failed preference read preserve existing behavior exactly.
- Preference explanations are shown only when the nudge actually contributes.
- No preference value enters URLs, analytics, server timing or logs.

Future cohort use remains disabled. A reasonable minimum before any aggregate cohort signal is **at least 50 distinct consenting users per birth-period cohort and at least 20 independent meaningful book interactions in the cohort/category cell**, with suppression below either threshold. Only aggregate statistics may be used; never expose or consume another individual's row.

## Security

`user_reading_preferences.user_id` is the Auth user primary key with `ON DELETE CASCADE`. RLS is enabled and forced. Anonymous access is absent. Authenticated privileges are granted only behind owner policies using `(select auth.uid()) = user_id`. The API authenticates server-side, ignores browser user IDs, requires same-origin writes and returns private/no-store responses. No service-role credential is used in client or route code.

The migration is intentionally local and unapplied:

`supabase/migrations/20260920120000_add_user_reading_preferences.sql`
