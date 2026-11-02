// Exact source checks for manually reviewed supplements and person-name variants.
// Never resolves catalogue Works/authors or merges records by name.
const fold=s=>String(s??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const uninvert=s=>{const p=s.split(',');return p.length===2?p[1].trim()+' '+p[0].trim():s;};
export function reviewedAuthorAlias(sourceAuthor,edition,resolution){
 if(!resolution||resolution.sourceAuthorKey!==sourceAuthor.key.split('/').at(-1)||!resolution.kbAlias||!resolution.note)throw Error('Explicit selected-primary-author resolution required');
 if(!edition.kbRecords.some(k=>(k.authorAliases??[]).includes(resolution.kbAlias)))throw Error('Alias not bound to exact edition bibliography');
 const forms=[sourceAuthor.name,...(sourceAuthor.alternateNames??[])];if(!forms.some(n=>fold(n)===fold(uninvert(resolution.kbAlias))))throw Error('Alias names a different source person');return true;
}
export function verifySupplementalEdition(c,s,edition,source){
 const r=source.records.find(x=>x.key===edition.editionKey)?.record;
 if(source.sourceBodySha256!==edition.sourceEvidence.editionResponseSha256||!r||r.key!==edition.editionKey)throw Error('Exact supplemental record receipt mismatch');
 if(!r.works?.some(x=>x.key==='/works/'+c.candidateId.slice(3))||!r.authors?.some(x=>x.key==='/authors/'+s.primaryAuthorKey))throw Error('Supplement parent/primary-author mismatch');
 if(r.title!==edition.title||edition.isbn13.length!==1||!r.isbn_13?.includes(edition.isbn13[0])||!r.languages?.some(x=>['/languages/dut','/languages/nld','/languages/nl'].includes(x.key)))throw Error('Supplement title/ISBN/language mismatch');
 if(!edition.sourceEvidence.kbResponseSha256||!edition.sourceEvidence.formatSource||!edition.sourceEvidence.review)throw Error('Independent exact bibliography/format review required');return edition;
}
