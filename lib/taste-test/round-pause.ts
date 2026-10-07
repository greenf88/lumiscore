// Pause is a presentation choice on this tab, never a change to server progress.
// A round-scoped key cannot pause another user's or a later round.
type PauseStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const keyFor = (roundId: string) => `lumiscore-taste-paused:${roundId}`;

export function readRoundPause(storage: PauseStorage, roundId: string): boolean {
  try { return storage.getItem(keyFor(roundId)) === '1'; }
  catch { return false; }
}

export function writeRoundPause(storage: PauseStorage, roundId: string, paused: boolean): void {
  try {
    if (paused) storage.setItem(keyFor(roundId), '1');
    else storage.removeItem(keyFor(roundId));
  } catch { /* Pausing still works in memory when optional storage is blocked. */ }
}
