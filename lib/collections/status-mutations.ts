import {
  isReadingStatus,
  type ReadingStatus,
} from './model.ts';

export const MAX_BULK_STATUS_WORKS = 100;
export const BULK_STATUS_ACTIONS = ['set', 'clear'] as const;
export type BulkStatusAction = (typeof BULK_STATUS_ACTIONS)[number];

export type BulkStatusPayload = {
  workIds: string[];
  action: BulkStatusAction;
  status: ReadingStatus | null;
};

export type CanonicalStatusState = {
  statuses: Map<string, ReadingStatus>;
  ratedWorkIds: Set<string>;
};

export type StatusWriteRow = { workId: string; status: ReadingStatus };

export type StatusMutationAdapter = {
  loadState: () => Promise<CanonicalStatusState>;
  upsertStatuses: (rows: readonly StatusWriteRow[]) => Promise<void>;
  deleteStatuses: (workIds: readonly string[]) => Promise<void>;
};

export type StatusMutationResult = CanonicalStatusState & {
  changed: number;
  repairedRatedStatuses: number;
};

export class RatedWorkStatusConflictError extends Error {
  readonly conflictingWorkIds: string[];

  constructor(conflictingWorkIds: readonly string[]) {
    super('RATED_WORK_STATUS_CONFLICT');
    this.name = 'RatedWorkStatusConflictError';
    this.conflictingWorkIds = [...conflictingWorkIds];
  }
}

export class StatusReconciliationError extends Error {
  constructor(cause?: unknown) {
    super('STATUS_RECONCILIATION_FAILED', { cause });
    this.name = 'StatusReconciliationError';
  }
}

export function canonicalWorkId(value: unknown): string | null {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && String(number) === value ? value : null;
}

export function parseBulkStatusPayload(value: unknown): BulkStatusPayload | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.some((key) => !['workIds', 'action', 'status'].includes(key))) return null;
  if (!Array.isArray(record.workIds) || record.workIds.length < 1 ||
    record.workIds.length > MAX_BULK_STATUS_WORKS) return null;

  const workIds = record.workIds.map(canonicalWorkId);
  if (workIds.some((workId) => workId === null)) return null;
  const canonicalIds = workIds as string[];
  if (new Set(canonicalIds).size !== canonicalIds.length) return null;

  const action = record.action;
  if (action !== 'set' && action !== 'clear') return null;
  if (action === 'set' && !isReadingStatus(record.status)) return null;
  if (action === 'clear' && record.status !== null && record.status !== undefined) return null;

  return {
    workIds: canonicalIds,
    action,
    status: action === 'set' ? record.status as ReadingStatus : null,
  };
}

export function canonicalizeRatedStatuses(state: CanonicalStatusState): CanonicalStatusState {
  const statuses = new Map(state.statuses);
  for (const workId of state.ratedWorkIds) statuses.set(workId, 'read');
  return { statuses, ratedWorkIds: new Set(state.ratedWorkIds) };
}

export function planGuestWantToReadMigration(
  workIds: readonly string[],
  state: CanonicalStatusState,
): { rows: StatusWriteRow[]; ratedWorksPreserved: number } {
  const rows: StatusWriteRow[] = [];
  let ratedWorksPreserved = 0;
  for (const workId of workIds) {
    if (state.ratedWorkIds.has(workId)) {
      ratedWorksPreserved += 1;
      if (state.statuses.get(workId) !== 'read') rows.push({ workId, status: 'read' });
    } else if (!state.statuses.has(workId)) {
      rows.push({ workId, status: 'want_to_read' });
    }
  }
  return { rows, ratedWorksPreserved };
}

function ratedConflicts(payload: BulkStatusPayload, state: CanonicalStatusState): string[] {
  if (payload.action === 'set' && payload.status === 'read') return [];
  return payload.workIds.filter((workId) => state.ratedWorkIds.has(workId));
}

function changedWorkIds(payload: BulkStatusPayload, state: CanonicalStatusState): string[] {
  return payload.workIds.filter((workId) => payload.action === 'clear'
    ? state.statuses.has(workId)
    : state.statuses.get(workId) !== payload.status);
}

export async function reconcileRatedStatuses(
  adapter: StatusMutationAdapter,
): Promise<{ state: CanonicalStatusState; repaired: number }> {
  let repaired = 0;
  for (let pass = 0; pass < 2; pass += 1) {
    const state = await adapter.loadState();
    const repairs = [...state.ratedWorkIds]
      .filter((workId) => state.statuses.get(workId) !== 'read')
      .map((workId) => ({ workId, status: 'read' as const }));
    if (repairs.length === 0) {
      return { state: canonicalizeRatedStatuses(state), repaired };
    }
    await adapter.upsertStatuses(repairs);
    repaired += repairs.length;
  }

  const finalState = await adapter.loadState();
  const unresolved = [...finalState.ratedWorkIds]
    .filter((workId) => finalState.statuses.get(workId) !== 'read');
  if (unresolved.length > 0) throw new Error('RATED_STATUS_RACE_UNRESOLVED');
  return { state: canonicalizeRatedStatuses(finalState), repaired };
}

export async function executeStatusMutation(
  payload: BulkStatusPayload,
  adapter: StatusMutationAdapter,
): Promise<StatusMutationResult> {
  const before = await adapter.loadState();
  const conflicts = ratedConflicts(payload, before);
  if (conflicts.length > 0) throw new RatedWorkStatusConflictError(conflicts);

  const changedIds = changedWorkIds(payload, before);
  if (changedIds.length === 0) {
    const state = canonicalizeRatedStatuses(before);
    return { ...state, changed: 0, repairedRatedStatuses: 0 };
  }

  if (payload.action === 'clear') {
    await adapter.deleteStatuses(changedIds);
  } else {
    await adapter.upsertStatuses(changedIds.map((workId) => ({
      workId,
      status: payload.status!,
    })));
  }

  try {
    const reconciled = await reconcileRatedStatuses(adapter);
    return {
      ...reconciled.state,
      changed: changedIds.length,
      repairedRatedStatuses: reconciled.repaired,
    };
  } catch (error) {
    throw new StatusReconciliationError(error);
  }
}
