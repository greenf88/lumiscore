// Exact source checks for manually reviewed supplements and person-name variants.
// Never resolves catalogue Works/authors or merges records by name.
import{createHash}from'node:crypto';
const fold=s=>String(s??'').normalize('NFD').replace(/\p{M}/gu,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const uninvert=s=>{const p=s.split(',');return p.length===2?p[1].trim()+' '+p[0].trim():s;};
function canonicalCheckedIsbn(value){
 const v=String(value??'').replace(/[-\s]/g,'').toUpperCase();
 if(/^\d{13}$/.test(v))return [...v].reduce((sum,c,i)=>sum+Number(c)*(i%2?3:1),0)%10===0?v:null;
 if(!/^\d{9}[\dX]$/.test(v)||[...v].reduce((sum,c,i)=>sum+(c==='X'?10:Number(c))*(10-i),0)%11!==0)return null;
 const stem='978'+v.slice(0,9),check=(10-[...stem].reduce((sum,c,i)=>sum+Number(c)*(i%2?3:1),0)%10)%10;
 return stem+check;
}
export function reviewedAuthorAlias(sourceAuthor,edition,resolution){
 if(!resolution||resolution.sourceAuthorKey!==sourceAuthor.key.split('/').at(-1)||!resolution.kbAlias||!resolution.note)throw Error('Explicit selected-primary-author resolution required');
 if(!edition.kbRecords.some(k=>(k.authorAliases??[]).includes(resolution.kbAlias)))throw Error('Alias not bound to exact edition bibliography');
 const forms=[sourceAuthor.name,...(sourceAuthor.alternateNames??[])];if(!forms.some(n=>fold(n)===fold(uninvert(resolution.kbAlias))))throw Error('Alias names a different source person');return true;
}
export function verifySupplementalEdition(c,s,edition,source){
 const r=source.records.find(x=>x.key===edition.editionKey)?.record;
 if(source.sourceBodySha256!==edition.sourceEvidence.editionResponseSha256||!r||r.key!==edition.editionKey)throw Error('Exact supplemental record receipt mismatch');
 if(!r.works?.some(x=>x.key==='/works/'+c.candidateId.slice(3))||!r.authors?.some(x=>x.key==='/authors/'+s.primaryAuthorKey))throw Error('Supplement parent/primary-author mismatch');
 const selected=edition.isbn13?.length===1?canonicalCheckedIsbn(edition.isbn13[0]):null;
 const sourceIsbns=[...(r.isbn_13??[]),...(r.isbn_10??[])].map(canonicalCheckedIsbn).filter(Boolean);
 if(r.title!==edition.title||!selected||!sourceIsbns.includes(selected)||!r.languages?.some(x=>['/languages/dut','/languages/nld','/languages/nl'].includes(x.key)))throw Error('Supplement title/ISBN/language mismatch');
 if(!edition.sourceEvidence.kbResponseSha256||!edition.sourceEvidence.formatSource||!edition.sourceEvidence.review)throw Error('Independent exact bibliography/format review required');return edition;
}

// A separately retrieved edition may name the canonical person while its Work
// names a sparse duplicate author record. Resolve only that selected primary
// credit through the independent exact-ISBN bibliography, never through names.
export function supplementalPrimaryPerson(c,s,editionSource,person,kbBook,kbLinked){
 const p=s.supplementalPrimaryPerson,r=editionSource.records.find(x=>x.key===s.supplementalEdition?.editionKey)?.record;
 const author=person.record,wikidata=author?.remote_ids?.wikidata;
 if(!p||author?.key!=='/authors/'+s.primaryAuthorKey||!/^Q\d+$/.test(wikidata??'')||!person.originalRecordSha256||!person.sourceUrl)throw Error('Explicit canonical primary-person evidence required');
 if(!r?.authors?.some(x=>x.key===author.key)||!r.works?.some(x=>x.key==='/works/'+c.candidateId.slice(3)))throw Error('Canonical person is not the exact edition primary credit');
 if(kbBook.sha256!==p.kbBookResponseSha256||kbLinked.sha256!==p.kbLinkedResponseSha256)throw Error('Independent person/bibliography receipt mismatch');
 const facts=kbBook.data.results.bindings.filter(x=>x.book?.value===p.kbBookUri);
 if(!facts.some(x=>x.p.value==='http://schema.org/author'&&x.value.value===p.kbPersonUri)||!facts.some(x=>x.p.value==='http://schema.org/inLanguage'&&x.value.value==='nl')||!facts.some(x=>[...(r.isbn_10??[]),...(r.isbn_13??[])].includes(x.isbn?.value)))throw Error('Person is not bound to the exact Dutch ISBN');
 if(!kbLinked.data.results.bindings.some(x=>x.node?.value===p.kbPersonUri&&x.p.value==='http://schema.org/sameAs'&&x.value.value.replace('https:','http:')==='http://www.wikidata.org/entity/'+wikidata))throw Error('No shared independent person authority');
 return {key:author.key,name:author.name,alternateNames:author.alternate_names??[],sourceSha256:person.originalRecordSha256,sourceUrl:person.sourceUrl};
}
export function verifyReviewedOriginalEdition(c,s,e,bibliography){
 const original=c.editionReviews.find(x=>x.editionKey===e.editionKey),p=e.sourceEvidence;
 if(!original||createHash('sha256').update(JSON.stringify(original)).digest('hex')!==p?.originalEditionSha256||!p.review||p.reviewSources?.length<2)throw Error('Exact cached edition and substantive independent review required');
 const allowed=new Set(['title','publisher','titleConfirmed','authorConfirmed','problems','sourceEvidence']);
 if(Object.keys({...original,...e}).some(k=>JSON.stringify(original[k])!==JSON.stringify(e[k])&&!allowed.has(k)))throw Error('Reviewed source amendment cannot change identity, ISBN, language, format or cover');
 if(e.title!==original.title&&!original.kbRecords.some(k=>k.titles.includes(e.title)))throw Error('Canonical title must be an exact independently bound bibliographic title');
 if(JSON.stringify(e.publisher)!==JSON.stringify(original.publisher)){
  const labels=bibliography.books.filter(b=>original.kbRecords.some(k=>k.uri===b.uri)).flatMap(b=>b.publications??[]).flatMap(p=>p.properties['http://www.w3.org/2000/01/rdf-schema#label']??[]).map(v=>v.value);
  if(!e.publisher.length||!e.publisher.every(n=>labels.some(l=>l.includes(': '+n+'.'))))throw Error('Publisher missing from exact ISBN publication record');
 }
 if(!original.authorConfirmed&&e.authorConfirmed){const a=c.sourceAuthors.find(a=>a.key.split('/').at(-1)===s.primaryAuthorKey),r=p.primaryCredit;if(!a||r?.sourceAuthorKey!==s.primaryAuthorKey||r.sourceRecordSha256!==a.sourceSha256||!r.review||!r.sourceUrl?.startsWith('https://'))throw Error('Explicit selected-primary credit review required');}
 return e;
}
