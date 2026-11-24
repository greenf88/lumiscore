import assert from 'node:assert/strict';
import test from 'node:test';
import {createFormSubmissionLatch} from './form-submission.ts';

test('rapid repeated submits claim one request before any asynchronous rendering', async () => {
  const form=createFormSubmissionLatch();
  let calls=0;
  await Promise.all(Array.from({length:10},async()=>{if(form.claim()){calls++;await Promise.resolve()}}));
  assert.equal(calls,1);
  assert.equal(form.claim(),false,'pending state is not cleared by a timer or failed provider response');
  assert.equal(form.restore(false),false,'a late initial pageshow must not reopen an in-flight submit');
  assert.equal(form.claim(),false);
  assert.equal(form.restore(true),true);
  assert.equal(form.claim(),true,'return from a native POST through browser history can submit again');
});

test('one pending form does not block another reader or form',()=>{
  const first=createFormSubmissionLatch(),second=createFormSubmissionLatch();
  assert.equal(first.claim(),true);
  assert.equal(second.claim(),true);
  first.restore(true);
  assert.equal(second.claim(),false);
});
