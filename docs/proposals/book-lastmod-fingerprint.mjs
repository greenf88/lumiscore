// REVIEW-ONLY projection. Not imported by the application or sitemap.
import {createHash} from 'node:crypto';
export function reviewedBookPageFingerprint(page) {
  if(page.lifecycle!=='indexable'||!['nl','en'].includes(page.locale))return null;
  if(page.edition?.reviewStatus!=='approved'||!['approved','confirmed_none'].includes(page.summary?.status)
    ||!['approved','confirmed_none'].includes(page.cover?.status)||!page.rating?.known)return null;
  const links=(page.links??[]).map(({path,label})=>({path:path.split('?')[0],label})).sort((a,b)=>a.path.localeCompare(b.path)||a.label.localeCompare(b.label));
  const projection={version:'reviewed_book_page_v1',policyVersion:page.policyVersion,
    work:{id:page.work.id,title:page.work.title,authorId:page.work.authorId,authorName:page.work.authorName,firstPublicationYear:page.work.firstPublicationYear},
    locale:page.locale,lifecycle:page.lifecycle,
    edition:{id:page.edition.id,title:page.edition.title,language:page.edition.language,isbn:page.edition.isbn,publisher:page.edition.publisher,format:page.edition.format},
    summary:{status:page.summary.status,text:page.summary.text??null,language:page.summary.language??null,source:page.summary.source??null},
    cover:{status:page.cover.status,verifiedIdentity:page.cover.verifiedIdentity??null,source:page.cover.source??null},
    rating:{display:page.rating.display,band:page.rating.band,available:page.rating.available},links};
  return createHash('sha256').update(JSON.stringify(projection)).digest('hex');
}
