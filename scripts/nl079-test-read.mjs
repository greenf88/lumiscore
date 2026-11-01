import fs from'node:fs';
const root=new URL('../catalog/nl-release-079-20261101/',import.meta.url),m=JSON.parse(fs.readFileSync(new URL('execution-manifest.json',root))),ids=Object.values(m.workMap).join(',');
console.log(`select jsonb_build_object('project','hlvujbrmfdlrfxdjwsmb','at',statement_timestamp(),
'works',(select jsonb_agg(to_jsonb(w) order by id) from public.works w where id in(${ids})),
'authors',(select jsonb_agg(to_jsonb(a) order by id) from public.authors a where id in(select author_id from public.works where id in(${ids}))),
'editions',(select jsonb_agg(to_jsonb(e) order by id) from public.editions e where work_id in(${ids})),
'metadata',(select coalesce(jsonb_agg(to_jsonb(m) order by edition_id),'[]') from public.catalog_edition_metadata m where work_id in(${ids})),
'descriptions',(select coalesce(jsonb_agg(to_jsonb(d) order by work_id,language),'[]') from public.catalog_work_descriptions d where work_id in(${ids})),
'protected',jsonb_build_object('ratings',(select jsonb_build_object('count',count(*),'digest',md5(string_agg(to_jsonb(r)::text,'|' order by to_jsonb(r)::text))) from public.ratings r),'statuses',(select jsonb_build_object('count',count(*),'digest',md5(string_agg(to_jsonb(s)::text,'|' order by to_jsonb(s)::text))) from public.user_book_status s),'accounts',(select jsonb_build_object('count',count(*),'digest',md5(string_agg(id::text||':'||created_at::text,'|' order by id))) from auth.users))) as snapshot;`);
