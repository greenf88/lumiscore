import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

// Consistency checks for recorded hosted observations; not a substitute for
// executing the browser flow or for the separate 79 real-book acceptance.
const root = new URL('../catalog/nl-release-079-20261101/', import.meta.url);
const read = name => JSON.parse(fs.readFileSync(new URL(name, root), 'utf8'));
const proof = read('hosted-authenticated.json');
const cleanup = read('auth-cleanup.json');
const valid = proof.observations.filter(row => !row.excludedReason);
const row = route => valid.find(item => item.route === route);

test('fresh authenticated evidence is bound to the exact tested Preview and excludes cancelled navigation', () => {
  assert.equal(proof.applicationSha, '5e919664e20f408e950c07b490cd1e638b2ed431');
  assert.equal(proof.deploymentId, 'dpl_ETokDkzBMSusrUFwQ1A2DfxVQXrU');
  assert.equal(proof.project, 'hlvujbrmfdlrfxdjwsmb');
  assert.equal(valid.length, 20);
  assert.equal(proof.observations.length - valid.length, 1);
  assert(valid.every(item => item.authenticated));
  assert(valid.every(item => item.scrollWidth <= item.width));
  assert.deepEqual([...new Set(valid.map(item => item.width))].sort((a,b) => a-b), [320,390,1440]);
  assert.deepEqual([...new Set(valid.map(item => item.theme))].sort(), ['ink','paper']);
});

test('fresh personalized recommendation and result cards retain NL/EN presentation and unchanged synthetic Work order', () => {
  for (const [nlRoute, enRoute] of [['/nl/recommendations','/en/recommendations back'], ['/nl/taste-test/result','/en/taste-test/result']]) {
    const nl = row(nlRoute).cards, en = row(enRoute).cards;
    assert.equal(nl.length,20); assert.equal(en.length,20);
    assert.deepEqual(nl.map(item => item.id), en.map(item => item.id));
    assert(nl.every(item => item.title.startsWith('Synthetisch Boek ') && item.href.startsWith('/nl/book/')));
    assert(en.every(item => item.title.startsWith('Synthetic Book ') && item.href.startsWith('/en/book/')));
    assert(!nl.some(item => item.id === 'work-8800001'));
  }
  assert.deepEqual(row('/nl/recommendations').cards.map(x=>x.id), row('/nl/recommendations 1440 reload').cards.map(x=>x.id));
});

test('recommendation detail matches locale and public score without pretending synthetic placeholders are found covers', () => {
  const nl = row('/nl/book/8800132?returnTo=recommendations');
  const en = row('/en/book/8800132 reload');
  assert.equal(nl.title,'Synthetisch Boek 132'); assert.equal(en.title,'Synthetic Book 132');
  assert(nl.information.includes('NLD')); assert(en.information.includes('ENG'));
  assert.equal(nl.score,row('/nl/recommendations').cards[0].score);
  assert.equal(en.score,row('/en/recommendations back').cards[0].score);
  assert.equal(nl.images.length,0); assert.equal(en.images.length,0);
  assert(nl.description.missing && en.description.missing);
  assert.equal(proof.round.completed,false);
  assert.equal(proof.rating.records,1);
});

test('real release-book authenticated observations keep source-bound NL summaries, exact editions and loaded images', () => {
  const phm = row('/nl/book/928100001');
  const follett = row('/nl/book/928101387 320 Ink reload settled');
  for (const item of [phm,follett]) {
    assert(item.description.visibleText && !item.description.missing && !item.description.loading);
    assert(item.source.startsWith('https://'));
    assert(item.images.length > 0 && item.images.every(image => image.complete && image.width > 0));
    assert(item.information.includes('NLD'));
  }
  assert(phm.information.includes('9789401614078'));
  assert(follett.information.includes('9789047511540'));
  const english = row('/en/book/928101387 description settled');
  assert(english.information.includes('ENG') && english.information.includes('9780688046590'));
  assert(english.description.visibleText && !english.description.loading);
  assert(english.images.every(image => image.complete && image.width > 0));
  assert.equal(follett.score,row('/nl/search back original Follett').cards[0].score);
});

test('own temporary account/rating/status/incomplete round were removed; existing private data and catalogue counts preserved', () => {
  assert(cleanup.accountDeleted);
  assert.equal(cleanup.productionWrites,0); assert.equal(cleanup.catalogWrites,0);
  for (const key of ['ownAccount','ownRatings','ownStatuses','ownRounds']) assert.equal(cleanup.before[key],1);
  for (const key of ['ownAccount','ownRatings','ownStatuses','ownRounds','ownOffers','ownResponses','ownPreferences']) assert.equal(cleanup.after[key],0);
  for (const key of ['existingRatings','existingStatuses','existingAccounts','publicCatalogCounts']) assert.deepEqual(cleanup.before[key],cleanup.after[key]);
  assert.equal(cleanup.after.existingRatings.count,68);
  assert.equal(cleanup.after.existingStatuses.count,68);
  assert.equal(cleanup.after.existingAccounts.count,2);
});
