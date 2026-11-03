import fs from 'node:fs';import {ROOT} from './nl-continuation-bootstrap.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL(n,ROOT))),snapshot=read('followup-preflight-readback-007.json').data;
if(snapshot.project!=='qvplwejffhjvxaypmjut')throw Error('Wrong project receipt');
for(const [n,id,note] of [
 [412,13189631,'White/goldtypographicfront GOODVIBESGOODLIFE/VEXKING withDutchsubtitleDePerfecteGidsVoorEenMooierEnZinvollerLeven. ExactDutchKosmos9789021574776, notEnglishsame-main-title.'],
 [413,11145009,'OchreSalmanRushdie/Middernachtskinderen/Pandorafront withred/orange-robedfigure. Exact1997Dutch9789025457389.'],
 [423,11022799,'YellowStephenKing/OgenVanVuur/Poemafront withburnedbear. ExactDutch2005pocket9789024551873, notEnglishFirestarter/movieposter.'],
 [424,11561881,'GreenSalmanRushdie/DeDuivelsverzen/Pandorafront withfantasticrider, orange15pricecircle disclosed. ExactDutch2010paperback9789025434717.'],
 [428,6624842,'Grey/greenWILKIECOLLINS/DEMAANSTEEN front withovalstandingmirrorreflectingabedandahandholdingjewellery. Exactsource1978Dutch9789029512695, printingdate/barcode notvisible; notmodernabridgement.'],
 [433,12014449,'JohnGrisham/AdvocaatVanDeDuivel/THEFIRM/ZwarteBeertjes purpleblackfilm-tieinfront. ExactDutch2001pocket9789044927115; notNeiderman/MorrisWest.'],
 [434,11931516,'Redhairedwomanface/orangetitlepanel EmmaDonoghue/Kamer/romanMouriafront, exact2010DutchPB9789045823690. Alternative13260618hasblueborder, notneeded; chosenwithoutborder.']
]){
 const name='reviewed-'+n+'.json',r=read(name),receipt=(id<8000000?'cover-':'cover-normal-')+id+'.json',c=read(receipt);
 if(!c.sha256||!snapshot.works.some(w=>w.id===r.workId)||snapshot.editions.some(e=>e.isbn_13===r.edition.isbn13))throw Error('Current existing Work/new-edition state or transport differs');
 r.cover={id,receipt,sha256:c.sha256,bytes:c.bytes,visualReview:note};r.status='approved_edition_addition_proposal';r.importApproved=false;r.currentReadback='followup-preflight-readback-007.json';r.remaining=['Source-approved only; separate executable manifest/local and hosted tests, excluded from frozen batch001'];fs.writeFileSync(new URL(name,ROOT),JSON.stringify(r,null,2)+'\n');
}
