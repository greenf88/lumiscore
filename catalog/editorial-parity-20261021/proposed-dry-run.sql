-- PROPOSAL ONLY. Not applied to production or test. No build/import hook.
-- Default is dry-run ROLLBACK. Requires exact target and separately reviewed release.
begin;
create temporary table editorial_language_plan(id bigint,work_id bigint,title text,isbn13 text,olid text,new_language text) on commit drop;
insert into editorial_language_plan values
(6,6,'The Hobbit','9780606212342','OL10925146M','eng'),
(17,17,'The Martian','9780553418026','OL25661982M','eng'),
(18,18,'Foundation','9780345308993','OL10684101M','eng'),
(19,19,'Neuromancer','9780441569564','OL26788697M','eng'),
(21,21,'Left Hand of Darkness','9781417648436','OL11760711M','eng'),
(23,23,'The Name of the Wind','9780756404079','OL16159793M','eng'),
(24,24,'The Way of Kings','9780765326355','OL24345134M','eng'),
(25,25,'A Game of Thrones','9780553897845','OL24283280M','eng'),
(26,26,'Lion, Witch, & Wardrobe','9780848808235','OL11558559M','eng'),
(27,27,'Good Omens','9780552159845','OL24084500M','eng'),
(30,30,'The Fifth Season','9780316229296','OL25941433M','eng'),
(32,32,'The Hitch Hiker''s Guide to the Galaxy','9780330258647','OL10488032M','eng'),
(100,100,'Giver','9780606286084','OL10943219M','eng'),
(102,102,'The Hunger Games','9788184771695','OL32735739M','eng'),
(117,117,'The Three-Body Problem','9780765377067','OL25840917M','eng'),
(140,140,'The Dispossessed','9780060504007','OL24249719M','eng'),
(146,146,'The Golden Compass (His Dark Materials Trilogy)','9780606298872','OL10943605M','eng'),
(171,171,'The Fellowship of the Ring','9780007149216','OL20784407M','eng'),
(179,179,'Divergent','9780062024022','OL24914469M','eng'),
(185,185,'The Long Way to a Small, Angry Planet','9781473619814','OL26459198M','eng'),
(199,199,'The Testaments','9780385543781','OL27306829M','eng'),
(218,218,'Guards! Guards!','9780061440489','OL24277229M','eng'),
(288,288,'Hyperion','9780553283686','OL24961127M','eng'),
(304,304,'Assassin''s Apprentice','9780553897487','OL24298474M','eng');
do $$ begin
 if exists(select 1 from editorial_language_plan p left join public.editions e on e.id=p.id where e.id is null or e.work_id<>p.work_id or e.title is distinct from p.title or e.isbn_13 is distinct from p.isbn13 or e.open_library_edition_id is distinct from p.olid or (e.language is not null and e.language<>p.new_language)) then raise exception 'Edition preimage mismatch; no partial correction'; end if;
 if not exists(select 1 from public.works where id=2600 and title='Oryx and Crake' and open_library_id='OL675722W') then raise exception 'Oryx Work identity mismatch'; end if;
 if exists(select 1 from public.editions where (isbn_13='9780385721677' or open_library_edition_id='OL39470791M') and (work_id<>2600 or title<>'Oryx and Crake' or language is distinct from 'eng')) then raise exception 'Oryx edition collision; review instead of overwrite'; end if;
end $$;
update public.editions e set language=p.new_language from editorial_language_plan p where e.id=p.id and e.language is null returning e.id,e.work_id,e.language;
insert into public.editions(work_id,title,isbn_10,isbn_13,language,publisher,open_library_edition_id) select 2600,'Oryx and Crake','0385721676','9780385721677','eng','Anchor Books','OL39470791M' where not exists(select 1 from public.editions where isbn_13='9780385721677' or open_library_edition_id='OL39470791M') returning id,work_id;
-- Capture RETURNING receipts before any separately approved COMMIT. Repeating
-- after a successful apply changes zero languages and adds zero editions.
rollback;
-- Rollback after a future apply: use its receipt only. Restore NULL solely on
-- receipt language IDs whose exact identity/current language is unchanged;
-- remove only the newly receipt-created Oryx edition if no dependent rows exist.
-- Never delete a pre-existing edition, Work, rating, status, membership or round.
