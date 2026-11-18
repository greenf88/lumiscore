-- Exact ISBN, source edition, Work and old title guards; one public edition label only.
-- Publisher: https://www.simonandschuster.com/books/Dragon-Ball-Z-Vol-17/Akira-Toriyama/Dragon-Ball-Z/9781591165057
-- Reader records, work IDs, source IDs, cover binding and other editions remain intact.
update public.editions e set title='Dragon Ball Z, Vol. 17: The Cell Game'
where e.id=4567 and e.work_id=4408 and e.title='Dragon Ball Z.'
and e.isbn_13='9781591165057' and e.language='eng'
and e.open_library_edition_id='OL23028075M'
and exists(select 1 from public.works w where w.id=e.work_id and w.author_id=2273 and w.open_library_id='OL5753059W')
returning id,work_id,title,isbn_13,language,open_library_edition_id;
