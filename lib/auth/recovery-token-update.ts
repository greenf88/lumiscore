import { isRecoveryTokenHash } from './recovery-link.ts';

type Identity = { id: string };
type RecoveryAuth = {
  verifyOtp(input: { token_hash: string; type: 'recovery' }): PromiseLike<{
    data: { user: Identity | null; session: { user: Identity } | null }; error: unknown;
  }>;
  getUser(): PromiseLike<{ data: { user: Identity | null }; error: unknown }>;
  updateUser(input: { password: string }): PromiseLike<{ error: unknown }>;
  signOut(input: { scope: 'local' }): PromiseLike<unknown>;
};

/** Verify the one-use recovery proof at the mutation, never trust an existing login.
 * No broadening of AMR checks: verifyOtp's fixed recovery type is the proof here.
 * A GET/mail scanner cannot consume it; mismatched passwords are checked first.
 */
export async function updateWithRecoveryToken(auth: RecoveryAuth, tokenHash: string, password: string):
Promise<'updated' | 'invalid_link' | 'update_failed'> {
  if (!isRecoveryTokenHash(tokenHash)) return 'invalid_link';
  let verified = false;
  try {
    const result = await auth.verifyOtp({ token_hash: tokenHash, type: 'recovery' });
    if (result.error || !result.data.user || !result.data.session ||
      result.data.user.id !== result.data.session.user.id) return 'invalid_link';
    verified = true;
    const current = await auth.getUser();
    if (current.error || current.data.user?.id !== result.data.user.id) return 'invalid_link';
    const update = await auth.updateUser({ password });
    return update.error ? 'update_failed' : 'updated';
  } catch {
    return verified ? 'update_failed' : 'invalid_link';
  } finally {
    if (verified) { try { await auth.signOut({ scope: 'local' }); } catch { /* fail closed: no reusable app recovery marker */ } }
  }
}
