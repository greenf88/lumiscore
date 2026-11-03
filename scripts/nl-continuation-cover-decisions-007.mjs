import fs from 'node:fs';import {ROOT} from './nl-continuation-bootstrap.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL(n,ROOT)));
const snapshot=read('followup-preflight-readback-005.json').data;
if(snapshot.project!=='qvplwejffhjvxaypmjut')throw Error('Wrong read-only project receipt');
for(const [n,id,status,note] of [
 [382,13195221,'approved_edition_addition_proposal','Green front: RandallMunroe/HoeDan?/BizarreWetenschappelijkeAdviezenVoorAlledaagseProblemen/Spectrum, notWhatIf. Source exact9789000378739,331x500.'],
 [404,12058392,'approved_edition_addition_proposal','Black/red MarioPuzo/DePeetvader puppet-handfront, mapped exactDutch1993print9789022509012,315x500; notEnglishfilmjacket.'],
 [405,12019270,'approved_edition_addition_proposal','StephenKing/orangelettering/AardedonkerZonderSterren/hands+oval front mapped exact2010firstDutchprint9789024562626,307x500.'],
 [407,12013998,'approved_edition_addition_proposal','Blue eye-front HetJuvenalisDilemma/DanBrown, exact2007Dutch9789024527915. OldBreda librarybarcode top disclosed; title/author readable,295x500.'],
 [408,8145741,'approved_edition_addition_proposal','Cream/bluefeather PaulKalanithi/AlsAdemLuchtWordt/HollandsDiepfront, exactpublisher2016bound9789048834587,309x500. Nearidenticalalternate8145743 inspected, notanother countedcover.'],
 [425,11016607,'approved_edition_addition_proposal','Red JohnGrisham/AchterGeslotenDeuren/ThePelicanBrief actionwomanfront. Exact1992/93AWBruna9789022980613. Not B.A.Paris sameDutchtitle;319x500.'],
 [286,6754873,'approved_new_work_proposal','Yellow/red title GerardReve/EenCircusjongen/Levensroman/Athenaeumfront. Exact1975clothbound9789025305413, notsimultaneousElsevierpaperback9010015009.'],
 [290,6760480,'approved_new_work_proposal','Yellowblackfront GerardReve/INGESPREK/INTERVIEWS/deProm. Exact1983Dutch9789026325168; notCarmiggelt1980conversations.']
]){
 const name='reviewed-'+n+'.json',r=read(name),receipt=(id<8000000?'cover-':'cover-normal-')+id+'.json',c=read(receipt);
 if(!c.sha256)throw Error('Successful exact cover receipt required');
 if([286,290].includes(n)){
  if(snapshot.author_corpora.some(w=>[638,887].includes(w.author_id)&&w.title.toLowerCase()===r.edition.title.toLowerCase()))throw Error('Existing title needs identity resolution');
  r.proposedWork={...r.proposedWork,primaryAuthor:{id:638,name:'Gerard Kornelis van het Reve',sourceKey:'OL55234A'}};
  r.identityDecision+=' Currentreadback005 covers bothknownReveauthorIDs638/887 andtheircorpora; proposedtitle/sourceISBN absent. Reuseexisting638, no thirdauthor orauthor-merge. KnownBezorgdeOudersdouble remainsseparate.';
 }
 if(n===382&&(!snapshot.works.some(w=>w.id===7005&&w.open_library_id==='OL20128880W')||snapshot.editions.some(e=>e.isbn_13===r.edition.isbn13)))throw Error('HowTo expected state changed');
 r.cover={id,receipt,sha256:c.sha256,bytes:c.bytes,visualReview:note};r.status=status;r.importApproved=true;
 r.currentReadback='followup-preflight-readback-005.json';r.remaining=['PR71 overlap/manifest/local validation','Separate test import, committed recovery and exact hosted acceptance; excluded from frozen batch001'];
 fs.writeFileSync(new URL(name,ROOT),JSON.stringify(r,null,2)+'\n');
}
const h=read('reviewed-474.json'),hc=read('cover-6453119.json');
h.cover={id:6453119,receipt:'cover-6453119.json',sha256:hc.sha256,bytes:hc.bytes,visualReview:'Greenbrick/floatingwomanfront HerinneringenVanEenEngelbewaarder/WFHermans. ExactDutchbound9789023460244, notOhlsson.'};
h.status='substantive_review_complete_existing_edition_conflict';h.importApproved=false;
h.identityDecision+=' Freshproductionreadback005 finds existingedition1015 titleEngelbewaarders/ISBN9789044335781/HouseOfBooks: primarypublisher andprintcolophon identifyKristinaOhlssonAnglavakter2011, ebook2012. It is NOTaHermansprint and mustnotbe relabelledDutch/print for thisWork. CorrectDutchaddition is sourced, butwrongexistinglink/dependencies need separatelyreviewed resolution. No automaticmove/delete.';
h.sources.push({url:'https://www.thehouseofbooks.com/boek/1896/kristina-ohlsson-engelbewaarders.html',role:'Primary exact9789044335781 digitalOhlsson, contradicts existingHermanslink',checkedOn:'2026-11-03'},{url:'https://www.bruna.nl/images/active/InkijkPDF/eboekhuis/9789044335781.pdf',role:'Publishercolophon Ohlsson2011/2012, ebook35781 distinctprint35026',checkedOn:'2026-11-03'});
h.remaining=['Read-only historicaleditionmapping/dependencies; separateidentityrepair before approving fullpresentation package','No existingrating/edition link movement ordelete'];fs.writeFileSync(new URL('reviewed-474.json',ROOT),JSON.stringify(h,null,2)+'\n');
const noort=read('reviewed-480.json');noort.currentReadback='followup-preflight-readback-005.json';noort.identityDecision+=' Freshreadback existingedition1072 has NULLISBN aswellasNULLlanguage; fill exactverified9789041409690 togetherwithdut, notclaimalready-storedISBN. Existingauthor659SaskiaNoort retained.';fs.writeFileSync(new URL('reviewed-480.json',ROOT),JSON.stringify(noort,null,2)+'\n');
