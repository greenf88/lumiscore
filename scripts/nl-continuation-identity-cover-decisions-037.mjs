import fs from 'node:fs';
import {ROOT} from './nl-continuation-bootstrap.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL(n,ROOT))),d=read('followup-preflight-readback-017.json').data;
if(d.project!=='qvplwejffhjvxaypmjut')throw Error('Wrong project');
for(const[n,id,note]of[
 [757,6276060,'Small creamgreen MaartenTHart/DeOrtolaanfront withtwo birds. ExactCPNB9789070066451; onlysmall80px-classarchiveimage, largerdetailqualitystilllimited.'],
 [759,11462457,'HarlanCoben/Gevonden/Jeugdthrillerfront withhoodedboy/city; exactDutchBoekerij9789022566411.'],
 [763,13114711,'BlueOliverJeffers/SamenHier/WijsWordenUitDeWereldfrontwithplanetandpeople; exactDutchHC9789026146565.'],
 [765,13191065,'PhilippeSands/GalicischeWetten/SpectrumfrontwithLviv-stylebuilding/redsubtitle; exactDutchPB9789000359387.'],
 [768,12048796,'RonaJaffe/VanAllesHetBeste/Romanfrontpinkcar/woman; exactDutchPB9789029578400. VisibleoldHeerenveenlibrarybarcode sticker, notpublisherplaceholder.'],
 [770,11933059,'MarioVargasLlosa/LofVanDeStiefmoeder/Roman/Meulenhoffdarkfrontwithpaintedembrace; exactDutchPB9789029039055.'],
 [775,12794848,'GeronimoStilton/HetMysterieVanDeGezonkenSchatfrontwithsubmergedship/divingmice/diamonds; exactDutchHC9789085920076.']
]){
 const name='reviewed-'+n+'.json',r=read(name),e=d.editions.find(e=>e.id===r.edition.id),receipt=(id<8000000?'cover-':'cover-normal-')+id+'.json',c=read(receipt);
 if(!e||e.work_id!==r.workId||!c.sha256||(n===757?e.isbn_13!==null:e.isbn_13!==r.edition.isbn13))throw Error('Edition/ISBN/parent/cover differs '+n);
 r.cover={id,receipt,sha256:c.sha256,bytes:c.bytes,visualReview:'Actually viewed: '+note};r.status=n===757?'approved_existing_edition_repair_proposal':'approved_existing_presentation_proposal';r.currentReadback='followup-preflight-readback-017.json';r.importApproved=false;
 if(n===757){r.edition.isbn13='9789070066451';r.identityDecision+=' Currentedition1830hasNULLISBN; anylaterCASmanifestmayfillonlytheverifiedCPNBISBN, net0alreadyDutch. Smallfrontisnotalarge-detailqualityclaim.';}
 if(n===775){r.edition.sourceKey=e.open_library_edition_id;r.identityDecision+=' CurrentexistingOL35327059M retained; alternativeOL38502858MhasthesameISBN, no newedition/sourcekeyoverwrite.';}
 r.remaining=['Source-approved only; separate executable manifest/local/hosted tests outside frozen batch001',...(n===757?['Larger verified same-edition detail variant remains desirable; no upscaling-quality claim']:[]),...(n===768?['Visible old library barcode sticker remains an image-quality limitation']:[])];
 fs.writeFileSync(new URL(name,ROOT),JSON.stringify(r,null,2)+'\n');
}
