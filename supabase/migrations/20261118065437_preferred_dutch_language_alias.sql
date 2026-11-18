-- Existing Dutch editions use both ISO 639-2 aliases. Preserve their identity
-- and enforce one preference across dut/nld, rather than duplicating editions.
begin;
set local lock_timeout='3s';
set local statement_timeout='30s';
alter table public.editions drop constraint editions_preferred_identity_check;
alter table public.editions add constraint editions_preferred_identity_check check (
 not preferred_for_catalog or (coalesce(language in ('nld','dut','eng'),false) and btrim(coalesce(title,''))<>'' and
 coalesce((isbn_13 ~ '^97[89][0-9]{10}$' or open_library_edition_id ~ '^OL[0-9]+M$'),false))
);
drop index public.editions_preferred_work_language_idx;
create unique index editions_preferred_work_language_idx on public.editions(work_id,(case when language='dut' then 'nld' else language end)) where preferred_for_catalog;
commit;
