# Collection Bulk Progress V1

Collection Bulk Progress uses the existing `user_book_status` and `ratings`
tables. It adds no schema, policy, grant, function, trigger, or privileged
credential.

## Invariant

A rated Work is canonically `read`. The shared status mutation engine checks
ratings before an individual or bulk status mutation. An incompatible status
or clear request fails with HTTP 409 before any write. After a successful
status write it reloads status and rating state, repairs a rated non-Read row in
one bounded array upsert, and reloads canonical truth. Guest Want to Read
migration uses the same canonical rule: rated Works become Read while existing
non-rated statuses are preserved.

The database trigger on `ratings` remains the first line of defense when a
rating is added. Direct authenticated Data API writes that bypass LumiScore's
routes are the remaining V1 limitation: owner RLS still permits a user to alter
their own status row after rating it. Closing that gap requires a separately
reviewed database constraint/trigger change and is intentionally outside V1.

## Request and query budget

The bulk endpoint accepts at most 100 canonical Work IDs and performs:

1. one verified cookie-session lookup;
2. one collection lookup and one batched membership lookup;
3. one parallel status/rating preflight (two queries);
4. at most one primary array upsert or one scoped bulk delete;
5. bounded reconciliation reads and, only when a race/inconsistent historical
   row is found, one or two bounded repair upserts.

There is no per-book query or write loop. Initial collection loading keeps the
existing two parallel private queries and extends the existing rating query to
select the user's rating value.

## Security and privacy

All database access uses the cookie-bound publishable Supabase server client
and existing owner RLS. The route validates same-origin requests, JSON content,
body size, slug syntax, unique canonical IDs, collection existence, and actual
membership. Responses are private/no-store. Logs contain only a request ID,
item count, duration, outcome, and sanitized error code; rating values, user
IDs, email addresses, auth data, and statuses are never logged.
