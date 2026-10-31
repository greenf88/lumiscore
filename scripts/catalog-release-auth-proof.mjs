// Offline validation of actual hosted browser captures and public TEST readback.
// No browser automation, network, credentials or database writes in this script.
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {selectStrictEdition,permittedEditionLanguage} from '../lib/books/strict-edition.ts';
const root=new URL('../catalog/release-20261031/',import.meta.url);
const read=n=>JSON.parse(fs.readFileSync(new URL(n,root),'utf8'));
const proof=read('authenticated-browser-checks.json'),editions=read('authenticated-edition-readback.json');
const normal=s=>s.trim().replace(/\s+/g,' ').toLowerCase();
const get=label=>{const p=proof.find(x=>x.label===label);assert(p,'Missing '+label);return p;};
const cardLinks=p=>p.links.filter(x=>/\/book\/\d+\?returnTo=/.test(x.href));
const selection=[];
for(const locale of ['nl','en']){
 for(const device of ['mobile','desktop'])for(const theme of ['ink','paper']){
  const p=get(`authenticated-${locale}-recommendations-${device}-${theme}`);
  assert.equal(p.width,device==='mobile'?390:1280);assert.equal(p.overflow,false);
  assert.equal(cardLinks(p).length,20);
 }
 const p=get(`authenticated-${locale}-recommendations-desktop-paper`);
 for(const link of cardLinks(p)){
  const workId=Number(link.href.match(/\/book\/(\d+)/)[1]);assert.notEqual(workId,8800001);
  const available=editions.filter(e=>e.work_id===workId);
  const chosen=selectStrictEdition(available,locale,available.find(e=>permittedEditionLanguage(e,'en'))?.title??'');
  assert(chosen);assert(link.text.split('\n').some(t=>normal(t)===normal(chosen.title)),`Card identity ${workId}/${locale}`);
  selection.push({workId,locale,availableNl:available.filter(e=>permittedEditionLanguage(e,'nl')),availableEn:available.filter(e=>permittedEditionLanguage(e,'en')),selectedEdition:chosen,reason:'Exact visible title matches the shared strict selection; confirmed same-language edition; no English fallback for NL'});
 }
}
const order=p=>cardLinks(p).map(x=>Number(x.href.match(/\/book\/(\d+)/)[1]));
assert.deepEqual(order(get('authenticated-nl-recommendations-reload')),order(get('authenticated-nl-recommendations-desktop-ink')));
assert.deepEqual(order(get('authenticated-en-return-to-recommendations')),order(get('authenticated-en-recommendations-desktop-paper')));
for(const p of proof){assert.equal(p.applicationSha,'9d3b9a85123b5fe0679c80ec266ae47481cd075a');assert.equal(p.overflow,false);}
assert(get('authenticated-nl-recommendation-detail').text.includes('NLD'));
assert(get('authenticated-en-recommendation-detail').text.includes('ENG'));
assert(get('authenticated-dune-nl-denominator-six').text.includes('0 van 6 gelezen'));
assert(get('authenticated-dune-en-denominator-six').text.includes('0 of 6 read'));
assert(get('authenticated-own-rating-implies-one-of-three-read').text.includes('1 van 3 gelezen'));
for(const label of ['authenticated-nl-oversteek-reload-mobile-ink','authenticated-en-passage-detail-mobile-paper','authenticated-native-detail-reload-mobile-paper']){
 const p=get(label);assert(p.images.some(x=>x.complete&&x.width>0),'No loaded cover '+label);assert(p.text.includes('ISBN-13'));
}
assert(get('authenticated-empty-profile-after-cleanup').text.includes('geen bruikbaar smaakprofiel'));
const fixture=read('authenticated-fixture-readback.json'),cleanup=read('authenticated-cleanup-readback.json');
assert.deepEqual(fixture.stored.ratings,[{rating:8,work_id:8800001}]);
for(const field of ['ratings','statuses','responses','rounds'])assert.equal(fixture.after[field],0);
assert.equal(cleanup.ownTemporaryAccountExists,false);assert.equal(cleanup.ownSessions,0);assert.equal(cleanup.ownRatings,0);assert.equal(cleanup.ownStatuses,0);
const summary={testedApplication:'9d3b9a85123b5fe0679c80ec266ae47481cd075a',equivalentReleaseHead:'45f331419156927034434c94e36bc05717193206',environment:'Hosted TEST hlvujbrmfdlrfxdjwsmb',checks:proof.length,themeLocaleDeviceCases:8,recommendationWorkIdentities:20,verifiedLocaleSelections:selection.length,selection,savedAndReadBackOwnSyntheticRating:true,ownRatingAndStatusCleaned:true,temporaryAccountAndSessionsRemoved:true,productionWrites:0,limitations:['Recommendation candidates are pre-existing synthetic catalogue fixtures, using a single synthetic owner rating; not a production recommendation-quality measurement.','Real existing/new catalogue pages separately prove stored summaries, sources and loaded edition covers.','Synthetic recommendation placeholders are not counted as found covers.','Not a full taste-test completion: the separately documented missing-anchor issue remains.','Hosted receipt-bound canary undo remains explicitly declined and was not retried.']};
fs.writeFileSync(new URL('authenticated-validation-summary.json',root),JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify({checks:summary.checks,themeLocaleDeviceCases:8,verifiedLocaleSelections:40,ownTestDataCleaned:true,productionWrites:0}));
