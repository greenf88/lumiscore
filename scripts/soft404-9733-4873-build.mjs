import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { renderImport, renderRollback } from './catalog-release-sql.mjs';

const dir = new URL('../catalog/soft404-9733-4873-20261110/', import.meta.url);
const review = JSON.parse(readFileSync(new URL('review.json', dir), 'utf8'));
const quote = value => "'" + JSON.stringify(value).replaceAll("'", "''") + "'::jsonb";
const omit = (value, keys) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
const insert = (relation, key, after, ref) => ({ relation, ref, key, before: null, after });

const plan = (target, suffix) => ({
  summary: { batch: review.batch + suffix, target, state: 'review_only' },
  bindings: [], actions: [], editionBindings: [],
});
const production = plan('qvplwejffhjvxaypmjut', '');
const fixture = plan('hlvujbrmfdlrfxdjwsmb', '-fixture');
const test = plan(fixture.summary.target, '-test');
for (const [index, item] of review.items.entries()) {
  const work = review.production.works.find(row => row.id === item.workId);
  const author = review.production.authors.find(row => row.id === work.author_id);
  const edition = review.production.editions.find(row => row.work_id === work.id);
  production.bindings.push({ work, author });
  production.editionBindings.push(edition);
  const fixtureAuthor = { ...omit(author, ['created_at']), id: 995020001 + index };
  const fixtureWork = { ...omit(work, ['created_at', 'subjects', 'subtitle']), id: 995020101 + index, author_id: fixtureAuthor.id };
  const fixtureEdition = { ...omit(edition, ['created_at']), id: 995020201 + index, work_id: fixtureWork.id, publish_date: null, cover_id: null };
  fixture.actions.push(insert('authors', { id: fixtureAuthor.id }, fixtureAuthor, 'author-' + work.id));
  fixture.actions.push(insert('works', { id: fixtureWork.id }, fixtureWork, 'work-' + work.id));
  fixture.actions.push(insert('editions', { id: fixtureEdition.id }, fixtureEdition, 'edition-' + work.id));
  test.bindings.push({ work: fixtureWork, author: fixtureAuthor });
  test.editionBindings.push(fixtureEdition);
  for (const [target, wid, aid] of [[production, work.id, author.id], [test, fixtureWork.id, fixtureAuthor.id]]) {
    const key = { work_id: wid, language: 'en' };
    target.actions.push(insert('catalog_work_descriptions', key, {
      ...key, bound_author_id: aid, text: item.text, source_type: item.sourceType,
      source_name: item.sourceName, source_url: item.sourceUrl,
      evidence: item.evidence.map(source => ({ ...source, checkedAt: review.reviewedAt })),
      provenance: 'original_source_reviewed_summary', review_status: 'approved',
      reviewed_at: review.reviewedAt, review_batch: review.batch,
    }, 'summary-' + work.id));
  }
}

function guard(plan) {
  if (!plan.editionBindings.length) return '';
  return `do $parents$ declare expected jsonb; actual jsonb; begin
  for expected in select value from jsonb_array_elements(${quote(plan.editionBindings)}) loop
    select to_jsonb(e) into actual from public.editions e where id=(expected->>'id')::bigint;
    if actual is distinct from expected then raise exception 'Exact edition drift; stop'; end if;
  end loop;
end;$parents$;
`;
}

function receiptScope(plan) {
  return `do $receipt_scope$ declare receipt jsonb; r jsonb; a jsonb; expected jsonb; begin
  receipt:=nullif(current_setting('lumiscore.catalog_release_receipt',true),'')::jsonb;
  if receipt->>'project' is distinct from '${plan.summary.target}' or receipt->>'batch' is distinct from '${plan.summary.batch}'
    or jsonb_array_length(receipt->'rows') is distinct from ${plan.actions.length} then raise exception 'Exact first committed receipt required'; end if;
  for r in select value from jsonb_array_elements(receipt->'rows') loop
    a:=(${quote(plan.actions)})->((r->>'seq')::integer-1);
    if a is null or r->>'relation' is distinct from a->>'relation' or r->'key' is distinct from a->'key'
      or r->'before_row' is distinct from a->'before' then raise exception 'Receipt outside exact reviewed scope'; end if;
    execute format('select to_jsonb(jsonb_populate_record(null::public.%I,$1))',a->>'relation') into expected using a->'after';
    if r->'after_row' is distinct from expected then raise exception 'Receipt content differs from proposal'; end if;
  end loop;
  if (select count(distinct value->>'seq') from jsonb_array_elements(receipt->'rows'))<> ${plan.actions.length}
    then raise exception 'Duplicate receipt sequence'; end if;
end;$receipt_scope$;
`;
}

const files = { 'review.json': readFileSync(new URL('review.json', dir), 'utf8') };
for (const [name, p] of Object.entries({ production, fixture, test })) {
  files[name + '-plan.json'] = JSON.stringify(p, null, 2) + '\n';
  for (const [mode, dryRun] of [['apply', false], ['dry-run', true]]) {
    files[name + '-' + mode + '.sql'] = renderImport(p, { indexed: true, dryRun, canary: name !== 'production' })
      .replace('create temporary table catalog_release_receipt', guard(p) + 'create temporary table catalog_release_receipt');
  }
  files[name + '-restore.sql'] = renderRollback(p, { indexed: true })
    .replace('do $undo$', guard(p) + receiptScope(p) + 'do $undo$');
}
for (const [name, value] of Object.entries(files)) writeFileSync(new URL(name, dir), value.replaceAll('\r\n', '\n'));
writeFileSync(new URL('release-hashes.json', dir), JSON.stringify({
  productionActions: production.actions.length,
  testFixtureRecords: fixture.actions.length,
  testDescriptionActions: test.actions.length,
  sha256: Object.fromEntries(Object.keys(files).map(name => [name, createHash('sha256').update(readFileSync(new URL(name, dir))).digest('hex')])),
}, null, 2) + '\n');
