# Written reviews V1 proposal

Status: reviewed design proposal only. No schema or product implementation is included in this release.

## Product contract

A written review is optional and independent of a rating. A reader can keep at most one review per work and can edit or delete it. Reviews never contribute to LumiScore, rating summaries, or recommendation weights. Public review cards do not expose an individual reader's numeric rating.

Review text is plain text only: normalize to NFC, trim, allow 20–5,000 characters, reject NUL/control/invisible characters, and render as a React text node with `white-space: pre-wrap`. Never accept HTML or Markdown and never use `dangerouslySetInnerHTML`. A `contains_spoilers` flag hides the body behind an explicit, keyboard-accessible reveal control.

## Proposed data model

- `book_reviews`: UUID primary key, `user_id` referencing `auth.users`, `work_id` referencing `works`, plain-text `body`, `contains_spoilers`, server-owned `moderation_state`, and timestamps. Add `unique (user_id, work_id)`.
- `reader_public_profiles`: one row per user with a validated public `display_name`. It contains no email address. Synchronize through a narrow security-definer RPC after account-name updates and review writes; use a localized “LumiScore reader” fallback.
- `review_reports`: UUID primary key, review, reporter, bounded reason/note, workflow state, and resolution fields. Add `unique (reporter_id, review_id)`.
- `review_moderation_actions`: append-only moderator audit records for hide/restore actions and reasons.

Do not create an `auth.users` signup trigger: profile synchronization must not be able to block account creation.

## RLS and API surface

Enable and force RLS on every table, revoke broad table grants, and grant only the operations below. Owners can read, insert, update, and delete their own review; immutable-column triggers prevent changing ownership, work, moderation state, or server timestamps. A hidden review remains visible to its author but not to public readers.

Public reads go through a bounded security-definer RPC with a fixed empty search path and schema-qualified relations. It returns only review ID, safe display name, text, spoiler flag, and timestamps—never `user_id`, email, or an individual rating. The RPC clamps page size to 1–50 and returns only `moderation_state = 'visible'`.

Proposed endpoints:

- `GET /api/reviews/[workId]`: public keyset-paginated projection.
- `GET /api/reviews/[workId]/mine`: verified user's private draft/state; private/no-store.
- `PUT /api/reviews/[workId]/mine`: same-origin, verified-user, validated idempotent upsert.
- `DELETE /api/reviews/[workId]/mine`: same-origin owner deletion after UI confirmation.
- `POST /api/reviews/[reviewId]/reports`: same-origin authenticated, idempotent report; reject self-reports.
- `PATCH /api/admin/reviews/[reviewId]`: moderator-only hide/restore plus audit record.

Moderator authorization must use immutable `app_metadata`, never user-editable `user_metadata`. Apply per-user and edge/IP rate limits to review and report writes.

## Indexes and pagination

- Unique `(user_id, work_id)` supports one review and owner upsert.
- Partial public feed index `(work_id, created_at desc, id desc) where moderation_state = 'visible'`.
- Partial moderation queue index `(created_at, id) where state = 'open'`.
- Report lookup index on `review_reports(review_id)`.

Use keyset pagination with `(created_at, id) < (cursor_created_at, cursor_id)`, ordered by both columns descending. Encode the cursor as opaque base64url JSON. Editing leaves `created_at` unchanged and displays `updated_at` as “edited”. Do not use offset pagination.

## UI and accessibility

Place “Reader reviews” near but separate from ratings. Signed-in readers get an editor, character count, spoiler checkbox, save/edit/delete actions, confirmation before delete, focus-managed validation errors, and polite/assertive live regions. Guests get a sign-in call to action. Spoilers are closed by default with a button exposing `aria-expanded`. Include report reason selection and NL/EN copy. Verify keyboard use, focus order, 390 px layout, and both themes.

## Release gate

Before V1, test migration constraints, forced RLS/revokes, public RPC projection, owner isolation, one-per-work upsert, edit/delete, hidden-review exclusion, report deduplication and self-report rejection, moderator role enforcement, plain-text/XSS handling, cursor stability, hard limits, and the invariant that review writes do not alter LumiScore. Operational launch additionally requires moderation guidance, a staffed report queue, abuse limits, and privacy review.
