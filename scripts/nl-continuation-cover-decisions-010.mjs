import fs from 'node:fs';import {ROOT} from './nl-continuation-bootstrap.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL(n,ROOT))),snapshot=read('followup-preflight-008-readback.json').data;
if(snapshot.project!=='qvplwejffhjvxaypmjut')throw Error('Wrong project');
for(const [n,id,note] of [
 [427,6455662,'GreenGreek-border SophoclesAntigone/PéHawinkelsfront. ExactAmboDutch1970paperback9789026301292, notAnouilhadaptation.'],
 [432,6666746,'Pink WilliamShakespeare/GerritKomrij/WatUWilt/BertBakker front, centralleavesandfacingprofiles. Exact1990DutchHC9789035108349. UnusualDutchtitle independentlyAsYouLikeIt, notTwelfthNight.'],
 [441,11408577,'Greenfingerprint/handbehindglass JohnGrisham/DeDealfront. Exact2005DutchAWBrunaPB9789022989302. OldlibrarywithdrawalstickerOpenbareBibliotheekBeverendisclosed; notwrongbook.'],
 [448,12081612,'Cream/orange IraLevin/DeJongensUitBrazilie front, blacksilluettewithraisedarm. Exact1996DutchZwarteBeertjes9789044917963; not57pEnglishreader orcondensation.'],
 [454,6666420,'Palepeach WilliamShakespeare/GerritKomrij/RichardII/BertBakker front, centralgoldcrownedfigure. Exact1990DutchHC9789035108325, distinctRichardIII.'],
 [465,6578910,'Brown/goldKlassiekenCharlesDickens/NicolaasNicklebyfront, smallmonochromeperiodillustration. ExactSpectrumDutch1978HC9789027491091, notreaderadaptation.']
]){
 const name='reviewed-'+n+'.json',r=read(name),receipt=(id<8000000?'cover-':'cover-normal-')+id+'.json',c=read(receipt);
 if(!c.sha256||!snapshot.works.some(w=>w.id===r.workId)||snapshot.editions.some(e=>e.isbn_13===r.edition.isbn13))throw Error('Existing Work/new edition state or image proof differs');
 r.cover={id,receipt,sha256:c.sha256,bytes:c.bytes,visualReview:note};r.status='approved_edition_addition_proposal';r.importApproved=false;r.currentReadback='followup-preflight-008-readback.json';r.remaining=['Source-approved only; separate executable manifest/local and hosted acceptance, excluded from frozen batch001'];fs.writeFileSync(new URL(name,ROOT),JSON.stringify(r,null,2)+'\n');
}
