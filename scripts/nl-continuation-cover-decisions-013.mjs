import fs from 'node:fs';import{ROOT}from'./nl-continuation-bootstrap.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL(n,ROOT))),snapshot=read('followup-preflight-readback-011.json').data;
if(snapshot.project!=='qvplwejffhjvxaypmjut')throw Error('Wrong project');
for(const[n,id,note]of[
 [659,13238024,'White/greyHarlanCoben/Spoorloosfront withmaninmustardshirtamonggrass, exactBoekerijDutchPB9789022582138, notNetflixFrenchidentity.'],
 [663,13536555,'Pale-blueRoaldDahl/OpWegNaarDeHemel/Pockethuisfront withwhiteCadillactailfin, exactMeulenhoffManteau2004pocket9789046130308, full11-storycollectionnotstandaloneebook.'],
 [673,8063732,'FransDeWaal/DeBonoboEnDeTienGebodenfront, bonobofacingblurredred-shirtpersonandDutchsubtitleMoraalIsOuderDanDeMens. Exact2015AtlasContactPB9789045030791.']
]){
 const name='reviewed-'+n+'.json',r=read(name),receipt='cover-normal-'+id+'.json',c=read(receipt),e=snapshot.editions.find(e=>e.id===r.edition.id);
 if(!c.sha256||!e||e.work_id!==r.workId||e.isbn_13!==r.edition.isbn13||!['dut','nl','nld'].includes(e.language))throw Error('Current exactexisting Dutch edition differs');
 r.cover={id,receipt,sha256:c.sha256,bytes:c.bytes,visualReview:note};r.status='approved_existing_presentation_proposal';r.importApproved=false;r.netNewDutchAvailability=0;r.currentReadback='followup-preflight-readback-011.json';r.remaining=['Source-approved only; separate executable manifest/local/hosted tests, outside frozen batch001'];fs.writeFileSync(new URL(name,ROOT),JSON.stringify(r,null,2)+'\n');
}
