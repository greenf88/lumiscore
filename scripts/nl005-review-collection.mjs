// One explicitly test-only review collection. No existing memberships or user rows change.
import fs from'node:fs';
const dir='catalog/nl-research-005-20261101/',m=JSON.parse(fs.readFileSync(dir+'execution-manifest.json'));
const collection={id:976400001,slug:'nl005-review-20261101',name:'NL005 gecontroleerde testcatalogus',collection_type:'universe',description:'Uitsluitend synthetische reviewgroepering van de50 gecontroleerde openbare boekidentiteiten; geen productiecollectie of reeksvolgorde.',expected_main_series_total:null};
const members=Object.values(m.workMap).map(id=>({collection_id:collection.id,work_id:id,sequence_number:null,publication_order:null,subgroup:null}));
const literal=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'::jsonb";
const apply=`-- TEST ONLY hlvujbrmfdlrfxdjwsmb; review collection976400001, exact50 current Work IDs. No other memberships/user/sequence changes.
begin;set local lock_timeout='3s';set local statement_timeout='30s';lock table public.collections,public.collection_books in share row exclusive mode;
do $fixture$ declare desired jsonb:=${literal(collection)};members jsonb:=${literal(members)};actual jsonb;row jsonb;n integer;begin
 select to_jsonb(c) into actual from public.collections c where id=976400001 or slug='nl005-review-20261101';
 if actual is not null then
  if not actual@>desired then raise exception 'Existing review identity differs';end if;
  select count(*) into n from public.collection_books where collection_id=976400001;if n<>50 then raise exception 'Partial review fixture';end if;
  for row in select value from jsonb_array_elements(members) loop if not exists(select 1 from public.collection_books b where to_jsonb(b)@>row)then raise exception 'Review membership drift';end if;end loop;
 else
  if (select count(*) from public.works where id in(select (x->>'work_id')::bigint from jsonb_array_elements(members)x))<>50 then raise exception 'Missing approved test Work';end if;
  insert into public.collections(id,slug,name,collection_type,description,expected_main_series_total) overriding system value select id,slug,name,collection_type,description,expected_main_series_total from jsonb_populate_record(null::public.collections,desired);
  insert into public.collection_books(collection_id,work_id,sequence_number,publication_order,subgroup)select collection_id,work_id,sequence_number,publication_order,subgroup from jsonb_populate_recordset(null::public.collection_books,members);
 end if;
end;$fixture$;
select jsonb_build_object('project','hlvujbrmfdlrfxdjwsmb','collection',(select to_jsonb(c) from public.collections c where id=976400001),'members',(select jsonb_agg(to_jsonb(b) order by work_id) from public.collection_books b where collection_id=976400001))as receipt;commit;
`;
const undo=`-- TEST ONLY. Exact first committed collection/membership receipt; later changes/dependencies abort.
begin;set local lock_timeout='3s';set local statement_timeout='30s';lock table public.collections,public.collection_books in share row exclusive mode;
do $undo$ declare r jsonb:=nullif(current_setting('lumiscore.nl005_review_collection_receipt',true),'')::jsonb;actual jsonb;row jsonb;dep record;n bigint;begin
 if r->>'project' is distinct from 'hlvujbrmfdlrfxdjwsmb' or r->'collection'->>'id' is distinct from '976400001' or r->'collection'->>'slug' is distinct from 'nl005-review-20261101' or jsonb_array_length(r->'members')<>50 then raise exception 'Exact review receipt required';end if;
 select to_jsonb(c)into actual from public.collections c where id=976400001 for update;if actual is distinct from r->'collection' then raise exception 'Later collection change';end if;
 select jsonb_agg(to_jsonb(b) order by work_id)into actual from public.collection_books b where collection_id=976400001;if actual is distinct from r->'members' then raise exception 'Later membership change';end if;
 for row in select value from jsonb_array_elements(r->'members') loop
  for dep in select ns.nspname,c.relname,string_agg(format('(to_jsonb(child)->%L)=($1->%L)',ca.attname,pa.attname),' and ' order by k.ord) predicate from pg_constraint f join pg_class c on c.oid=f.conrelid join pg_namespace ns on ns.oid=c.relnamespace cross join lateral unnest(f.conkey,f.confkey)with ordinality k(ck,pk,ord)join pg_attribute ca on ca.attrelid=f.conrelid and ca.attnum=k.ck join pg_attribute pa on pa.attrelid=f.confrelid and pa.attnum=k.pk where f.contype='f' and f.confrelid='public.collection_books'::regclass group by f.oid,ns.nspname,c.relname loop execute format('select count(*)from %I.%I child where %s',dep.nspname,dep.relname,dep.predicate)into n using row;if n>0 then raise exception 'Later membership dependency';end if;end loop;
 end loop;
 delete from public.collection_books where collection_id=976400001;
 for dep in select ns.nspname,c.relname,string_agg(format('(to_jsonb(child)->%L)=($1->%L)',ca.attname,pa.attname),' and ' order by k.ord)predicate from pg_constraint f join pg_class c on c.oid=f.conrelid join pg_namespace ns on ns.oid=c.relnamespace cross join lateral unnest(f.conkey,f.confkey)with ordinality k(ck,pk,ord)join pg_attribute ca on ca.attrelid=f.conrelid and ca.attnum=k.ck join pg_attribute pa on pa.attrelid=f.confrelid and pa.attnum=k.pk where f.contype='f' and f.confrelid='public.collections'::regclass group by f.oid,ns.nspname,c.relname loop execute format('select count(*)from %I.%I child where %s',dep.nspname,dep.relname,dep.predicate)into n using r->'collection';if n>0 then raise exception 'Later collection dependency';end if;end loop;
 delete from public.collections where id=976400001;
end;$undo$;commit;
`;
fs.writeFileSync(dir+'test-review-collection-manifest.json',JSON.stringify({project:m.target,collection,members,scope:'Test-only51 public records; excluded from production160 actions. Undo this fixture before core rollback.'},null,2)+'\n');fs.writeFileSync(dir+'test-review-collection-apply.sql',apply);fs.writeFileSync(dir+'test-review-collection-rollback.sql',undo);
