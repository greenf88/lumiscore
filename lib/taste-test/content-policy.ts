/** Content/format gate extracted from the existing reviewed taste proposal.
 * No titles, authors, IDs, rankings, series policy or profile maths here.
 * SQL is the shared authority for atomic selection, resume and candidates.
 */
export const TASTE_CONTENT_POLICY = {
  version: 'taste_content_v1',
  mappingVersion: 'taste_traits_v1',
  minimumConfidence: .6,
  genreTraits: ['fantasy','science_fiction','literary','romance','thriller_mystery','nonfiction'],
  evidenceSources: ['manual','reviewed_seed','open_library','google_books'],
  allowedFormats: ['paperback','hardcover','ebook'],
  cookingCategory: 'nonfiction_cooking_food',
  // Same source-label vocabulary as the existing central eligibility proposal.
  cookingPattern: '\\m(cooking|cookbooks?|cookery|recipes?|kookboeken?|kookkunst|recepten(boek(en)?)?)\\M',
} as const;

export function tasteContentPredicateSql() {
 const p=TASTE_CONTENT_POLICY, list=(v:readonly string[])=>v.map(x=>"'"+x+"'").join(',');
 return `select coalesce((select
   not exists(select 1 from public.work_catalog_categories c where c.work_id=w.id and c.category_id='${p.cookingCategory}')
   and not exists(select 1 from public.work_trait_evidence t cross join lateral unnest(t.raw_labels) label
     where t.work_id=w.id and t.mapping_version='${p.mappingVersion}' and t.source in (${list(p.evidenceSources)})
       and t.confidence>=${p.minimumConfidence} and label ~* '${p.cookingPattern}')
   and (exists(select 1 from public.work_catalog_categories c join public.catalog_categories known on known.id=c.category_id
       where c.work_id=w.id and c.category_id<>'${p.cookingCategory}')
     or exists(select 1 from public.work_trait_evidence t where t.work_id=w.id and t.mapping_version='${p.mappingVersion}'
       and t.source in (${list(p.evidenceSources)}) and t.confidence>=${p.minimumConfidence} and t.weight>0 and t.weight<=1
       and t.trait in (${list(p.genreTraits)})))
   and exists(select 1 from public.editions e left join public.catalog_edition_metadata m on m.edition_id=e.id
     and m.work_id=w.id and m.bound_author_id=w.author_id and m.bound_title=e.title and m.bound_isbn13=e.isbn_13
     and m.bound_language=e.language and m.review_status='approved'
     where e.work_id=w.id and length(trim(e.title))>0 and lower(e.language)=any(case p_language
       when 'nl' then array['nl','nld','dut'] when 'en' then array['en','eng'] else array[]::text[] end)
       and (m.edition_id is null or m.format in (${list(p.allowedFormats)}) or(w.work_type='audiobook_original' and m.format='audio'))
       and e.title !~* '\\m(omnibus|boxed[ -]?set|study guide|adaptation|large[ -]?print|book summary)\\M'
       and (w.work_type='audiobook_original' or e.title !~* '\\m(audiobook|audio book|mp3|unabridged|abridged|cassette)\\M'))
   from public.works w join public.authors a on a.id=w.author_id
   where w.id=p_work_id and length(trim(w.title))>0 and length(trim(a.name))>0
     and coalesce(w.open_library_id,w.native_identity_key) is not null),false)`;
}
