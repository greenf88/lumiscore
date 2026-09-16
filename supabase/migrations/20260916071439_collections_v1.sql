create table public.collections (
  id bigint generated always as identity primary key,
  slug text not null unique,
  name text not null,
  collection_type text not null,
  description text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collections_slug_format_check
    check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  constraint collections_name_not_blank_check
    check (btrim(name) <> ''),
  constraint collections_type_check
    check (collection_type in ('series', 'universe', 'author_collection'))
);

create table public.collection_books (
  collection_id bigint not null
    references public.collections (id) on delete cascade,
  work_id bigint not null
    references public.works (id) on delete cascade,
  sequence_number integer,
  publication_order integer,
  subgroup text,
  created_at timestamptz not null default now(),
  primary key (collection_id, work_id),
  constraint collection_books_sequence_positive_check
    check (sequence_number is null or sequence_number > 0),
  constraint collection_books_publication_order_positive_check
    check (publication_order is null or publication_order > 0)
);

create unique index collection_books_unique_sequence_idx
on public.collection_books (collection_id, sequence_number)
where sequence_number is not null;

create index collection_books_work_id_idx
on public.collection_books (work_id);

create table public.user_book_status (
  user_id uuid not null default auth.uid()
    references auth.users (id) on delete cascade,
  work_id bigint not null
    references public.works (id) on delete cascade,
  status text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, work_id),
  constraint user_book_status_value_check
    check (status in ('want_to_read', 'reading', 'read', 'dnf'))
);

create index user_book_status_work_id_idx
on public.user_book_status (work_id);

alter table public.collections enable row level security;
alter table public.collections force row level security;
alter table public.collection_books enable row level security;
alter table public.collection_books force row level security;
alter table public.user_book_status enable row level security;
alter table public.user_book_status force row level security;

revoke all on table public.collections from anon, authenticated;
revoke all on table public.collection_books from anon, authenticated;
revoke all on table public.user_book_status from anon, authenticated;

grant select on table public.collections to anon, authenticated;
grant select on table public.collection_books to anon, authenticated;
grant select, insert, update, delete on table public.user_book_status
  to authenticated;

create policy "collections_public_read"
on public.collections
for select
to anon, authenticated
using (true);

create policy "collection_books_public_read"
on public.collection_books
for select
to anon, authenticated
using (true);

create policy "user_book_status_select_own"
on public.user_book_status
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "user_book_status_insert_own"
on public.user_book_status
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "user_book_status_update_own"
on public.user_book_status
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "user_book_status_delete_own"
on public.user_book_status
for delete
to authenticated
using ((select auth.uid()) = user_id);

create function public.touch_collection_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.touch_collection_updated_at() from public;

create trigger collections_touch_updated_at_before_update
before update on public.collections
for each row
execute function public.touch_collection_updated_at();

create function public.protect_user_book_status_identity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.user_id is distinct from old.user_id
    or new.work_id is distinct from old.work_id then
    raise exception 'A reading status cannot be reassigned to another user or work.'
      using errcode = '22023';
  end if;

  new.updated_at = now();
  return new;
end;
$$;

revoke execute on function public.protect_user_book_status_identity() from public;

create trigger user_book_status_protect_identity_before_update
before update on public.user_book_status
for each row
execute function public.protect_user_book_status_identity();

create function public.sync_rating_to_read_status()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  insert into public.user_book_status (user_id, work_id, status)
  values (new.user_id, new.work_id, 'read')
  on conflict (user_id, work_id) do update
    set status = 'read', updated_at = now();
  return new;
end;
$$;

revoke execute on function public.sync_rating_to_read_status() from public;

create trigger ratings_sync_read_status_after_write
after insert or update of rating on public.ratings
for each row
execute function public.sync_rating_to_read_status();

insert into public.user_book_status (user_id, work_id, status, created_at, updated_at)
select ratings.user_id, ratings.work_id, 'read', ratings.created_at, now()
from public.ratings
on conflict (user_id, work_id) do update
  set status = 'read', updated_at = now();

comment on table public.collections is
  'Reviewed series, fictional universes, and non-ordered author collections.';
comment on table public.collection_books is
  'Reviewed work membership; sequence_number is used only for ordered series.';
comment on table public.user_book_status is
  'Private per-reader status, independent from ratings. A rating writes read status.';

insert into public.collections (slug, name, collection_type, description)
values
  ('the-lord-of-the-rings', 'The Lord of the Rings', 'series', 'The three-volume reading order for J.R.R. Tolkien''s epic.'),
  ('a-song-of-ice-and-fire', 'A Song of Ice and Fire', 'series', 'The published main novels in George R. R. Martin''s series.'),
  ('his-dark-materials', 'His Dark Materials', 'series', 'Philip Pullman''s original His Dark Materials trilogy.'),
  ('the-locked-tomb', 'The Locked Tomb', 'series', 'The published Locked Tomb novels by Tamsyn Muir.'),
  ('fifty-shades', 'Fifty Shades', 'series', 'The original Fifty Shades trilogy by E. L. James.'),
  ('three-sisters-island', 'Three Sisters Island', 'series', 'Nora Roberts'' Three Sisters Island trilogy.'),
  ('geef-me-de-ruimte', 'Geef me de ruimte', 'series', 'Thea Beckmans historische trilogie over de Honderdjarige Oorlog.'),
  ('kinderen-van-moeder-aarde', 'Kinderen van Moeder Aarde', 'series', 'Thea Beckmans toekomsttrilogie over Thule.'),
  ('the-housemaid', 'The Housemaid', 'series', 'The three main Housemaid novels by Freida McFadden.'),
  ('middle-earth', 'Middle-earth', 'universe', 'A conservative selection of distinct Middle-earth works; no single reading order is implied.'),
  ('suzanne-vermeer', 'Suzanne Vermeer', 'author_collection', 'De boeken van Suzanne Vermeer in de LumiScore-catalogus; dit is geen doorlopende leesreeks.')
on conflict (slug) do update set
  name = excluded.name,
  collection_type = excluded.collection_type,
  description = excluded.description,
  updated_at = now();

with seed_membership (slug, work_id, sequence_number, publication_order, subgroup) as (
  values
    ('the-lord-of-the-rings', 171, 1, 1, null),
    ('the-lord-of-the-rings', 138, 2, 2, null),
    ('the-lord-of-the-rings', 193, 3, 3, null),
    ('a-song-of-ice-and-fire', 25, 1, 1, null),
    ('a-song-of-ice-and-fire', 121, 2, 2, null),
    ('a-song-of-ice-and-fire', 245, 3, 3, null),
    ('a-song-of-ice-and-fire', 126, 4, 4, null),
    ('a-song-of-ice-and-fire', 128, 5, 5, null),
    ('his-dark-materials', 146, 1, 1, null),
    ('his-dark-materials', 178, 2, 2, null),
    ('his-dark-materials', 228, 3, 3, null),
    ('the-locked-tomb', 151, 1, 1, null),
    ('the-locked-tomb', 239, 2, 2, null),
    ('the-locked-tomb', 293, 3, 3, null),
    ('fifty-shades', 672, 1, 1, null),
    ('fifty-shades', 673, 2, 2, null),
    ('fifty-shades', 698, 3, 3, null),
    ('three-sisters-island', 679, 1, 1, null),
    ('three-sisters-island', 707, 2, 2, null),
    ('three-sisters-island', 686, 3, 3, null),
    ('geef-me-de-ruimte', 1112, 1, 1, null),
    ('geef-me-de-ruimte', 1113, 2, 2, null),
    ('geef-me-de-ruimte', 1114, 3, 3, null),
    ('kinderen-van-moeder-aarde', 1251, 1, 1, null),
    ('kinderen-van-moeder-aarde', 1115, 2, 2, null),
    ('kinderen-van-moeder-aarde', 1116, 3, 3, null),
    ('the-housemaid', 549, 1, 1, null),
    ('the-housemaid', 553, 2, 2, null),
    ('the-housemaid', 560, 3, 3, null),
    ('middle-earth', 6, null, 1, 'core works'),
    ('middle-earth', 7, null, 2, 'core works'),
    ('middle-earth', 192, null, 3, 'core works'),
    ('suzanne-vermeer', 1220, null, 1, null),
    ('suzanne-vermeer', 1221, null, 2, null),
    ('suzanne-vermeer', 1222, null, 3, null),
    ('suzanne-vermeer', 1223, null, 4, null),
    ('suzanne-vermeer', 1224, null, 5, null),
    ('suzanne-vermeer', 1225, null, 6, null),
    ('suzanne-vermeer', 1226, null, 7, null),
    ('suzanne-vermeer', 1227, null, 8, null),
    ('suzanne-vermeer', 1228, null, 9, null),
    ('suzanne-vermeer', 1229, null, 10, null),
    ('suzanne-vermeer', 1230, null, 11, null),
    ('suzanne-vermeer', 1231, null, 12, null),
    ('suzanne-vermeer', 1302, null, 13, null),
    ('suzanne-vermeer', 1303, null, 14, null),
    ('suzanne-vermeer', 1304, null, 15, null),
    ('suzanne-vermeer', 1305, null, 16, null),
    ('suzanne-vermeer', 1306, null, 17, null),
    ('suzanne-vermeer', 1232, null, 18, null),
    ('suzanne-vermeer', 1233, null, 19, null),
    ('suzanne-vermeer', 1234, null, 20, null),
    ('suzanne-vermeer', 1235, null, 21, null),
    ('suzanne-vermeer', 1236, null, 22, null),
    ('suzanne-vermeer', 1237, null, 23, null),
    ('suzanne-vermeer', 1239, null, 24, null),
    ('suzanne-vermeer', 1240, null, 25, null),
    ('suzanne-vermeer', 1241, null, 26, null),
    ('suzanne-vermeer', 1242, null, 27, null),
    ('suzanne-vermeer', 1259, null, 28, null),
    ('suzanne-vermeer', 1282, null, 29, null),
    ('suzanne-vermeer', 1238, null, 30, null),
    ('suzanne-vermeer', 1283, null, 31, null),
    ('suzanne-vermeer', 1284, null, 32, null),
    ('suzanne-vermeer', 1285, null, 33, null),
    ('suzanne-vermeer', 1286, null, 34, null),
    ('suzanne-vermeer', 1288, null, 35, null),
    ('suzanne-vermeer', 1299, null, 36, null),
    ('suzanne-vermeer', 1300, null, 37, null),
    ('suzanne-vermeer', 1301, null, 38, null),
    ('suzanne-vermeer', 1243, null, 39, null),
    ('suzanne-vermeer', 1287, null, 40, null),
    ('suzanne-vermeer', 1289, null, 41, null),
    ('suzanne-vermeer', 1290, null, 42, null),
    ('suzanne-vermeer', 1291, null, 43, null),
    ('suzanne-vermeer', 1292, null, 44, null),
    ('suzanne-vermeer', 1244, null, 45, null),
    ('suzanne-vermeer', 1245, null, 46, null),
    ('suzanne-vermeer', 1293, null, 47, null),
    ('suzanne-vermeer', 1294, null, 48, null),
    ('suzanne-vermeer', 1295, null, 49, null),
    ('suzanne-vermeer', 1296, null, 50, null),
    ('suzanne-vermeer', 1297, null, 51, null),
    ('suzanne-vermeer', 1298, null, 52, null)
)
insert into public.collection_books (
  collection_id,
  work_id,
  sequence_number,
  publication_order,
  subgroup
)
select
  collections.id,
  seed_membership.work_id,
  seed_membership.sequence_number,
  seed_membership.publication_order,
  seed_membership.subgroup
from seed_membership
join public.collections using (slug)
on conflict (collection_id, work_id) do update set
  sequence_number = excluded.sequence_number,
  publication_order = excluded.publication_order,
  subgroup = excluded.subgroup;
