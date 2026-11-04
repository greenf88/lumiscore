// Materialise individual observations from sheets5–11, actually viewed2Nov.
// Front consistency never approves language, format, parent or production import.
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {ROOT,readJson} from './nl-scale-snapshot.mjs';
const decoded=readJson(new URL('cover-decode-results-v3.json',ROOT));
const old=new Set(readJson(new URL('cover-decode-results-v2.json',ROOT)).map(x=>x.coverId));
const explicit=[13137506,13137510,13137509,13784395,13780622,13652327,13012342,12034394,14551422,14550907,14553519,13536434,8865775,9271483,14653088,14653583,14655590,8132062,13948237,13887241,13104356,14348677,13197724,13151263,8738188,8738097,8738205,12869701,13806823,13730412,13675825,12794772,14647206,12058535,13208397,13666731,12882892,12888077,12151382,12156876,12151975,9357730,12532222,14533348,12257712,12146662,12149694,13772874,13773258,13774597,12566445,13614740,13616058,13612495,13611035,13615432,13463514,14423527,10527813,10574515,9328458,13862231,12377658,12524461,14621177,12063116,13057284,12947799,12949814,13188713,13446367,13445849,12003708,12585540,12544476,12541785,14586497,12667713,12666932,12552996,12916746,13766297,13649954,13647694,8063733,14431636,14411235,10863169,13714677,12313454,9246145,13027553,13262380,8758450,10974296,8961510,8844201,10952479];
const notes={
 13137506:'Dutch Caesar laurel-wreath album, writingGoscinny/artUderzo visible; exact source ISBN still separately required.',
 13137510:'Dutch first legion album, writingGoscinny/artUderzo visible; not an English ISBN.',
 13137509:'Dutch Goths album, writingGoscinny/artUderzo visible; full album scope still separately required.',
 13806823:'Front credits BOTH Stephen Hawking and Leonard Mlodinow: A Briefer History edition, not current Work2392 A Brief History1988. Binding conflict retained; no import approval.',
 9328458:'101×155 source is too small for a reliable detailed cover/edition reading. Title begins correctly but obtain better exact-edition image before detail approval.',
 13652327:'Title and Tess Gerritsen readable;131×200 original supports small card only, no sharp detail assertion.',
 13197724:'Title and Bernhard Schlink readable;129×212 original supports small card only, no sharp detail assertion.',
 9271483:'Title/Michael Ende visible, public-library ownership label overlays lower illustration. No borrower information or barcode-to-ISBN assertion.',
 12058535:'Laura Ingalls Wilder and Little House part7 visible; title partly obscured by library label. Verify source exact edition/series independently.',
 14621177:'Nicholas Evans/The Divide/Het keerpunt visible; library label overlays illustration, not identity.',
 12666932:'John Connolly/Het witte pad readable; library discard label overlays illustration.',
 12313454:'Nelson DeMille/De crash readable; library label and1.28MB archived source retained as quality/performance limits.',
 10974296:'Douglas Kennedy/Aan het einde van de wereld visible; library label overlays illustration.',
 9246145:'Front credits Andrea Kettenmann, Frida Kahlo is subject, not author. Artist biography identity must remain distinct.',
 8738188:'Magnus Chase book3 Het schip der doden clearly visible; distinct from part2 in subbatch001.',
 13208397:'Apollo/De tombe van de tiran/book4 visible; keep separate from Magnus Chase and other Riordan series.',
 8738097:'Artemis Fowl Eeuwige code Dutch title visible; unlike uncertain English Noordhoff part1 cover, this is a Dutch candidate.',
 13772874:'Warrior Cats superedition Vuursters missie; not a regular numbered-volume inference.',
 13862231:'Warrior Cats superedition Geeltands geheim; not a regular numbered-volume inference.',
 13012342:'Virginia Andrews Dawn-series part2 explicitly visible.',
 14551422:'Virginia Andrews Dawn-series finalpart explicitly visible.',
 14423527:'Virginia Andrews Dawn-series part1 explicitly visible.',
 13188713:'Harlan Coben Wild, not Cheryl Strayed memoir. Work/author binding independently checked.',
 13151263:'City of Fallen Angels/Dutch series4 visible. Film-tie-in people on front do not prove adaptation of book text.',
 13262380:'1979/Christian Kracht readable but source low resolution; no high-detail quality claim.'
};
if(new Set(explicit).size!==98)throw Error('Explicit visual review list drift');
const reviews=explicit.map(id=>{const x=decoded.find(x=>x.coverId===id);if(!x?.decoded||old.has(id))throw Error('Missing newly viewed exact image');return{candidateId:x.candidateId,editionKey:x.editionKey,isbn13:x.isbn13,coverId:id,sha256:x.sha256,dimensions:x.dimensions,bytes:x.bytes,status:id===13806823?'candidate_work_binding_conflict':id===9328458?'insufficient_detail_quality':'front_title_author_consistent_with_bound_source',note:notes[id]??null};});
const sheets=[5,6,7,8,9,10,11].map(n=>{const path='outputs/nl-scale-20261102/covers-v3/sheet-'+String(n).padStart(3,'0')+'.jpg';return{path,sha256:createHash('sha256').update(fs.readFileSync(new URL('../../'+path,ROOT))).digest('hex')};});
const file=new URL('cover-semantic-review-003.json',ROOT),body=JSON.stringify({reviewedOn:'2026-11-02',reviewMethod:'Individually viewed all new98 images on seven contact sheets, compared visible title and primary author with bound edition labels. No visible barcode or printing-year proof claimed. Work, ISBN, language and format approval remain separate.',sheets,reviews},null,2)+'\n';
if(fs.existsSync(file)&&fs.readFileSync(file,'utf8')!==body)throw Error('Explicit amendment required');fs.writeFileSync(file,body);console.log({newVisualReadings:reviews.length,frontConsistent:reviews.filter(x=>x.status==='front_title_author_consistent_with_bound_source').length,held:reviews.filter(x=>x.status!=='front_title_author_consistent_with_bound_source').length});
