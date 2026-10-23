// Bounded read-only image response check; never persists image bytes.
import { REVIEWED_COVER_OVERRIDES } from '../lib/books/reviewed-cover-overrides.ts';
for (const row of REVIEWED_COVER_OVERRIDES.filter(e=>e.reviewedAt==='2026-10-23')) {
  const start=performance.now();
  try {
    const r=await fetch(row.coverUrl,{signal:AbortSignal.timeout(20000)});
    const bytes=(await r.arrayBuffer()).byteLength;
    console.log(JSON.stringify({workId:row.workId,status:r.status,type:r.headers.get('content-type'),bytes,ms:Math.round(performance.now()-start)}));
  } catch(error) { console.log(JSON.stringify({workId:row.workId,error:String(error)})); }
}
