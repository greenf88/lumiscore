-- These foreign-key indexes support the catalog joins used by collection,
-- detail, and author pages. `if not exists` keeps review environments safe
-- when an equivalent index was created outside the migration history.
create index if not exists editions_work_id_idx
on public.editions (work_id);

create index if not exists works_author_id_idx
on public.works (author_id);
