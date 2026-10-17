import test from 'node:test';
import assert from 'node:assert/strict';
import {buildFindings,compareSnapshots,reconcileFindings,validateSnapshot} from './operations/core.mjs';
const snapshot=()=>({schemaVersion:1,project:'lumiscore-production',capturedAt:'2026-10-16T20:00:00Z',
  metrics:{works:100,collections:2,ratings:20,ratingAccounts:4,ratedWorks:10,traitWorks:90,contentTraitWorks:90,completedRounds:2},
  coverStates:{resolved:80,temporary_failure:60},coverRetryDue:60,coverTemporaryWithoutResolved:0,
  invalidMemberships:0,missingAuthors:0,duplicateOpenLibraryIds:0,emptyTitles:0,
  collectionCoverage:[{slug:'series-one',type:'series',expected:3,catalogued:3},{slug:'universe',type:'universe',expected:null,catalogued:10}]});
test('fail closed on incomplete or wrong-project snapshots',()=>{
  assert.throws(()=>validateSnapshot({...snapshot(),project:'other'}));
  const s=snapshot();delete s.coverTemporaryWithoutResolved;assert.throws(()=>validateSnapshot(s));
  assert.throws(()=>validateSnapshot({...snapshot(),metrics:{...snapshot().metrics,contentTraitWorks:101}}));
});
test('source failures with resolved alternatives do not become missing-cover alerts',()=>{
  assert.deepEqual(buildFindings(snapshot()),[]);
  const s=snapshot();s.coverTemporaryWithoutResolved=2;
  assert.equal(buildFindings(s)[0].count,2);
});
test('catalog coverage is not user progress and unknown totals are never invented',()=>{
  const s=snapshot();s.collectionCoverage[0].catalogued=2;
  const f=buildFindings(s);assert.equal(f.length,1);assert.match(f[0].message,/2\/3 catalogued/);
  s.collectionCoverage[0].expected=null;assert.deepEqual(buildFindings(s),[]);
});
test('stable findings deduplicate, resolve, reopen and retain first seen',()=>{
  const s=snapshot();s.missingAuthors=1;const at=s.capturedAt;
  const first=reconcileFindings(buildFindings(s),undefined,at);assert.equal(first.changes[0].lifecycle,'new');
  const second=reconcileFindings(buildFindings(s),first.state,at);assert.equal(second.changes.length,0);
  s.missingAuthors=2;const third=reconcileFindings(buildFindings(s),second.state,at);assert.equal(third.changes[0].lifecycle,'changed');
  s.missingAuthors=0;const fourth=reconcileFindings(buildFindings(s),third.state,at);assert.equal(fourth.changes[0].lifecycle,'resolved');
  s.missingAuthors=1;const fifth=reconcileFindings(buildFindings(s),fourth.state,at);assert.equal(fifth.changes[0].lifecycle,'reopened');
  assert.equal(fifth.state.items[0].firstSeen,at);
});
test('reject duplicate collection slugs and corrupted state; no silent reset',()=>{
  const s=snapshot();s.collectionCoverage[1].slug='series-one';assert.throws(()=>validateSnapshot(s));
  assert.throws(()=>reconcileFindings([],{schemaVersion:1,items:[{key:'a'},{key:'a'}]},snapshot().capturedAt));
});
test('baseline has no fabricated trend and older snapshots are rejected',()=>{
  assert.equal(compareSnapshots(snapshot()).baseline,true);
  const s=snapshot();s.metrics.works+=1;assert.equal(compareSnapshots(s,snapshot()).deltas.works,1);
  s.capturedAt='2026-10-15T00:00:00Z';assert.throws(()=>compareSnapshots(s,snapshot()));
});
