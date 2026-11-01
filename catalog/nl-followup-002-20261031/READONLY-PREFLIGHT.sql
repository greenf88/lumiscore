-- READ ONLY. Explicitly select project qvplwejffhjvxaypmjut in the normal connector.
-- No auth/account/individual rating/status data, locks, DDL or DML.
select now() as checked_at;
select w.*,a.name as author_name,a.open_library_id as author_source
from public.works w join public.authors a on a.id=w.author_id
where w.id in (1,17,23,30,1993,8111,1132,1170,1182,1215,1016) order by w.id;
select * from public.editions where work_id in (1,17,23,30,1993,8111,1132,1170,1182,1215,1016) order by id;
select * from public.catalog_work_descriptions where work_id in (1,17,23,30,1993,1132,1170,1182,1215,1016) order by work_id,language;
select * from public.catalog_edition_metadata where work_id in (1,17,23,30,1993,1132,1170,1182,1215,1016) order by edition_id;
select id,work_id,title,language,isbn_13,isbn_10 from public.editions
where regexp_replace(coalesce(isbn_13,''),'[-[:space:]]','','g') in
 ('9789401614078','9789045207858','9789022557068','9789024580439','9789025310950','9789025845261','9789403183404','9789029091015','9789025440374')
or upper(regexp_replace(coalesce(isbn_10,''),'[-[:space:]]','','g')) in
 ('9401614075','9045207850','9022557065','9024580439','9025310950','9025845266','9403183403','9029091010','9025440371') order by id;
-- Metadata only: retain the full FK map before a later separately authorised installation/recovery.
select f.conname,f.conrelid::regclass as child_table,f.confrelid::regclass as parent_table,pg_get_constraintdef(f.oid) as definition
from pg_constraint f where f.contype='f' and f.confrelid in
 ('public.works'::regclass,'public.editions'::regclass,'public.catalog_edition_metadata'::regclass,'public.catalog_work_descriptions'::regclass)
order by 2,1;
