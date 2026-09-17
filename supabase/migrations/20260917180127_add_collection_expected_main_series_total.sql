begin;

alter table public.collections
  add column expected_main_series_total integer;

alter table public.collections
  add constraint collections_expected_main_series_total_check
  check (
    expected_main_series_total is null
    or (
      collection_type = 'series'
      and expected_main_series_total > 0
    )
  );

comment on column public.collections.expected_main_series_total is
  'Reviewed full main-series length used for progress and Book X of Y. NULL means the total is not reliably known.';

create temporary table reviewed_collection_expected_totals (
  slug text primary key,
  name text not null,
  expected_main_series_total integer not null check (expected_main_series_total > 0)
) on commit drop;

insert into reviewed_collection_expected_totals (
  slug,
  name,
  expected_main_series_total
)
values
  ('a-court-of-thorns-and-roses', 'A Court of Thorns and Roses', 4),
  ('a-song-of-ice-and-fire', 'A Song of Ice and Fire', 5),
  ('bridgerton', 'Bridgerton', 8),
  ('caraval', 'Caraval', 3),
  ('chestnut-springs', 'Chestnut Springs', 5),
  ('crescent-city', 'Crescent City', 3),
  ('dreamland-billionaires', 'Dreamland Billionaires', 3),
  ('fifty-shades', 'Fifty Shades', 3),
  ('geef-me-de-ruimte', 'Geef me de ruimte', 3),
  ('harry-potter', 'Harry Potter', 7),
  ('heartstopper', 'Heartstopper', 5),
  ('his-dark-materials', 'His Dark Materials', 3),
  ('kinderen-van-moeder-aarde', 'Kinderen van Moeder Aarde', 3),
  ('kings-of-sin', 'Kings of Sin', 6),
  ('kingsbridge', 'Kingsbridge', 5),
  ('knockemout', 'Knockemout', 3),
  ('maple-hills', 'Maple Hills', 3),
  ('millennium-original-trilogy', 'Millennium', 3),
  ('mistborn-era-one', 'Mistborn Era One', 3),
  ('mistborn-era-two', 'Mistborn Era Two', 4),
  ('once-upon-a-broken-heart', 'Once Upon a Broken Heart', 3),
  ('outlander', 'Outlander', 9),
  ('percy-jackson-and-the-olympians', 'Percy Jackson and the Olympians', 5),
  ('powerless', 'Powerless', 3),
  ('red-rising', 'Red Rising', 6),
  ('shadow-and-bone', 'Shadow and Bone', 3),
  ('shatter-me', 'Shatter Me', 6),
  ('the-century-trilogy', 'The Century Trilogy', 3),
  ('the-empyrean', 'The Empyrean', 3),
  ('the-expanse', 'The Expanse', 9),
  ('the-folk-of-the-air', 'The Folk of the Air', 3),
  ('the-heroes-of-olympus', 'The Heroes of Olympus', 5),
  ('the-housemaid', 'The Housemaid', 3),
  ('the-hunger-games', 'The Hunger Games', 5),
  ('the-locked-tomb', 'The Locked Tomb', 3),
  ('the-lord-of-the-rings', 'The Lord of the Rings', 3),
  ('the-stormlight-archive', 'The Stormlight Archive', 5),
  ('the-wheel-of-time', 'The Wheel of Time', 14),
  ('the-witcher', 'The Witcher', 8),
  ('three-sisters-island', 'Three Sisters Island', 3),
  ('throne-of-glass', 'Throne of Glass', 7),
  ('thursday-murder-club', 'Thursday Murder Club', 5),
  ('twisted', 'Twisted', 4);

do $$
declare
  reviewed_count integer;
  invalid_collection_count integer;
  invalid_position_count integer;
begin
  select count(*) into reviewed_count
  from reviewed_collection_expected_totals;

  select count(*) into invalid_collection_count
  from reviewed_collection_expected_totals as reviewed
  left join public.collections as collections using (slug)
  where collections.id is null
    or collections.name <> reviewed.name
    or collections.collection_type <> 'series';

  select count(*) into invalid_position_count
  from reviewed_collection_expected_totals as reviewed
  join public.collections as collections using (slug)
  join public.collection_books as membership
    on membership.collection_id = collections.id
  where membership.sequence_number is not null
    and membership.sequence_number > reviewed.expected_main_series_total;

  if reviewed_count <> 43 or invalid_collection_count <> 0 then
    raise exception
      'Expected 43 reviewed existing series, found % rows with % invalid/missing collections.',
      reviewed_count,
      invalid_collection_count;
  end if;

  if invalid_position_count <> 0 then
    raise exception
      'Reviewed totals conflict with % existing membership positions.',
      invalid_position_count;
  end if;
end;
$$;

do $$
declare
  updated_count integer;
begin
  update public.collections as collections
  set expected_main_series_total = reviewed.expected_main_series_total,
      updated_at = now()
  from reviewed_collection_expected_totals as reviewed
  where collections.slug = reviewed.slug
    and collections.name = reviewed.name
    and collections.collection_type = 'series';

  get diagnostics updated_count = row_count;
  if updated_count <> 43 then
    raise exception 'Expected to backfill 43 reviewed series, updated %.', updated_count;
  end if;
end;
$$;

commit;
