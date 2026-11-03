import fs from 'node:fs';import {ROOT} from './nl-continuation-bootstrap.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL(n,ROOT))),snapshot=read('followup-preflight-readback-006.json').data;
if(snapshot.project!=='qvplwejffhjvxaypmjut')throw Error('Wrong read-only project');
for(const [n,id,status,note] of [
 [383,6624880,'approved_edition_addition_proposal','Brown/goldsea front Schateiland/RobertStevenson/Prismaroman, source exactDutchSpectrumISBN9789027407658. Printingdate/barcode notvisible, no exactprintingyearimageclaim.'],
 [608,6666750,'approved_existing_presentation_proposal','Yellowfront WILLIAMSHAKESPEARE/GERRITKOMRIJ/RICHARDIII/BERTBAKKER, blackjester/skull illustration. Exact1989Dutch9789035107526.'],
 [609,6454572,'approved_existing_presentation_proposal','Blackfrontgreenpaintedairplane/Nachtvlucht/AntoineDeSaintExupery/Goossens. ExactDutch9789065511041, notSuzanneVermeersameDutchtitle.'],
 [611,6796746,'approved_existing_presentation_proposal','Brown/goldtraditionalpainting front JUNGCHANG/WILDEZWANEN/DRIEDOCHTERSVANCHINA. ExactForum9789022517260, notnewFlyWildSwans.'],
 [618,6456217,'approved_existing_presentation_proposal','Petronius/Satyricon/AthenaeumPolakVanGennep front paintedhouses/harbourfigures, exact1972DutchLeemanISBN mapping.'],
 [594,11016752,'approved_existing_presentation_proposal','JohnGrisham/HETVONNIS/[THECHAMBER] purple/redfront withtwofaces/tree. Exact2003pocket9789022987339. Alternate11016668 byte-identical, countonecover.'],
 [602,11643894,'approved_existing_presentation_proposal','OrangeRaymondEFeist/KRONDOR/openbook-runningfigure front explicitlyEERSTEBOEK-HETVERRAAD. Exact9789022532577, notTraanDerGoden.'],
 [605,12029506,'approved_existing_presentation_proposal','BlackVirginiaAndrews/MnLieveAudrina/ROMAN front palegirl/spiderweb andtoys, exact1983DeKern9789032501907. ExpandedVirginia sameauthor, notsequel.'],
 [607,12794773,'approved_existing_presentation_proposal','GeronimoStilton/EenNoodkreetUitTransmuizanie front orangeflagovercastle/forest andmice, exact2007HC9789085920304.'],
 [615,12794850,'approved_existing_presentation_proposal','GeronimoStilton/BungelendAanEenStaartje greenflagfront mousehangingfromyeti aboveforest; exactstandardHC9789059243613, notAVIadaptationcover.']
]){
 const name='reviewed-'+n+'.json',r=read(name),receipt=(id<8000000?'cover-':'cover-normal-')+id+'.json',c=read(receipt);
 if(!c.sha256)throw Error('Successful transport required');
 if(r.workId&&!snapshot.works.some(w=>w.id===r.workId)&&n!==383)throw Error('Missing current Work snapshot');
 r.cover={id,receipt,sha256:c.sha256,bytes:c.bytes,visualReview:note};r.status=status;r.importApproved=false;
 r.currentReadback=n===383?'followup-preflight-readback-005.json':'followup-preflight-readback-006.json';
 r.remaining=['Source-approved only: separate manifest/local/test import, committed recovery and exact hosted acceptance; excluded from frozen batch001'];
 if(n===609)r.identityDecision+=' Freshsnapshot additionally findsSuzanneVermeerWork1295sameDutchNachtvlucht/author713/ISBN9789400517738: explicitlydistinctbook, no title-onlymerge.';
 if(n===618)r.identityDecision+=' Existing1425 hasISBN10only9025380743; mathematical9789025380748 verifiedexactsource. PreserveISBN10, proposeISBN13fill withfullrowCAS ifbindingrequires, notnewedition.';
 fs.writeFileSync(new URL(name,ROOT),JSON.stringify(r,null,2)+'\n');
}
const s=read('reviewed-593.json');s.coverReview={id:6666417,receipt:'cover-6666417.json',decision:'Cream/blackTabula JanJonk/sonnetten image may be a titlepage rather than externalfront; no approvedcover oridentity-fromHTTPclaim. Needindependentcoverconfirmation; bilingualpolicy also unresolved.'};fs.writeFileSync(new URL('reviewed-593.json',ROOT),JSON.stringify(s,null,2)+'\n');
const m=read('reviewed-601.json');m.summary.text=m.summary.text.replace('Hal, inmiddels hertog van Crydee,','Hal, inmiddels hertog,').replace('in het Grijze Gebergte','in de Grijze Torens');m.sources.push({url:'https://www.lsuitgeverij.nl/boek/het-einde-van-de-magiers/',role:'PrimaryDutchpublisher plot/place Schre iborg andGrijzeTorens; differentpaperback9789024566945 keptseparate',checkedOn:'2026-11-03'},{url:'https://www.fantasywereld.nl/boeken/boekrecensies/de-saga-van-de-chaosoorlog-3-het-einde-van-de-magier-raymond-e-feist/',role:'ContemporaryDutchreview confirmsPuglocalizedPuc; noendingadopted',checkedOn:'2026-11-03'});fs.writeFileSync(new URL('reviewed-601.json',ROOT),JSON.stringify(m,null,2)+'\n');
