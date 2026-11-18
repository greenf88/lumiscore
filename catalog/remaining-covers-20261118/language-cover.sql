-- Apply only after the main batch corrects this edition from Dutch to English.
begin;
set local lock_timeout='3s';
set local statement_timeout='15s';
lock table public.editions,public.catalog_edition_metadata in share row exclusive mode;
do $checked$
begin
 if not exists(select 1 from public.editions e join public.works w on w.id=e.work_id join public.authors a on a.id=w.author_id where e.id=5745 and e.work_id=5586 and e.title='Electronic Power Control : Volume 1' and e.language='eng' and e.isbn_13='9789038217918' and e.open_library_edition_id='OL50511755M' and w.author_id=2998 and a.name='Jean Pollefliet') then raise exception 'English edition binding drift';end if;
 if exists(select 1 from public.catalog_edition_metadata where edition_id=5745) then raise exception 'Existing cover review conflict';end if;
 insert into public.catalog_edition_metadata(edition_id,work_id,bound_author_id,bound_title,bound_language,bound_isbn13,format,cover_url,evidence_url,evidence,review_status,reviewed_at,review_batch) values(5745,5586,2998,'Electronic Power Control : Volume 1','eng','9789038217918','other','https://metadata.isbn.nl/ie_fcache/0000007527_Electronic_power_control_0_0.jpg','https://metadata.isbn.nl/40828/electronic-power-control-i-power-electronics.html',$evidence$[{"url":"https://metadata.isbn.nl/40828/electronic-power-control-i-power-electronics.html","checkedAt":"2026-11-18T08:56:56.471Z","sourceSha256":"ff10d7af7a9be700963e271accd6badaa2e5e1b1e45fb9f422a2068e15cf8bec","imageSha256":"63cd8b02281e8db9af0a2e9fc48001a6a979aacccd4aaaddb972679f8ee0b5b1","isbn13":"9789038217918","language":"eng","review":"Publisher registry explicitly identifies English; visually reviewed front matches J. Pollefliet, volume 1, Power Electronics, seventh edition."}]$evidence$::jsonb,'approved',now(),'remaining-covers-20261118-language');
end $checked$;
select edition_id,work_id,bound_language,cover_url from public.catalog_edition_metadata where edition_id=5745;
rollback;
