/** A separately reviewed publisher supplies a complete CURRENT public-page
 * projection and immutable committed-change receipt. A ledger date alone is
 * insufficient: stale rows must never advertise a made-up last modification. */
export type VerifiedPageRevision = {currentHash:string|null; recordedHash:string; changedAt:string; receiptSha256:string};
export function verifiedPageLastmod(revision:VerifiedPageRevision|undefined,now=Date.now()):string|null {
 if(!revision||!revision.currentHash||!/^[a-f0-9]{64}$/.test(revision.currentHash)
  ||revision.currentHash!==revision.recordedHash||!/^[a-f0-9]{64}$/.test(revision.receiptSha256))return null;
 const at=Date.parse(revision.changedAt);
 if(!Number.isFinite(at)||at>now||at<Date.UTC(1990,0,1))return null;
 return new Date(at).toISOString();
}
