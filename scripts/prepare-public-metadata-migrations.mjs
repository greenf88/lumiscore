// Reproducibly promote the existing reviewed proposals, with explicit safety additions.
// Local files only. Does not connect to a database.
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../',import.meta.url),read=async p=>(await readFile(new URL(p,root),'utf8')).replaceAll('\r\n','\n');
// SQL dollars are literal, never JavaScript replacement-string substitutions.
const literal=(source,find,value)=>source.replace(find,()=>value);
let snapshot=await read('docs/proposals/description-snapshots.sql.proposal');
snapshot=literal(snapshot,'-- REVIEW/ISOLATED TEST ONLY. No production installation in this task.','-- Public exact-edition snapshots. Independently reviewed installation required.');
snapshot=literal(snapshot," return new;",` if tg_op='UPDATE' and new.fetched_at=old.fetched_at and
  (new.text is distinct from old.text or new.binding_hash is distinct from old.binding_hash) then
  raise exception 'Changed payload at the same fetch revision';end if;
 return new;`);
snapshot=literal(snapshot,'commit;',`-- A trusted correction/withdrawal must match the exact current snapshot.
create function public.withdraw_catalog_description_snapshot(p_work_id bigint,p_edition_id bigint,p_locale text,p_binding_hash text,p_fetched_at timestamptz)
returns boolean language plpgsql security definer set search_path=pg_catalog as $$
declare affected integer;
begin
 delete from public.catalog_description_snapshots where work_id=p_work_id and edition_id=p_edition_id and locale=p_locale
  and binding_hash=p_binding_hash and fetched_at=p_fetched_at;
 get diagnostics affected=row_count;
 if affected=0 then raise exception 'Snapshot withdrawal CAS mismatch or absent row';end if;
 return true;
end $$;
revoke all on function public.withdraw_catalog_description_snapshot(bigint,bigint,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.withdraw_catalog_description_snapshot(bigint,bigint,text,text,timestamptz) to service_role;
commit;`);
await writeFile(new URL('supabase/migrations/20261108121440_public_description_snapshots.sql',root),snapshot);
let revision=await read('docs/proposals/book-lastmod-ledger.sql.proposal');
revision=literal(revision,'-- REVIEW ONLY. Not in supabase/migrations; never installed by this code PR.','-- Public verified change ledger. No automatic dates or historical backfill.');
revision=literal(revision,' content_changed_at timestamptz not null,'," content_changed_at timestamptz not null,\n receipt_sha256 text not null check(receipt_sha256 ~ '^[a-f0-9]{64}$'),");
revision=literal(revision,'p_changed_at timestamptz\n','p_changed_at timestamptz,p_receipt_sha256 text\n');
revision=literal(revision,'set search_path=pg_catalog,public','set search_path=pg_catalog');
revision=literal(revision,"or p_new_hash !~ '^[a-f0-9]{64}$' or p_changed_at is null", "or p_new_hash !~ '^[a-f0-9]{64}$' or p_receipt_sha256 is null or p_receipt_sha256 !~ '^[a-f0-9]{64}$' or p_changed_at is null");
revision=literal(revision,' select * into prior'," -- Serialize the missing-row case too, without table-wide locking.\n perform pg_advisory_xact_lock(hashtextextended(p_work_id::text||':'||p_locale,0));\n select * into prior");
revision=literal(revision,'content_changed_at=p_changed_at where','content_changed_at=p_changed_at,receipt_sha256=p_receipt_sha256 where');
revision=literal(revision,'values(p_work_id,p_locale,p_new_hash,p_changed_at)','values(p_work_id,p_locale,p_new_hash,p_changed_at,p_receipt_sha256)');
revision=revision.replaceAll('record_catalog_public_revision(bigint,text,text,text,timestamptz)','record_catalog_public_revision(bigint,text,text,text,timestamptz,text)');
await writeFile(new URL('supabase/migrations/20261108121441_public_page_revision_ledger.sql',root),revision);
