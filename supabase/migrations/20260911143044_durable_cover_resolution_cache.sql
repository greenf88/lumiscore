create table if not exists public.work_cover_resolutions (
  work_id bigint not null references public.works(id) on delete cascade,
  source text not null,
  cover_url text,
  source_key text not null,
  state text not null,
  verified_at timestamptz,
  checked_at timestamptz not null default now(),
  retry_after timestamptz,
  primary key (work_id, source),
  constraint work_cover_resolutions_source_check
    check (source in ('open_library', 'google_books')),
  constraint work_cover_resolutions_state_check
    check (state in ('resolved', 'confirmed_missing', 'temporary_failure')),
  constraint work_cover_resolutions_resolved_url_check
    check (state <> 'resolved' or cover_url is not null),
  constraint work_cover_resolutions_source_key_check
    check (length(trim(source_key)) > 0)
);

alter table public.work_cover_resolutions enable row level security;

revoke all on table public.work_cover_resolutions from anon, authenticated;
grant select, insert, update, delete
  on table public.work_cover_resolutions
  to service_role;

comment on table public.work_cover_resolutions is
  'Server-only metadata cache for externally hosted book covers; no image data is stored.';
