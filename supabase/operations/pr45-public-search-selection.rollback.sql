-- Only after PR45 test review: remove this own read-only function, no CASCADE.
-- No existing functions, tables, records, grants or policies are changed.
begin;
drop function public.catalog_search_selection_v1(text,text,text[],text,text[],text,bigint[],bigint);
commit;
