// Local test-fixture planning only. Never merges or updates an existing mirror.
import{createHash}from'node:crypto';
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
export function reviewedExistingMirrors(prod,pre,review,presentations){
 const works=new Map(),editions=new Map();
 if(!pre.works.length&&!pre.editions.length)return{works,editions};
 if(review?.project!=='hlvujbrmfdlrfxdjwsmb'||review.entries?.length!==pre.works.length||presentations?.metadata?.length!==0||presentations?.descriptions?.length!==0||review.presentationReadbackSha256!==hash(presentations))throw Error('Explicit unchanged existing-mirror and presentation review required');
 for(const w of pre.works){
  const r=review.entries.find(r=>r.testWorkId===w.id),p=prod.works.find(p=>p.open_library_id&&p.open_library_id===w.open_library_id),a=pre.authors.find(a=>a.id===w.author_id),pa=prod.authors.find(a=>a.id===p?.author_id);
  if(!p||!a||a.open_library_id!==pa?.open_library_id||r?.productionWorkId!==p.id||r.workSha256!==hash(w)||r.authorSha256!==hash(a)||!r.reason)throw Error('Existing mirror identity drift');
  works.set(p.id,w);
  const es=pre.editions.filter(e=>e.work_id===w.id);
  if(r.editions?.length!==es.length)throw Error('Unreviewed existing mirror editions');
  for(const e of es){
   const er=r.editions.find(x=>x.testEditionId===e.id),pe=prod.editions.find(pe=>pe.work_id===p.id&&pe.open_library_edition_id===e.open_library_edition_id&&pe.isbn_13===e.isbn_13&&pe.title===e.title&&pe.language===e.language&&pe.publisher===e.publisher);
   if(!pe||er?.productionEditionId!==pe.id||er.rowSha256!==hash(e))throw Error('Existing exact edition drift');
   editions.set(pe.id,e);
  }
 }
 if(editions.size!==pre.editions.length)throw Error('Existing edition outside reviewed mirrors');
 return{works,editions};
}
