// Import-time proof for an exact-edition publisher asset; no runtime exception.
import {safePublicCoverUrl} from '../lib/books/stored-presentation.ts';
export function reviewedCoverAsset(edition,cover){
 if(!cover?.assetUrl)return null;
 if(cover.status!=='front_title_author_consistent_with_bound_source'||cover.editionKey!==edition.editionKey||edition.isbn13.length!==1||cover.isbn13!==edition.isbn13[0]||!safePublicCoverUrl(cover.assetUrl)||!/^https:\/\//.test(cover.evidenceUrl??'')||!/^[a-f0-9]{64}$/.test(cover.sha256??'')||!Number.isInteger(cover.bytes)||cover.bytes<1000||cover.bytes>8000000||!cover.decoded||!(cover.width>0&&cover.height>0)||!cover.note)throw Error('Exact independently reviewed publisher cover required');
 return {url:cover.assetUrl,cardUrl:cover.assetUrl,sha256:cover.sha256,evidenceUrl:cover.evidenceUrl,bytes:cover.bytes};
}
