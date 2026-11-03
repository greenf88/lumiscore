import fs from 'node:fs';
import {ROOT} from './nl-continuation-bootstrap.mjs';
for(const [n,id,note] of [
 [399,11412740,'Orange StephenKing front, DeDonkereToren6, subtitleEenLiedVanSusannah; oldlibrary sticker over illustration disclosed. Exact OL/KB9789024546282 binding, notanother seriesvolume.'],
 [452,11618767,'HarlanCoben/DeVreemde Dutch front, mistybuilding/isolatedfigure, Boekerij; exact selected paperback source mapping. No image for ebook9789402303032 substituted.']
]){
 const file=new URL('reviewed-'+n+'.json',ROOT),r=JSON.parse(fs.readFileSync(file));
 const receipt='cover-normal-'+id+'.json',c=JSON.parse(fs.readFileSync(new URL(receipt,ROOT)));
 if(!c.sha256)throw Error('No successful transport');
 r.cover={id,receipt,sha256:c.sha256,bytes:c.bytes,visualReview:note};r.status='approved_edition_addition_proposal';r.importApproved=true;
 r.remaining=['Current full-row/collision preflight','Separate local and hosted import/recovery/acceptance; excluded from frozen batch001'];
 fs.writeFileSync(file,JSON.stringify(r,null,2)+'\n');
}
const file=new URL('reviewed-421.json',ROOT),r=JSON.parse(fs.readFileSync(file));
r.coverReview={front:10245006,back:10245005,decision:'Front and barcode-bearing back show samePantheonWorldClassics edition9077091211/9789077091210. Back is not a display cover. Publisher imprint identity corroborated, exact translator contradiction still recorded.'};
fs.writeFileSync(file,JSON.stringify(r,null,2)+'\n');
