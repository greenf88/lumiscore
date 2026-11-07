import test from 'node:test';
import assert from 'node:assert/strict';
import { DescriptionProviderGate } from './description-provider-gate.ts';

const turn = () => new Promise<void>(resolve => setImmediate(resolve));

test('quota releases queued callers without an initial unbounded burst', async () => {
  const gate = new DescriptionProviderGate(['books']);
  let calls = 0, active = 0, peak = 0;
  let finish!: () => void;
  const response = new Promise<void>(resolve => { finish = resolve; });
  const all = Array.from({length:40}, () => gate.run('books', async () => {
    calls++; active++; peak = Math.max(peak, active);
    await response; gate.pause('books', Date.now()+60_000); active--; return 'temporary';
  }));
  await turn(); assert.equal(calls,2); finish();
  const outcomes = await Promise.all(all);
  assert.equal(peak,2); assert.equal(calls,2); assert.equal(outcomes.filter(x=>x===null).length,38);
  assert.equal(await gate.run('books', async()=>{calls++;return 'unexpected';}),null);
  assert.equal(calls,2);
});

test('healthy requests queue fairly, expire with a bound and always release slots', async () => {
  const gate = new DescriptionProviderGate(['books'],1,1,20);
  let finish!: () => void; const wait = new Promise<void>(resolve=>{finish=resolve;});
  const first=gate.run('books',async()=>{await wait;return 1;});
  const second=gate.run('books',async()=>2);
  assert.equal(await gate.run('books',async()=>3),null,'queue size is bounded');
  assert.equal(await second,null,'waiting has a bounded deadline');
  finish();assert.equal(await first,1);
  await assert.rejects(gate.run('books',async()=>{throw Error('synthetic transport');}),/synthetic/);
  assert.equal(await gate.run('books',async()=>4),4,'failed operation cannot leak its slot');
});

test('cooldowns are provider scoped, longest instruction wins, and recovery permits work',async()=>{
  const gate=new DescriptionProviderGate(['a','b']);const realNow=Date.now;let now=realNow();Date.now=()=>now;
  try{gate.pause('a',now+120_000);gate.pause('a',now+1_000);
    assert.equal(await gate.run('a',async()=>1),null);assert.equal(await gate.run('b',async()=>2),2);
    now+=61_000;assert.equal(await gate.run('a',async()=>3),null);
    now+=60_000;assert.equal(await gate.run('a',async()=>4),4);
  }finally{Date.now=realNow;gate.resetForTests();}
});

test('independent warm processes have independent guards, never project-wide limits',async()=>{
  const a=new DescriptionProviderGate(['books']),b=new DescriptionProviderGate(['books']);
  a.pause('books',Date.now()+60_000);
  assert.equal(await a.run('books',async()=>1),null);
  assert.equal(await b.run('books',async()=>2),2);
});
