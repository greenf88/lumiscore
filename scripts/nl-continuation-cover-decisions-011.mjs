import fs from 'node:fs';import {ROOT} from './nl-continuation-bootstrap.mjs';
const read=n=>JSON.parse(fs.readFileSync(new URL(n,ROOT))),snapshot=read('followup-preflight-readback-009.json').data;
if(snapshot.project!=='qvplwejffhjvxaypmjut')throw Error('Wrong project');
for(const [n,id,note] of [
 [475,6754871,'BluegreytypographicGerardReve/OpWegNaarHetEinde/VanOorschotfront, exact1983HC9789028205598. NotoldercurrentNULLISBNeditionOL13974374M.'],
 [476,6718074,'DarkredtypographicGerardReve/NaderTotU/VanOorschotfront, exact1983HC9789028205604, notoldcurrentOL21968282Munknownprint.'],
 [477,6754875,'GreybeigeGerardReve/MoederEnZoon/Manteaufront, exact1984HC9789010047694 matchingexistingOL24649202M. ExistingISBNisNULLnotalreadyfilled; narrowCASmustfillandsetverifiedlanguage/format.'],
 [479,6878731,'CreamTommyWieringa/Caesarion/romanDBBfront, womanontheedgeofpool, exact2011DutchPB9789023465140 notEnglishedition9781846272547.'],
 [485,6757671,'CreamSimonVestdijk/TerugTotInaDammanfront, halffaceand1993-5schoolserieslabel. ExactWoltersNoordhoff1993Dutchpaperback9789001547929, notstudyguide.']
]){
 const name='reviewed-'+n+'.json',r=read(name),receipt='cover-'+id+'.json',c=read(receipt),existing=snapshot.editions.find(e=>e.open_library_edition_id===r.edition.sourceKey);
 if(!c.sha256||!snapshot.works.some(w=>w.id===r.workId))throw Error('Missing existing Work or image proof');
 if(n===477){if(existing?.id!==1019||existing.work_id!==1019||existing.language!==null||existing.isbn_13!==null)throw Error('Existing edition differs');r.edition.id=1019;r.expectedCurrentEdition=existing;r.editionCorrection={language:'nl',isbn13:r.edition.isbn13,format:'hardcover',scope:'OnlyexactexistingOLedition; nootherNULLISBNeditions'};}
 else if(existing||snapshot.editions.some(e=>e.isbn_13===r.edition.isbn13))throw Error('New edition alreadyexists');
 r.cover={id,receipt,sha256:c.sha256,bytes:c.bytes,visualReview:note};r.status=n===477?'approved_existing_edition_repair_proposal':'approved_edition_addition_proposal';r.importApproved=false;r.currentReadback='followup-preflight-readback-009.json';r.remaining=['Source-approved only; separate exact executable manifest/local and hosted tests, outside frozen batch001'];fs.writeFileSync(new URL(name,ROOT),JSON.stringify(r,null,2)+'\n');
}
