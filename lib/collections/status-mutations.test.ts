import assert from 'node:assert/strict';
import test from 'node:test';
import {
  executeStatusMutation,
  parseBulkStatusPayload,
  planGuestWantToReadMigration,
  RatedWorkStatusConflictError,
  StatusReconciliationError,
  type CanonicalStatusState,
  type StatusMutationAdapter,
} from './status-mutations.ts';
import type { ReadingStatus } from './model.ts';

function adapter(initial: CanonicalStatusState, options: {
  failWrite?: boolean;
  failReconcile?: boolean;
  addRatingAfterWrite?: string;
} = {}) {
  const state: CanonicalStatusState = {
    statuses: new Map(initial.statuses),
    ratedWorkIds: new Set(initial.ratedWorkIds),
  };
  let wrote = false;
  const calls = { loads: 0, upserts: 0, deletes: 0 };
  const implementation: StatusMutationAdapter = {
    loadState: async () => {
      calls.loads += 1;
      if (wrote && options.failReconcile) throw new Error('READ_FAILED');
      return { statuses: new Map(state.statuses), ratedWorkIds: new Set(state.ratedWorkIds) };
    },
    upsertStatuses: async (rows) => {
      calls.upserts += 1;
      if (options.failWrite && !wrote) throw new Error('WRITE_FAILED');
      wrote = true;
      for (const row of rows) state.statuses.set(row.workId, row.status);
      if (options.addRatingAfterWrite) state.ratedWorkIds.add(options.addRatingAfterWrite);
    },
    deleteStatuses: async (workIds) => {
      calls.deletes += 1;
      if (options.failWrite) throw new Error('WRITE_FAILED');
      wrote = true;
      for (const workId of workIds) state.statuses.delete(workId);
      if (options.addRatingAfterWrite) state.ratedWorkIds.add(options.addRatingAfterWrite);
    },
  };
  return { implementation, calls, getState: () => state };
}

test('strict bulk payload accepts canonical unique IDs and rejects bypasses', () => {
  assert.deepEqual(parseBulkStatusPayload({
    workIds: ['1', '1296'], action: 'set', status: 'reading',
  }), { workIds: ['1', '1296'], action: 'set', status: 'reading' });
  for (const invalid of [
    { workIds: [], action: 'set', status: 'read' },
    { workIds: ['01'], action: 'set', status: 'read' },
    { workIds: ['1', '1'], action: 'set', status: 'read' },
    { workIds: ['1'], action: 'clear', status: 'read' },
    { workIds: ['1'], action: 'set', status: 'finished' },
    { workIds: ['1'], action: 'set', status: 'read', extra: true },
    { workIds: Array.from({ length: 101 }, (_, index) => String(index + 1)), action: 'clear' },
  ]) assert.equal(parseBulkStatusPayload(invalid), null);
});

test('rated work rejects incompatible status before any write', async () => {
  const mock = adapter({ statuses: new Map([['8', 'read']]), ratedWorkIds: new Set(['8']) });
  await assert.rejects(
    executeStatusMutation(
      { workIds: ['8'], action: 'set', status: 'reading' },
      mock.implementation,
    ),
    (error) => error instanceof RatedWorkStatusConflictError &&
      error.conflictingWorkIds.join(',') === '8',
  );
  assert.deepEqual(mock.calls, { loads: 1, upserts: 0, deletes: 0 });
});

test('one rated conflict blocks the whole homogeneous batch before writes', async () => {
  const mock = adapter({
    statuses: new Map([['8', 'read'], ['9', 'want_to_read']]),
    ratedWorkIds: new Set(['8']),
  });
  await assert.rejects(executeStatusMutation(
    { workIds: ['8', '9'], action: 'clear', status: null },
    mock.implementation,
  ), RatedWorkStatusConflictError);
  assert.deepEqual(mock.calls, { loads: 1, upserts: 0, deletes: 0 });
  assert.equal(mock.getState().statuses.get('9'), 'want_to_read');
});

test('rated work accepts Read and idempotent actions write nothing', async () => {
  const mock = adapter({ statuses: new Map([['8', 'read']]), ratedWorkIds: new Set(['8']) });
  const result = await executeStatusMutation(
    { workIds: ['8'], action: 'set', status: 'read' },
    mock.implementation,
  );
  assert.equal(result.changed, 0);
  assert.deepEqual(mock.calls, { loads: 1, upserts: 0, deletes: 0 });
});

test('bulk mutation performs one homogeneous write and preserves ratings', async () => {
  const mock = adapter({
    statuses: new Map([['1', 'want_to_read']]),
    ratedWorkIds: new Set(),
  });
  const result = await executeStatusMutation(
    { workIds: ['1', '2'], action: 'set', status: 'read' },
    mock.implementation,
  );
  assert.equal(result.changed, 2);
  assert.equal(mock.calls.upserts, 1);
  assert.equal(mock.calls.deletes, 0);
  assert.equal(result.statuses.get('1'), 'read');
  assert.equal(result.statuses.get('2'), 'read');
});

test('database write failure is surfaced without a reconciliation claim', async () => {
  const mock = adapter({ statuses: new Map(), ratedWorkIds: new Set() }, { failWrite: true });
  await assert.rejects(executeStatusMutation(
    { workIds: ['2'], action: 'set', status: 'reading' },
    mock.implementation,
  ), /WRITE_FAILED/);
  assert.equal(mock.calls.loads, 1);
});

test('a rating race is reconciled to Read with bounded writes', async () => {
  const mock = adapter(
    { statuses: new Map(), ratedWorkIds: new Set() },
    { addRatingAfterWrite: '2' },
  );
  const result = await executeStatusMutation(
    { workIds: ['2'], action: 'set', status: 'reading' },
    mock.implementation,
  );
  assert.equal(result.statuses.get('2'), 'read');
  assert.equal(result.repairedRatedStatuses, 1);
  assert.equal(mock.calls.upserts, 2);
  assert.ok(mock.calls.loads <= 3);
});

test('post-write read failure reports an ambiguous reconciliation error', async () => {
  const mock = adapter(
    { statuses: new Map(), ratedWorkIds: new Set() },
    { failReconcile: true },
  );
  await assert.rejects(executeStatusMutation(
    { workIds: ['2'], action: 'set', status: 'read' },
    mock.implementation,
  ), StatusReconciliationError);
  assert.equal(mock.calls.upserts, 1);
});

test('clear is one scoped operation and unrelated state remains unchanged', async () => {
  const statuses = new Map<string, ReadingStatus>([['1', 'reading'], ['9', 'dnf']]);
  const mock = adapter({ statuses, ratedWorkIds: new Set() });
  const result = await executeStatusMutation(
    { workIds: ['1'], action: 'clear', status: null },
    mock.implementation,
  );
  assert.equal(mock.calls.deletes, 1);
  assert.equal(result.statuses.has('1'), false);
  assert.equal(result.statuses.get('9'), 'dnf');
});

test('guest migration plans rated books as Read and preserves other existing statuses', () => {
  const plan = planGuestWantToReadMigration(['1', '2', '3'], {
    statuses: new Map([['1', 'dnf'], ['2', 'reading']]),
    ratedWorkIds: new Set(['1']),
  });
  assert.deepEqual(plan, {
    rows: [
      { workId: '1', status: 'read' },
      { workId: '3', status: 'want_to_read' },
    ],
    ratedWorksPreserved: 1,
  });
});
