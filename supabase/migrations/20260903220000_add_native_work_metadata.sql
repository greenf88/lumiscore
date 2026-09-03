alter table public.works
  add column if not exists source_type text,
  add column if not exists work_type text,
  add column if not exists native_identity_key text;

update public.works
set source_type = 'open_library'
where source_type is null and open_library_id is not null;

alter table public.works
  add constraint works_source_type_check
  check (source_type in ('open_library', 'lumiscore_native')) not valid;

alter table public.works
  add constraint works_work_type_check
  check (work_type is null or work_type in ('novel', 'novella', 'short_story', 'collection', 'audiobook_original')) not valid;

create unique index if not exists works_native_identity_key_unique
  on public.works (native_identity_key)
  where native_identity_key is not null;

