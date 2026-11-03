import fs from 'node:fs';import {ROOT} from './nl-continuation-bootstrap.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL(n,ROOT))),snapshot=read('followup-preflight-readback-013.json').data;
if(snapshot.project!=='qvplwejffhjvxaypmjut')throw Error('Wrong project');
for(const[n,id,note]of[
 [678,13715577,'Actually viewed palegreen Wereldbibliotheek/IsabelAllende/LiefdeEnSchaduw front with smallblackbird. Exact1986DutchPB9789028415089 source. VendorKLONDYKE.NL watermark at lower edge remains disclosed; not a barcode verification.'],
 [680,6832259,'Actually viewed black/red-white Dawkins/HetVerhaalVanOnzeVoorouders front, fourcircularnatureimages andNieuwAmsterdamlogo. ExactDutchPB9789046803363, not2016YanWongrevision.'],
 [690,13691584,'Actually viewed TomSharpe/Wilt/Rainbow front, cartoonman holdingupside-downwoman beside rubble/fence. ExactDutchMuntingaRainbowPB9789067661294; three sourcecopiesnotthreeeditions.'],
 [696,10170429,'Actually viewed grey-green DeanKoontz/SpiegelVanDeZielfront withfragmentedfaceandbirdmotif. ExactDutchPB9789024547791, notTheFaceOfFear.'],
 [704,11056069,'Actually viewed maroon VirginiaAndrews/HetZaadVanGisteren/ZwarteBeertjes front withtornpaperportraitoffamily andexplicitfourthDollangangerline. ExactPB9789044924824, notcombinedomnibus.'],
 [712,13446494,'Actually viewed HarlanCoben/ValsSpel/Boekerij front withsilhouetteinorange-yellowpassage. ExactPB9789022566206 forDealBreaker; otherWork2321sameDutchtitle notthiswork.'],
 [737,11004224,'Actually viewed HarlanCoben/IkMisJe/Boekerij front withwomanatlaptopinreddarkroom. ExactDutchPB9789022565186; excluded ebookISBNfrommixedsource.'],
 [756,6460743,'Actually viewed redscribbledwhitelettering PaulienCornelisse/TaalIsZegMaarEchtMijnDing/Contactfront. Exact2009DutchPB9789025430498. Smallarchivedfront readable atcard size; nohighresolutiondetailqualityclaim.']
]){
 const name='reviewed-'+n+'.json',r=read(name),receipt=(id<8000000?'cover-':'cover-normal-')+id+'.json',c=read(receipt),e=snapshot.editions.find(e=>e.id===r.edition.id);
 if(!c.sha256||!e||e.work_id!==r.workId||e.isbn_13!==r.edition.isbn13||!['nl','dut','nld'].includes(e.language))throw Error('Exactexistingrow differs');
 r.cover={id,receipt,sha256:c.sha256,bytes:c.bytes,visualReview:note};r.status='approved_existing_presentation_proposal';r.importApproved=false;r.netNewDutchAvailability=0;r.currentReadback='followup-preflight-readback-013.json';r.remaining=['Source-approved only; separate executable manifest/local and hosted tests, outside frozen batch001'];fs.writeFileSync(new URL(name,ROOT),JSON.stringify(r,null,2)+'\n');
}
const r=read('reviewed-705.json');r.currentReadback='followup-preflight-readback-013.json';r.coverIdentityPending={id:11616529,receipt:'cover-normal-11616529.json',visualReview:'Actually viewed darkorangeMarkusHeitzDeDwergenLuitinghFantasyfront withaxe. Correctbook/Dutchtitle, but sameOLrecordmixesHC9789024559923andPB9789024559893; front alone cannot proveHC-specificbinding. Exact physicalfrontcomparison still required.'};r.remaining=['Compare exact numbered-hardcover photograph against retrievedfront beforebinding','Currentproduction3347ISBN9789024559923confirmed; noeditionchange needed','Separate executable manifest/local and hosted acceptance, outside frozen batch001'];fs.writeFileSync(new URL('reviewed-705.json',ROOT),JSON.stringify(r,null,2)+'\n');
