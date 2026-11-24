/** Synchronous per-form latch: a second tap/Enter cannot race a React render.
 * No credentials, timers, automatic retries or cross-user state are retained.
 */
export function createFormSubmissionLatch() {
  let pending = false;
  return {
    claim(): boolean {
      if (pending) return false;
      pending = true;
      return true;
    },
    reset() { pending = false; },
  };
}
