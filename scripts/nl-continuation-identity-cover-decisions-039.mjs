import fs from 'node:fs';import {ROOT} from './nl-continuation-bootstrap.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL(n,ROOT))),d=read('followup-preflight-readback-018.json').data;
if(d.project!=='qvplwejffhjvxaypmjut')throw Error('Wrong project');
for(const[n,id,note]of[
 [782,13197035,'DoreenVirtue/HetPadVanDeLichtwerkerfront withwhitewingsandredbackground; exactDutchBoekerijPB9789022559512.'],
 [787,12464252,'BlackJoseLuisSampedro/DeEtruskischeGlimlachfrontwithEtruscanfigures; exactDutchHC9789074622585.'],
 [789,14417503,'CreamBrunoniaBarry/DeKantlezer/RomanCargo withwomansback/laceborder; exactcurrent2010DutchPB9789023457343, notother2008ISBN.'],
 [791,13244994,'GenaShowalter/EersteLeven/HarperCollinsfront withtwo citiesinhourglass; exactDutchPB9789402723403.'],
 [792,13666717,'MaryseConde/BovenwindseHoogtenfront withwomanunderflowers; exactInDeKnipscheerDutchPB9789062654598, distinctBronteretelling.'],
 [803,11956591,'DouglasKennedy/InVerleiding/RomanBoekerijfrontwomaninseawater; exactDutchPB9789022548257. OldAFGESCHREVENlibrarylabelremainsvisible, notplaceholder.']
]){
 const name='reviewed-'+n+'.json',r=read(name),e=d.editions.find(e=>e.id===r.edition.id),c=read('cover-normal-'+id+'.json');
 if(!e||e.work_id!==r.workId||e.isbn_13!==r.edition.isbn13||!c.sha256)throw Error('Exactcurrentedition/coverdiffers '+n);
 r.cover={id,receipt:'cover-normal-'+id+'.json',sha256:c.sha256,bytes:c.bytes,visualReview:'Actually viewed: '+note};r.status='approved_existing_presentation_proposal';r.currentReadback='followup-preflight-readback-018.json';r.remaining=['Source-approved only; separate executable manifest/local/hosted tests outside frozen batch001',...(n===803?['Oldlibrarydiscardlabelvisible; imagequalitylimitationnotplaceholder']:[])];fs.writeFileSync(new URL(name,ROOT),JSON.stringify(r,null,2)+'\n');
}
for(const n of[778,780,798,802]){const name='reviewed-'+n+'.json',r=read(name);r.currentReadback='followup-preflight-readback-018.json';if(n===778){r.identityDecision+=' CurrentWork5029alreadyhasDutch5188ISBN9789052262123. ProposedGeuzenpocket9789052264639isadifferentedition; noexistingrecordoverwrite ornetnewavailability. Preferexistingprintifexactcovercanbeverified.';r.remaining=['VerifyexistingDutch9789052262123format/front orselectedalternativeexactfrontgroup15delivery','Separate manifest/local/hosted tests outside frozenbatch001'];}fs.writeFileSync(new URL(name,ROOT),JSON.stringify(r,null,2)+'\n');}
