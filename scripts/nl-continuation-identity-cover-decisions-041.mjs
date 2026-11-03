import fs from 'node:fs';import {ROOT} from './nl-continuation-bootstrap.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL(n,ROOT))),d=read('followup-preflight-readback-019.json').data;
if(d.project!=='qvplwejffhjvxaypmjut')throw Error('Wrong project');
for(const[n,id,note]of[
 [809,6582605,'BlueSamuelJohnson/DeGeschiedenisVanRasselasPrinsVanAbessinie/Klassiekenfrontwithinsetruins; exact1983SpectrumHC9789027491633.'],
 [812,13009439,'HannaBervoets/WatWijZagen/Boekenweekfrontwithabstractcitystairs; exact2021CPNBHC9789059655447.'],
 [813,10865718,'JorisLuyendijk/KunnenWePraten/AtlasContactfrontpoliticalphotocollage; exactDutchPB9789045034140.'],
 [815,12528768,'LeviWeemoedt/PessimismeKunJeLeren/DeMooisteVersjesUitgekozenDoorOzcanAkyol/NijghVanDitmarfrontdecorativepattern; exact2018HC9789038806310, selectorcreditedcorrectly.'],
 [816,6878732,'DimitriVerhulst/DeLaatsteLiefdeVanMijnMoeder/UitgeverijContactfrontpinkperfumebottle; exact2010DutchPB9789025438180.'],
 [818,10480172,'YellowHarryMulisch/ArchibaldStrohalmfrontwithrunningman/stairs; exact1980DutchPB9789023406907.'],
 [819,6460738,'ArnonGrunberg/DeHeiligeAntoniofrontorangefacecloseup; exact1998CPNBPB9789074336390, notlaterNijghprinting.']
]){
 const name='reviewed-'+n+'.json',r=read(name),e=d.editions.find(e=>e.id===r.edition.id),receipt=(id<8000000?'cover-':'cover-normal-')+id+'.json',c=read(receipt);
 if(!e||e.work_id!==r.workId||e.open_library_edition_id!==r.edition.sourceKey||!c.sha256||(e.isbn_13!==null&&e.isbn_13!==r.edition.isbn13))throw Error('Exactcurrentedition/coverdiffers '+n);
 const fills=e.isbn_13===null;r.cover={id,receipt,sha256:c.sha256,bytes:c.bytes,visualReview:'Actually viewed: '+note};r.status=fills?'approved_existing_edition_repair_proposal':'approved_existing_presentation_proposal';r.currentReadback='followup-preflight-readback-019.json';r.importApproved=false;r.remaining=['Source-approved only; separate executable manifest/local/hosted tests outside frozen batch001'];
 if(fills)r.identityDecision+=' CurrentISBN13NULLwithmatchingISBN10/sourcekey; futuremanifestmayfillverifiedISBN13onlyunderfull-rowCAS. AlreadyDutch net0availability, no duplicateedition.';
 if(n===812)r.identityDecision+=' PinnedKBexpandedHannaMarleenBervoets and primarybylineHannaBervoets refer tosame exactISBN; no globalauthorrename.';
 if(n===819)r.sources.push({url:'https://www.deslegte.com/de-heilige-antonio-1002854/',role:'ExactCPNB1998DutchpaperbackISBN96p independentlyconfirmsbinding',checkedOn:'2026-11-03'});
 fs.writeFileSync(new URL(name,ROOT),JSON.stringify(r,null,2)+'\n');
}
for(const n of[810,811,817]){const name='reviewed-'+n+'.json',r=read(name);r.currentReadback='followup-preflight-readback-019.json';if(n===817)r.identityDecision+=' Currentedition1818ISBN13NULLbutISBN10/sourcekeymatches; noISBNfillapprovedbeforeexactHCfrontdelivery. CurrentWorkyear1980isprintingyear, primary1969original separatelyproposednotexecuted.';fs.writeFileSync(new URL(name,ROOT),JSON.stringify(r,null,2)+'\n');}
