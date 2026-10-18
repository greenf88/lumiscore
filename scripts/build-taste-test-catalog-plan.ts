// Offline builder. Output is TEST-ONLY SQL; it never connects to a database.
import { readFile, writeFile, mkdir, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { resolve, join } from 'node:path';
import { assessEditionProposal, type EditionProposal, type MetadataCaptureRow } from '../lib/catalog/taste-metadata-proposals.ts';
const [capturePath, sourcePath, outputPath] = process.argv.slice(2);
if (!capturePath || !sourcePath || !outputPath || process.argv.length !== 5) throw new Error('Supply capture JSON, capture source folder and external output folder');
const batch = JSON.parse(await readFile(new URL('../docs/proposals/taste-metadata-batch-20261018.json', import.meta.url), 'utf8'));
const raw = await readFile(resolve(capturePath));
if (createHash('sha256').update(raw).digest('hex') !== batch.captureSha256) throw new Error('Capture mismatch');
const captured = JSON.parse(raw.toString()) as { records: MetadataCaptureRow[] };
const sourceRows: { work: Record<string, unknown>; author: { name: string; open_library_id: string | null }; editions: Record<string, unknown>[] }[] = [];
for (const name of (await readdir(resolve(sourcePath))).filter(n => /^catalog-\d+\.json$/.test(n))) {
  const page = JSON.parse(await readFile(join(resolve(sourcePath), name), 'utf8'));
  sourceRows.push(...page.rows);
}
const plan = (batch.records as EditionProposal[]).map(p => {
  const capture = captured.records.find(r => r.workId === p.workId);
  const source = sourceRows.find(r => String(r.work.id) === p.workId);
  if (!capture || !source || source.work.open_library_id !== p.identityKey || source.author.name !== p.author) throw new Error('Identity mismatch');
  const check = assessEditionProposal(capture, p);
  if (!check.counterfactual.nl.eligible || capture.existing.existingReviewedCorrection) throw new Error('Not eligible unchanged');
  const en = p.enLanguageRepair ? source.editions.find(e => String(e.id) === p.enLanguageRepair!.editionId) : null;
  if (p.enLanguageRepair && !en) throw new Error('Missing existing source edition');
  return { sourceWorkId: p.workId, title: p.canonicalTitle, author: source.author, olid: p.identityKey,
    year: source.work.first_publish_year, type: source.work.work_type,
    categories: capture.existing.categories.map(c => c.id), evidence: capture.existing.contentEvidence,
    memberships: capture.existing.series,
    editions: [{ title: p.nl.title, language: 'nld', isbn13: p.nl.isbn13, olid: null, publisher: p.nl.publisher },
      ...(en && p.enLanguageRepair ? [{ title: en.title, language: 'eng', isbn13: en.isbn_13, olid: en.open_library_edition_id, publisher: en.publisher ?? null }] : [])],
  };
});
if (plan.length !== 8 || plan.reduce((n, r) => n + r.editions.length, 0) !== 13) throw new Error('Bounded import changed');
// Existing synthetic memberships occupy four reviewed first-volume slots.
// Preserve those records and the unique sequence constraint; import only the
// non-conflicting subset. No aliases or policy exceptions for test eligibility.
const heldIds = new Set(['25', '146', '171', '672']);
const importPlan = plan.filter(r => !heldIds.has(r.sourceWorkId));
if (importPlan.length !== 4 || importPlan.reduce((n,r) => n+r.editions.length,0) !== 7) throw new Error('Safe subset changed');
const payload = JSON.stringify(importPlan); if (payload.includes('$taste_payload$') || payload.includes('$test_seed$')) throw new Error('Unsafe delimiter');
const sql = `-- TEST ONLY: hlvujbrmfdlrfxdjwsmb. NO PRODUCTION IMPORT.
begin;
set local lock_timeout='5s';
do $test_seed$
declare item jsonb; edition jsonb; trait jsonb; member jsonb; wid bigint; aid bigint; cid bigint;
begin
  if not exists(select 1 from public.works where id=8800001 and native_identity_key='pr8-synthetic-1')
    or (select count(*) from public.works)<>389
    or exists(select 1 from public.works where open_library_id is not null) then
    raise exception 'Wrong or changed test target; stop before insert'; end if;
  -- Preserve explicit fixture IDs; allocate NEW identities safely beyond them.
  perform setval(pg_get_serial_sequence('public.authors','id'),greatest((select max(id) from public.authors),coalesce(pg_sequence_last_value(pg_get_serial_sequence('public.authors','id')::regclass),0)),true);
  perform setval(pg_get_serial_sequence('public.works','id'),greatest((select max(id) from public.works),coalesce(pg_sequence_last_value(pg_get_serial_sequence('public.works','id')::regclass),0)),true);
  perform setval(pg_get_serial_sequence('public.editions','id'),greatest((select max(id) from public.editions),coalesce(pg_sequence_last_value(pg_get_serial_sequence('public.editions','id')::regclass),0)),true);
  for item in select value from jsonb_array_elements($taste_payload$${payload}$taste_payload$::jsonb) loop
    insert into public.authors(name,open_library_id) values(item->'author'->>'name',item->'author'->>'open_library_id') returning id into aid;
    insert into public.works(title,author_id,first_publish_year,open_library_id,source_type,work_type)
      values(item->>'title',aid,(item->>'year')::int,item->>'olid','open_library',item->>'type') returning id into wid;
    for edition in select value from jsonb_array_elements(item->'editions') loop
      insert into public.editions(work_id,title,language,isbn_13,open_library_edition_id,publisher)
        values(wid,edition->>'title',edition->>'language',edition->>'isbn13',edition->>'olid',edition->>'publisher');
    end loop;
    insert into public.work_catalog_categories(work_id,category_id) select wid,value from jsonb_array_elements_text(item->'categories');
    for trait in select value from jsonb_array_elements(item->'evidence') loop
      insert into public.work_trait_evidence(work_id,trait,weight,confidence,source,source_key,raw_labels,mapping_version,verified_at)
        values(wid,trait->>'trait',(trait->>'weight')::numeric,(trait->>'confidence')::numeric,trait->>'source',trait->>'sourceKey',
        array(select jsonb_array_elements_text(trait->'rawLabels')),trait->>'mappingVersion',(trait->>'verifiedAt')::timestamptz);
    end loop;
    for member in select value from jsonb_array_elements(item->'memberships') loop
      select id into cid from public.collections where slug=member->>'slug' and collection_type=member->>'type'
        and expected_main_series_total=(member->>'expectedTotal')::int;
      if cid is null or (member->>'sequence')::int<>1 then raise exception 'Reviewed series mismatch'; end if;
      insert into public.collection_books(collection_id,work_id,sequence_number,subgroup) values(cid,wid,1,member->>'subgroup');
    end loop;
  end loop;
end;
$test_seed$;
commit;
`;
await mkdir(resolve(outputPath), { recursive: true });
await writeFile(join(resolve(outputPath), 'test-catalog-seed.sql'), sql);
await writeFile(join(resolve(outputPath), 'test-catalog-plan.json'), JSON.stringify({ project: 'hlvujbrmfdlrfxdjwsmb', testOnly: true,
  sourceReview: 'Codex source recheck, 2026-10-18; NOT human certification or production approval', records: importPlan,
  held: plan.filter(r => heldIds.has(r.sourceWorkId)).map(r => ({olid:r.olid,reason:'Existing synthetic first-volume membership preserved'})) }, null, 2));
console.log(JSON.stringify({ testOnly: true, works: importPlan.length, editions: 7, held:4, existingRecordsUpdated: 0, sqlSha256: createHash('sha256').update(sql).digest('hex') }));
