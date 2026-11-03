import fs from 'node:fs';import{ROOT}from'./nl-continuation-bootstrap.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL(n,ROOT))),snapshot=read('followup-preflight-readback-010.json').data;
if(snapshot.project!=='qvplwejffhjvxaypmjut')throw Error('Wrong project');
for(const[n,id,note]of[
 [619,6836991,'Yellow/green Proust/DeKantVanSwann/DeBezigeBij front withpaintedinteriorfigures, exactHC9789023460404. NOTdifferentsecondvolumeInDeSchaduwVanBloeiendeMeisjes.'],
 [627,12794774,'Blue/red GeronimoStilton/DePiratenVanDeZilverenKattenklauw front, piratecatandmousesword, exactDutchWakkereMuisHC9789085920311.'],
 [630,12374304,'BlueHouellebecq/ElementaireDeeltjesfront, APlogoandredverticalauthorband/fourhumansymbols. ExactDutchPB9789029575157, notnonfictionElementaireDeeltjesseries.'],
 [640,12794855,'BlueGeronimoStilton/DeGlimlachVanLisafront, magnifyingglassandMonaMousapainting. ExactDutchHC9789085920106; existingOL35333981M preserved, sourceOL38504865MsameISBNcorroboratesonly.'],
 [650,12794769,'DeepblueGeronimoStilton/FantasiaXVIDeBewakersVanFantasia front withwhitepanther/princess/knight, explicitNieuwOktober2021circle. ExactDutchHC9789464290462, international#14doesnotalterDutchXVI.'],
 [653,12794849,'BlueGeronimoStilton/HetRaadselVanDeKaaspiramidefront, pyramidsandpharaoh-mouse. ExactDutchHC9789059242814.'],
 [655,12535921,'OchreMarioVargasLlosa/GesprekInDeKathedraal/RomanMeulenhoff front withglasscarafeandstainrings. Exact2009HC9789029084659/fulltwopartsinone, notoldpart1alone.']
]){
 const name='reviewed-'+n+'.json',r=read(name),receipt=(id<8000000?'cover-':'cover-normal-')+id+'.json',c=read(receipt),e=snapshot.editions.find(e=>e.id===r.edition.id);
 if(!c.sha256||!e||e.work_id!==r.workId||e.isbn_13!==r.edition.isbn13||!['dut','nl','nld'].includes(e.language))throw Error('Current existing Dutch edition differs');
 if(e.open_library_edition_id!==r.edition.sourceKey){r.sourceEvidenceEditionKey=r.edition.sourceKey;r.edition.sourceKey=e.open_library_edition_id;}
 r.cover={id,receipt,sha256:c.sha256,bytes:c.bytes,visualReview:note};r.status='approved_existing_presentation_proposal';r.importApproved=false;r.netNewDutchAvailability=0;r.currentReadback='followup-preflight-readback-010.json';r.remaining=['Source-approved only; separate manifest/local and hosted acceptance, outside frozen batch001'];fs.writeFileSync(new URL(name,ROOT),JSON.stringify(r,null,2)+'\n');
}
