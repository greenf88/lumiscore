import {normalizeEditionLanguage} from '../books/edition-ranking.ts';
type Row=Record<string,unknown>;
const present=(value:unknown)=>value!==null&&value!==undefined&&(typeof value!=='string'||Boolean(value.trim()));
const normalizedId=(value:unknown)=>String(value??'').trim().replace(/^\/(?:authors|works|books)\//,'');
/** Ordinary source refresh can fill gaps, never overwrite curated values or
 * silently move an edition/ISBN to another Work. Corrections use reviewed SQL. */
export function conservativeCatalogPatch(existing:Row,incoming:Row,preserve:readonly string[]=[]) {
 const patch:Row={};const held:string[]=[];
 const text=(x:unknown)=>String(x??'').normalize('NFKC').trim().replace(/\s+/g,' ').toLowerCase();
 const titleConflict=present(existing.title)&&present(incoming.title)&&text(existing.title)!==text(incoming.title);
 const languageConflict=present(existing.language)&&present(incoming.language)&&normalizeEditionLanguage(String(existing.language))!==normalizeEditionLanguage(String(incoming.language));
 for(const [field,value] of Object.entries(incoming)){
  if(!present(value)||preserve.includes(field))continue;
  const old=existing[field];
  // A gap may be an intentional correction, e.g. a cleared wrong provider ID.
  // Never reattach it (or fill a language/date) from a contradictory identity.
  if(!present(old)&&(titleConflict||languageConflict)){held.push(field);continue;}
  if(present(old)){
   const equal=field.includes('open_library')?normalizedId(old)===normalizedId(value):String(old)===String(value);
   if(!equal&&/^(?:work_id|author_id|isbn_13|isbn_10|open_library_id|open_library_edition_id|native_identity_key)$/.test(field))throw Error('Import identity conflict in '+field+'; explicit review required');
   if(!equal)held.push(field);
   continue;
  }
  if(/language/.test(field)){
   const lang=normalizeEditionLanguage(String(value));
   // Mixed/unknown values need review, not first-language guessing.
   if(!/^[a-z]{2,3}$/.test(lang)||['und','mul'].includes(lang))continue;
   patch[field]=lang;
  }else patch[field]=value;
 }
 return {patch,held};
}
export function sourceEditionRejection(source:{key?:string;title?:string;works?:{key?:string}[];isbn_13?:string[]},workId:string,expectedIsbn?:string):string|null {
 if(!/^OL\d+M$/.test(normalizedId(source.key)))return 'missing_edition_identity';
 if(!source.title?.trim())return 'missing_edition_title';
 const parents=[...new Set((source.works??[]).map(w=>normalizedId(w.key)).filter(Boolean))];
 if(parents.length!==1||parents[0]!==normalizedId(workId))return 'unverified_or_ambiguous_parent_work';
 if(expectedIsbn&&!source.isbn_13?.some(i=>i.replace(/[\s-]/g,'')===expectedIsbn))return 'exact_isbn_not_confirmed';
 return null;
}
export function singleEditionLanguage(codes:readonly string[]):string|null{
 const languages=[...new Set(codes.map(normalizeEditionLanguage).filter(Boolean))];
 return languages.length===1&&/^[a-z]{2,3}$/.test(languages[0])&&!['und','mul'].includes(languages[0])?languages[0]:null;
}
