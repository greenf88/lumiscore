import type { Book, VerifiedBookDescription } from '../../app/data/books.ts';
import type { Locale } from '../i18n/config.ts';
import { normalizeEditionLanguage } from './edition-ranking.ts';

export type StoredDescription = {
  work_id:number; language:Locale; bound_author_id:number; text:string;
  source_type:'official_catalog'|'official_publisher'; source_name:string; source_url:string;
  reviewed_at:string; review_status:string;
};
export type StoredEditionMetadata = {
  edition_id:number; work_id:number; bound_author_id:number; bound_title:string;
  bound_language:string; bound_isbn13:string; format:'paperback'|'hardcover'|'ebook'|'audio'|'other'|'unknown';
  cover_url:string|null; card_cover_url?:string|null; evidence_url:string; review_status:string;
};
export function safePublicSource(value:unknown):value is string {
  if(typeof value!=='string'||value.length>2048)return false;
  try {
    const u=new URL(value);
    if(!publicBibliographicHost(u)||u.hash)return false;
    if(!u.search)return true;
    // A Google Books volume ID identifies the reviewed bibliographic source.
    // Do not silently discard that binding or allow arbitrary search/tracking
    // parameters, free text, tokens or duplicate identifiers in its place.
    return ['books.google.com','books.google.nl'].includes(u.hostname)&&
      /^\/books(?:\/about\/[^/]+\.html)?$/.test(u.pathname)&&
      [...u.searchParams].length===1&&u.searchParams.has('id')&&
      /^[A-Za-z0-9_-]{6,80}$/.test(u.searchParams.get('id')??'');
  } catch{return false;}
}
function publicBibliographicHost(u:URL){return u.protocol==='https:'&&!u.username&&!u.password&&u.hostname.includes('.')&&
 !/^[\d.]+$|[:\[\]]|(?:^|\.)(?:localhost|local|internal)$/.test(u.hostname);}
/** Query identifiers are part of several already verified Google/OL images.
 * Do not strip them into a different image; reject credentials/expiring links. */
export function safePublicCoverUrl(value:unknown):value is string {
 if(typeof value!=='string'||value.length>2048)return false;
 try{const u=new URL(value);return publicBibliographicHost(u)&&!u.hash&&[...u.searchParams.keys()].every(k=>
  ['default','id','printsec','img','zoom','edge','source','w','h','width','height','fife','locale','resize','t'].includes(k.toLowerCase()))&&
  [...u.searchParams].every(([k,v])=>k.toLowerCase()==='t'?/^\d{1,16}$/.test(v):k.toLowerCase()!=='resize'||/^[1-9]\d{0,3},[1-9]\d{0,3}$/.test(v)&&v.split(',').every(n=>Number(n)<=4096));}catch{return false;}
}
export function storedPresentationSelection(books:readonly Book[],locale:Locale){
  if(books.length>200)throw new Error('Stored presentation requires a bounded visible selection');
  const valid=books.filter(b=>b.workId&&b.editionAvailable!==false);
  const workIds=[...new Set(valid.map(b=>b.workId!))].sort();
  const editionIds=[...new Set(valid.flatMap(b=>b.editionId?[b.editionId]:[]))].sort();
  return {workIds,editionIds,key:JSON.stringify([locale,workIds,editionIds])};
}
/** No selection, score or eligibility changes: bind metadata to the chosen edition. */
export function applyStoredPresentation(books:readonly Book[],locale:Locale,
  descriptions:readonly StoredDescription[], editions:readonly StoredEditionMetadata[]):Book[] {
  return books.map(book=>{
    if(book.editionAvailable===false)return {...book,storedDescription:undefined,cardCoverUrl:undefined,editionFormat:undefined};
    const edition=editions.find(e=>e.review_status==='approved'&&String(e.edition_id)===book.editionId&&
      String(e.work_id)===book.workId&&String(e.bound_author_id)===book.authorId&&
      e.bound_title===book.editionTitle&&e.bound_isbn13===book.isbn13&&
      normalizeEditionLanguage(e.bound_language)===normalizeEditionLanguage(book.editionLanguage??''));
    const allowed=(d:StoredDescription)=>d.language===locale;
    const row=descriptions.filter(d=>d.review_status==='approved'&&String(d.work_id)===book.workId&&
      String(d.bound_author_id)===book.authorId&&allowed(d)&&safePublicSource(d.source_url))
      .sort((a,b)=>Number(b.language===locale)-Number(a.language===locale))[0];
    const description:VerifiedBookDescription|undefined=row?{text:row.text,language:row.language,
      source:row.source_type,sourceKey:row.source_url,sourceName:row.source_name,sourceUrl:row.source_url,
      verifiedAt:row.reviewed_at}:undefined;
    return {...book,storedPresentationUnavailable:false,storedDescription:undefined,cardCoverUrl:undefined,editionFormat:undefined,...(edition?{editionFormat:edition.format}:{}),
      ...(edition?.cover_url&&safePublicCoverUrl(edition.cover_url)?{coverUrls:[edition.cover_url],editionCoverUrls:undefined}:{}),
      ...(edition?.card_cover_url&&safePublicCoverUrl(edition.card_cover_url)?{cardCoverUrl:edition.card_cover_url}:{}),
      ...(description?{storedDescription:description}:{})};
  });
}
