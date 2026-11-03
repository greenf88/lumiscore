import fs from 'node:fs';import {ROOT} from './nl-continuation-bootstrap.mjs';
for(const [n,id,note] of [
 [700,8775169,'Purple front with ostrich/powercord, bothMauritsMartijn+DimitriTokmetzis, exacttitle/DeCorrespondent and privacy subtitle; exact2016ISBN mapping, notlaterrevisedcover.'],
 [807,11565335,'Red/black historicalportrait front, GeertMak/DeLevensVanJanSix/EenFamiliegeschiedenis andAtlasContact. Exact2016hardcoverISBN mapping.'],
 [629,12048781,'Grey/purple film-tie-in front explicitlyBRIDGETJONESHETNIEUWEDAGBOEK/HelenFielding, notfirstDiary; source exact2001printISBN. Smallwornedges disclosed.']
]){
 const file=new URL('reviewed-'+n+'.json',ROOT),r=JSON.parse(fs.readFileSync(file)),receipt='cover-normal-'+id+'.json',c=JSON.parse(fs.readFileSync(new URL(receipt,ROOT)));
 if(!c.sha256)throw Error('Successful exacttransportrequired');r.cover={id,receipt,sha256:c.sha256,bytes:c.bytes,visualReview:note};r.status='approved_existing_presentation_proposal';r.importApproved=true;r.remaining=['Current full-row/collision preflight','Separate local and hosted import/recovery/acceptance; excluded from frozen batch001'];fs.writeFileSync(file,JSON.stringify(r,null,2)+'\n');
}
const file=new URL('reviewed-645.json',ROOT),r=JSON.parse(fs.readFileSync(file));r.coverReview={id:9328458,receipt:'cover-normal-9328458.json',decision:'ExactFransDeWaal/title/elephantfront identified, but LARGEarchive yields only100x155 pixels/4826bytes. A realcover, notproviderplaceholder, but no detailqualityimprovement claimed. Seek sameISBN largerverifiedvariant; notimportapproved.'};fs.writeFileSync(file,JSON.stringify(r,null,2)+'\n');
