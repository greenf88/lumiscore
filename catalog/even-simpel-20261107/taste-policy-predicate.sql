select coalesce((select
   not exists(select 1 from public.work_catalog_categories c where c.work_id=w.id and c.category_id='nonfiction_cooking_food')
   and not exists(select 1 from public.work_trait_evidence t cross join lateral unnest(t.raw_labels) label
     where t.work_id=w.id and t.mapping_version='taste_traits_v1' and t.source in ('manual','reviewed_seed','open_library','google_books')
       and t.confidence>=0.6 and label ~* '\m(cooking|cookbooks?|cookery|recipes?|kookboeken?|kookkunst|recepten(boek(en)?)?)\M')
   and (exists(select 1 from public.work_catalog_categories c join public.catalog_categories known on known.id=c.category_id
       where c.work_id=w.id and c.category_id<>'nonfiction_cooking_food')
     or exists(select 1 from public.work_trait_evidence t where t.work_id=w.id and t.mapping_version='taste_traits_v1'
       and t.source in ('manual','reviewed_seed','open_library','google_books') and t.confidence>=0.6 and t.weight>0 and t.weight<=1
       and t.trait in ('fantasy','science_fiction','literary','romance','thriller_mystery','nonfiction')))
   and exists(select 1 from public.editions e left join public.catalog_edition_metadata m on m.edition_id=e.id
     and m.work_id=w.id and m.bound_author_id=w.author_id and m.bound_title=e.title and m.bound_isbn13=e.isbn_13
     and m.bound_language=e.language and m.review_status='approved'
     where e.work_id=w.id and length(trim(e.title))>0 and lower(e.language)=any(case p_language
       when 'nl' then array['nl','nld','dut'] when 'en' then array['en','eng'] else array[]::text[] end)
       and (m.edition_id is null or m.format in ('paperback','hardcover','ebook') or(w.work_type='audiobook_original' and m.format='audio'))
       and e.title !~* '\m(omnibus|boxed[ -]?set|study guide|adaptation|large[ -]?print|book summary)\M'
       and (w.work_type='audiobook_original' or e.title !~* '\m(audiobook|audio book|mp3|unabridged|abridged|cassette)\M'))
   from public.works w join public.authors a on a.id=w.author_id
   where w.id=p_work_id and length(trim(w.title))>0 and length(trim(a.name))>0
     and coalesce(w.open_library_id,w.native_identity_key) is not null),false);
