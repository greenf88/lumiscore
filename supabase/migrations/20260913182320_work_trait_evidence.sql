create table if not exists public.work_trait_evidence (
  work_id bigint not null references public.works (id) on delete cascade,
  trait text not null,
  weight numeric not null,
  confidence numeric not null,
  source text not null,
  source_key text not null,
  raw_labels text[] not null default '{}',
  mapping_version text not null,
  verified_at timestamptz not null,
  updated_at timestamptz not null default now(),
  primary key (work_id, trait, source, source_key),
  constraint work_trait_evidence_trait_check check (
    trait in (
      'fantasy', 'science_fiction', 'speculative', 'literary', 'romance',
      'thriller_mystery', 'nonfiction', 'classic', 'contemporary', 'dark',
      'uplifting', 'fast_paced', 'slow_burn', 'worldbuilding',
      'character_driven', 'idea_driven', 'accessible', 'complex'
    )
  ),
  constraint work_trait_evidence_weight_check
    check (weight >= 0.0 and weight <= 1.0),
  constraint work_trait_evidence_confidence_check
    check (confidence >= 0.0 and confidence <= 1.0),
  constraint work_trait_evidence_source_check check (
    source in (
      'manual', 'reviewed_seed', 'open_library', 'google_books',
      'publication_year'
    )
  ),
  constraint work_trait_evidence_source_key_check
    check (length(trim(source_key)) > 0),
  constraint work_trait_evidence_mapping_version_check
    check (length(trim(mapping_version)) > 0)
);

comment on table public.work_trait_evidence is
  'Versioned, source-attributed catalog evidence used to build recommendation trait vectors.';
comment on column public.work_trait_evidence.raw_labels is
  'Exact reviewed or upstream labels that produced this evidence; never inferred from a title.';

alter table public.work_trait_evidence enable row level security;
alter table public.work_trait_evidence force row level security;

revoke all on table public.work_trait_evidence from public, anon, authenticated;
grant select on table public.work_trait_evidence to anon, authenticated;
grant select, insert, update, delete on table public.work_trait_evidence to service_role;

create policy "work_trait_evidence_public_read"
on public.work_trait_evidence
for select
to anon, authenticated
using (true);
