-- REVIEW PROPOSAL. Install only on hlvujbrmfdlrfxdjwsmb for this pilot.
-- Public reviewed bibliography only; no account, rating, progress or trait writes.
set local lock_timeout = '3s';
set local statement_timeout = '30s';

create table if not exists public.catalog_work_descriptions (
  work_id bigint not null references public.works(id) on delete restrict,
  language text not null check (language in ('nl','en')),
  bound_author_id bigint not null references public.authors(id) on delete restrict,
  text text not null check (length(text) between 40 and 4000),
  source_type text not null check (source_type in ('official_catalog','official_publisher')),
  source_name text not null check (length(source_name) between 1 and 120),
  source_url text not null check (source_url ~ '^https://[^/@ ]+(/|$)'),
  evidence jsonb not null check (jsonb_typeof(evidence) = 'array' and jsonb_array_length(evidence) between 1 and 12),
  provenance text not null check (provenance = 'original_source_reviewed_summary'),
  review_status text not null check (review_status in ('pending','approved','withdrawn')),
  reviewed_at timestamptz not null,
  review_batch text not null check (length(review_batch) between 1 and 100),
  primary key (work_id,language)
);

create table if not exists public.catalog_edition_metadata (
  edition_id bigint primary key references public.editions(id) on delete restrict,
  work_id bigint not null references public.works(id) on delete restrict,
  bound_author_id bigint not null references public.authors(id) on delete restrict,
  bound_title text not null,
  bound_language text not null check (bound_language in ('nld','dut','nl','eng','en')),
  bound_isbn13 text not null check (bound_isbn13 ~ '^97[89][0-9]{10}$'),
  format text not null check (format in ('paperback','hardcover','ebook','audio','other')),
  cover_url text check (cover_url ~ '^https://[^/@ ]+(/|$)'),
  card_cover_url text check (card_cover_url ~ '^https://[^/@ ]+(/|$)'),
  evidence_url text not null check (evidence_url ~ '^https://[^/@ ]+(/|$)'),
  evidence jsonb not null check (jsonb_typeof(evidence) = 'array' and jsonb_array_length(evidence) between 1 and 12),
  review_status text not null check (review_status in ('pending','approved','withdrawn')),
  reviewed_at timestamptz not null,
  review_batch text not null check (length(review_batch) between 1 and 100)
);
create index if not exists catalog_edition_metadata_work_idx
  on public.catalog_edition_metadata(work_id) where review_status = 'approved';

alter table public.catalog_work_descriptions enable row level security;
alter table public.catalog_edition_metadata enable row level security;
-- No dependency on Supabase's automatic grants. Clients cannot author reviews.
revoke all on public.catalog_work_descriptions, public.catalog_edition_metadata
  from public, anon, authenticated, service_role;
grant select on public.catalog_work_descriptions, public.catalog_edition_metadata
  to anon, authenticated;
drop policy if exists catalog_descriptions_public_approved on public.catalog_work_descriptions;
create policy catalog_descriptions_public_approved on public.catalog_work_descriptions
  for select to anon,authenticated using (review_status = 'approved');
drop policy if exists catalog_editions_public_approved on public.catalog_edition_metadata;
create policy catalog_editions_public_approved on public.catalog_edition_metadata
  for select to anon,authenticated using (review_status = 'approved');

comment on table public.catalog_work_descriptions is
  'Original reviewed summaries by Work and language. No tracking/personal data. Controlled admin import only.';
comment on table public.catalog_edition_metadata is
  'Reviewed format and edition-bound cover evidence. Not a second edition selector or eligibility override.';
