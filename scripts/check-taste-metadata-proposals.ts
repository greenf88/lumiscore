// Offline, read-only; stdout report. Intentionally no apply flag or DB client.
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { assessEditionProposal, type MetadataCaptureRow, type EditionProposal } from '../lib/catalog/taste-metadata-proposals.ts';
const source = process.argv[2];
if (!source || process.argv.length !== 3) throw new Error('Supply only the existing catalog-metadata-review.json path; no apply mode');
const batch = JSON.parse(await readFile(new URL('../docs/proposals/taste-metadata-batch-20261018.json', import.meta.url), 'utf8')) as {
  captureSha256: string; status: string; humanApproval: null; records: EditionProposal[];
};
const raw = await readFile(source);
if (createHash('sha256').update(raw).digest('hex') !== batch.captureSha256) throw new Error('Capture changed; fresh source/identity review required');
if (batch.status !== 'SOURCE_SUPPORTED_REVIEW_REQUIRED' || batch.humanApproval !== null) throw new Error('This tool cannot approve metadata');
const capture = JSON.parse(raw.toString()) as { summary: { suitableUniqueWorks: { nl: number; en: number } }; records: MetadataCaptureRow[] };
const byId = new Map(capture.records.map(row => [row.workId, row]));
if (byId.size !== capture.records.length || new Set(batch.records.map(r => r.workId)).size !== batch.records.length) throw new Error('Duplicate Work ID');
const results = batch.records.map(p => {
  const row = byId.get(p.workId); if (!row) throw new Error('Work missing: ' + p.workId);
  return assessEditionProposal(row, p);
});
const before = capture.summary.suitableUniqueWorks;
const delta = (language: 'nl' | 'en') => results.filter(r => !r.before[language].eligible && r.counterfactual[language].eligible).length;
console.log(JSON.stringify({ status: 'LOCAL_COUNTERFACTUAL_ONLY', actualCaptured: before,
  proposedNewNlEditions: batch.records.length, proposedEnglishLanguageRepairs: batch.records.filter(r => r.enLanguageRepair).length,
  ifReviewedAndApplied: { nl: before.nl + delta('nl'), en: before.en + delta('en') },
  humanApproved: 0, applied: 0, noPersonalExclusionsApplied: true,
  warning: 'Not current DB counts or proof of a 10/15/30 round. Skips/read/ratings reduce personal inventory; no source approval or write performed.', results }, null, 2));
