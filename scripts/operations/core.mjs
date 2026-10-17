// Pure operations policy. No credentials, networking, user records or database writes.
import { createHash } from 'node:crypto';

const counters = ['invalidMemberships', 'missingAuthors', 'duplicateOpenLibraryIds', 'emptyTitles',
  'coverRetryDue', 'coverTemporaryWithoutResolved'];
const metrics = ['works','collections','ratings','ratingAccounts','ratedWorks','traitWorks','contentTraitWorks','completedRounds'];
const integer = (x) => Number.isSafeInteger(x) && x >= 0;

export function validateSnapshot(value) {
  if (!value || value.schemaVersion !== 1 || value.project !== 'lumiscore-production'
    || !Number.isFinite(Date.parse(value.capturedAt))) throw new Error('Invalid snapshot identity/version/date.');
  if (!value.metrics || metrics.some((key) => !integer(value.metrics[key]))
    || counters.some((key) => !integer(value[key]))) throw new Error('Missing or invalid counters.');
  if (value.metrics.contentTraitWorks > value.metrics.traitWorks || value.metrics.traitWorks > value.metrics.works
    || value.metrics.ratedWorks > value.metrics.works || value.metrics.ratingAccounts > value.metrics.ratings)
    throw new Error('Inconsistent coverage/reader counters.');
  if (!value.coverStates || Object.entries(value.coverStates).some(([state,n]) =>
    !['resolved','temporary_failure','confirmed_missing'].includes(state) || !integer(n)))
    throw new Error('Invalid cover state counters.');
  if (!Array.isArray(value.collectionCoverage) || value.collectionCoverage.length !== value.metrics.collections
    || new Set(value.collectionCoverage.map((c) => c.slug)).size !== value.collectionCoverage.length
    || value.collectionCoverage.some((c) => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(c.slug)
      || !['series','universe','author_collection'].includes(c.type)
      || !integer(c.catalogued) || !(c.expected === null || integer(c.expected) && c.expected > 0)))
    throw new Error('Invalid collection coverage.');
  return value;
}

export function buildFindings(raw) {
  const s = validateSnapshot(raw);
  const findings = [];
  const add = (key, severity, count, message) => findings.push({key,severity,count,message});
  for (const key of ['invalidMemberships','missingAuthors','duplicateOpenLibraryIds','emptyTitles']) {
    if (s[key]) add(`catalog:${key}`, 'P1', s[key], `${s[key]} catalog integrity anomalies: ${key}.`);
  }
  const ratio = s.metrics.works ? s.metrics.contentTraitWorks / s.metrics.works : 0;
  if (s.metrics.works === 0) add('catalog:empty','P0',0,'No Works returned; verify target and permissions before assuming deletion.');
  else if (ratio < .8) add('metadata:content-coverage','P1',s.metrics.works-s.metrics.contentTraitWorks,
    `${s.metrics.contentTraitWorks}/${s.metrics.works} Works have stored non-period traits. Presence is not validation or exact runtime eligibility.`);
  if (s.coverTemporaryWithoutResolved) add('covers:temporary-without-resolved','P2',s.coverTemporaryWithoutResolved,
    `${s.coverTemporaryWithoutResolved} Works have temporary cache failures without a resolved cache source; this is not proof of a missing displayed image.`);
  for (const c of s.collectionCoverage) {
    if (c.type !== 'series' || c.expected === null) continue;
    if (c.catalogued < c.expected) add(`collection:${c.slug}:coverage`,'P2',c.expected-c.catalogued,
      `${c.slug}: ${c.catalogued}/${c.expected} catalogued. Expected total is stored, not independently researched.`);
    if (c.catalogued > c.expected) add(`collection:${c.slug}:denominator`,'P2',c.catalogued-c.expected,
      `${c.slug}: count exceeds stored main-series total; inspect companion-book membership before changing anything.`);
  }
  return findings.sort((a,b) => a.severity.localeCompare(b.severity) || a.key.localeCompare(b.key));
}

const fingerprint = ({severity,count,message}) => createHash('sha256')
  .update(JSON.stringify({severity,count,message})).digest('hex');

export function reconcileFindings(findings, previous = {schemaVersion:1,items:[]}, at) {
  if (!Number.isFinite(Date.parse(at)) || previous.schemaVersion !== 1 || !Array.isArray(previous.items)
    || previous.items.some((x) => !x || typeof x.key !== 'string')
    || new Set(previous.items.map((x)=>x.key)).size !== previous.items.length)
    throw new Error('Invalid previous state/date.');
  const old = new Map(previous.items.map((x)=>[x.key,x]));
  const changes = [];
  const items = findings.map((f) => {
    const prior = old.get(f.key);
    const hash = fingerprint(f);
    const lifecycle = !prior ? 'new' : prior.status === 'resolved' ? 'reopened'
      : prior.fingerprint !== hash ? 'changed' : 'unchanged';
    const item = {...f,fingerprint:hash,status:'open',firstSeen:prior?.firstSeen ?? at,lastSeen:at,
      occurrences:(prior?.occurrences ?? 0)+1};
    if(lifecycle !== 'unchanged') changes.push({...item,lifecycle});
    old.delete(f.key);
    return item;
  });
  for(const prior of old.values()) {
    const resolved = {...prior,status:'resolved',resolvedAt:prior.resolvedAt ?? at};
    items.push(resolved);
    if(prior.status !== 'resolved') changes.push({...resolved,lifecycle:'resolved'});
  }
  return {state:{schemaVersion:1,items:items.sort((a,b)=>a.key.localeCompare(b.key))},changes};
}

export function compareSnapshots(current, previous) {
  validateSnapshot(current);
  if (!previous) return {baseline:true,deltas:{}};
  validateSnapshot(previous);
  if (Date.parse(current.capturedAt) < Date.parse(previous.capturedAt)) throw new Error('Snapshot predates baseline.');
  return {baseline:false,deltas:Object.fromEntries(metrics.map((key)=>[key,current.metrics[key]-previous.metrics[key]]))};
}

export function renderReport(snapshot, reconciliation, comparison) {
  const changes = reconciliation.changes;
  return [
    '# LumiScore operations', '', `Captured: ${snapshot.capturedAt}`, '',
    `Works: ${snapshot.metrics.works}; Collections: ${snapshot.metrics.collections}.`,
    `Stored non-period traits: ${snapshot.metrics.contentTraitWorks}/${snapshot.metrics.works} (not a correctness claim).`,
    `Temporary cover failures without resolved cache source: ${snapshot.coverTemporaryWithoutResolved}.`, '',
    comparison.baseline ? 'Baseline established; no trend inferred.' : `Metric deltas: ${JSON.stringify(comparison.deltas)}`, '',
    '## Changes', '',
    ...(changes.length ? changes.map((f)=>`- **${f.lifecycle} ${f.severity}** ${f.key}: ${f.message}`)
      : ['No new, changed, reopened or resolved findings.']), '',
    '## Open findings', '',
    ...reconciliation.state.items.filter((x)=>x.status==='open').map((f)=>`- [ ] **${f.severity}** ${f.key}: ${f.message}`), '',
    'Counts describe catalog/cache evidence, not reading progress or predictive accuracy.',
    'Internal aggregate output: do not publish reader counts, credentials or personal data to GitHub.', '',
  ].join('\n');
}
