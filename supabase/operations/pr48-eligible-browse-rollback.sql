-- Only after reverting the PR48 caller; preserve all records and existing RPCs.
drop function if exists public.catalog_browse_page_v2(text,text,text[],text,text[],text,integer,integer,bigint[],bigint);
