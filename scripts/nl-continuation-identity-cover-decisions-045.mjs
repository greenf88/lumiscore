import fs from 'node:fs';import {ROOT} from './nl-continuation-bootstrap.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL(n,ROOT))),d=read('followup-preflight-readback-021.json').data;
if(d.project!=='qvplwejffhjvxaypmjut')throw Error('Wrong project');
for(const[n,id,note]of[[844,11933870,'Blackbasketballhoopfront/HarlanCoben/Schijnbeweging matchesexactBoekerijDutchPB9789022552070.'],[846,10835070,'YellowgreenIshAitHamou/HetMooisDatWeDelenfrontwith50kEXVERKOCHTsticker; salesclaimnotreadermeasurement. ExactManteauPB9789022336953.'],[847,11562848,'KenFollett/OpVleugelsVanDeAdelaar/OnWingsOfEagles/photo-collagefront matchesexactSpectrumPB9789026978692.'],[860,11019481,'Greenblackgate/DanielleSteel/DeVillaRomanfront exactLuitinghPB9789024549320. OldBeverenlibrarylabelretainedanddisclosed; notaprintedtitlevariant.'],[864,14556432,'KarenKingsbury/OpDitMoment/coupleunderblossomsfront exactKokDutchPB9789043531191.']]){
 const name='reviewed-'+n+'.json',r=read(name),e=d.editions.find(e=>e.id===r.edition.id),c=read('cover-normal-'+id+'.json');
 if(!e||e.work_id!==r.workId||e.isbn_13!==r.edition.isbn13||e.open_library_edition_id!==r.edition.sourceKey||!c.sha256)throw Error('Exactcurrentedition/coverdiffers');
 r.cover={id,receipt:'cover-normal-'+id+'.json',sha256:c.sha256,bytes:c.bytes,visualReview:'Actually viewed: '+note};
 r.status='approved_existing_presentation_proposal';r.currentReadback='followup-preflight-readback-021.json';r.remaining=['Source-approved only; separate executable manifest/local/hosted tests outside frozen batch001'];
 if(n===860)r.remaining.push('Old library label visible; not an edition identity mismatch');
 fs.writeFileSync(new URL(name,ROOT),JSON.stringify(r,null,2)+'\n');
}
for(const n of[841,845,849,850,862]){const name='reviewed-'+n+'.json',r=read(name);r.currentReadback='followup-preflight-readback-021.json';if(n===862)r.remaining.push('Exact bulk member request020 HTTP500 RangeRefused; not repeated. No decoded exact cover approval; no CoversAPI crawl.');fs.writeFileSync(new URL(name,ROOT),JSON.stringify(r,null,2)+'\n');}
