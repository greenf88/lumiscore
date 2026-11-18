-- Reverse this supplemental review before rolling back the main language correction.
begin;
set local lock_timeout='3s';
lock table public.editions,public.catalog_edition_metadata in share row exclusive mode;
do $checked$
begin
 if not exists(select 1 from public.editions e join public.works w on w.id=e.work_id join public.authors a on a.id=w.author_id where e.id=5745 and e.work_id=5586 and e.title='Electronic Power Control : Volume 1' and e.language='eng' and e.isbn_13='9789038217918' and e.open_library_edition_id='OL50511755M' and w.author_id=2998 and a.name='Jean Pollefliet') then raise exception 'English edition binding drift';end if;
 if not exists(select 1 from public.catalog_edition_metadata where edition_id=5745 and work_id=5586 and review_batch='remaining-covers-20261118-language' and bound_author_id=2998 and bound_language='eng' and bound_title='Electronic Power Control : Volume 1' and bound_isbn13='9789038217918' and cover_url='https://metadata.isbn.nl/ie_fcache/0000007527_Electronic_power_control_0_0.jpg' and review_status='approved' and evidence=$evidence$[{"url":"https://metadata.isbn.nl/40828/electronic-power-control-i-power-electronics.html","checkedAt":"2026-11-18T08:56:56.471Z","sourceSha256":"ff10d7af7a9be700963e271accd6badaa2e5e1b1e45fb9f422a2068e15cf8bec","imageSha256":"63cd8b02281e8db9af0a2e9fc48001a6a979aacccd4aaaddb972679f8ee0b5b1","isbn13":"9789038217918","language":"eng","review":"Publisher registry explicitly identifies English; visually reviewed front matches J. Pollefliet, volume 1, Power Electronics, seventh edition."}]$evidence$::jsonb) then raise exception 'Review drift';end if;
 delete from public.catalog_edition_metadata where edition_id=5745 and review_batch='remaining-covers-20261118-language';
end $checked$;
rollback;
