-- Forward-only correction: preserve the already-applied discovery migration/history.
-- Supabase explicitly grants anon EXECUTE through default privileges. Revoking
-- PUBLIC alone does not remove that independent ACL entry.
begin;
revoke all on function public.taste_rating_state() from public, anon;
grant execute on function public.taste_rating_state() to authenticated;
commit;
