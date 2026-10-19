-- Read-only, public bibliography. No ratings/statuses or catalog mutation.
select jsonb_build_object('at',statement_timestamp(),'snapshot',pg_current_snapshot()::text,'collection',to_jsonb(c),
 'members',(select jsonb_agg(jsonb_build_object('workId',w.id,'workTitle',w.title,'workOlid',w.open_library_id,'author',a.name,'sequence',cb.sequence_number,'publicationOrder',cb.publication_order,'subgroup',cb.subgroup,
  'editions',(select coalesce(jsonb_agg(jsonb_build_object('editionId',e.id,'title',e.title,'language',e.language,'isbn13',e.isbn_13,'editionOlid',e.open_library_edition_id,'publisher',e.publisher) order by e.id),'[]') from public.editions e where e.work_id=w.id)) order by cb.sequence_number,w.id)
 from public.collection_books cb join public.works w on w.id=cb.work_id left join public.authors a on a.id=w.author_id where cb.collection_id=c.id)) dune_trace
from public.collections c where c.slug='dune';
