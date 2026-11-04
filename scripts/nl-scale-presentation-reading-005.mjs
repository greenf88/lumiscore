// Explicit human/model readings of these dossiers only. No network, writes or approvals by score.
import fs from 'node:fs';
import {ROOT} from './nl-scale-snapshot.mjs';
import {loadCases} from './nl-scale-case-store.mjs';
const readings=[
 [345,'Dutch original De goede zoon, Rob van Essen, exact ISBN. Speculative setting is a novel, not factual history.'],
 [562,'Trials of Apollo volume4, not another Riordan series or a new Work.'],
 [567,'Condé novel imagining Tituba; not a factual biography or another author’s Salem book.'],
 [571,'Reuse the unambiguous Sfeer paperback OL39479385M, not the parenthesized source title. Original author bibliography confirms1987.',1987,['https://michaelcrichton.com/work/books/','https://michaelcrichton.com/works/sphere/'],'/books/OL39479385M'],
 [583,'Same Flight of the Nighthawks, first Darkwar novel. Author tables bind Dutch hardcovers and first original2005.',2005,['https://www.crydee.com/raymond-feist/reading-order/written','https://www.crydee.com/raymond-feist/publication-information/netherlands/darkwar-saga']],
 [585,'Original third Dollanganger novel by Virginia Andrews; not Thorn/Seeds omnibus.'],
 [592,'Exact Dutch translation of La tía Julia y el escribidor1977. Aunt Julia and radio playwright are one novel.'],
 [600,'Hale prose retelling The Goose Girl2003, not Brothers Grimm original or a new translation Work.'],
 [603,'Chaoswar first novel A Kingdom Besieged2011; existing2017paperback and its own cover, not2011hardcover. Series links retained.',null,null,'/books/OL61291384M'],
 [621,'Hour Game2004 and King/Maxwell identity, not another same-title thriller.'],
 [622,'Firestar’s Quest2007 super edition; full separate novel, not a regular-series volume or an omnibus. Erin Hunter collective byline retained.'],
 [623,'La fiesta del Chivo2000; existing2001paperback with its own cover. Urania’s later return is not set in1961. Historical reconstruction remains a novel.',null,null,'/books/OL36682628M'],
 [624,'The Taking2004 by Dean Ray Koontz, full canonical name of existing author; no author rewrite.'],
 [637,'Carrère’s Limonov2011, not a book authored by its subject Eduard Limonov.'],
 [643,'Hold Tight2008/Houvast. Character concerns and crime plot kept distinct from medical facts.'],
 [654,'Yellowfang’s Secret2012 separate Warriors super edition; no changed sequence or taste rules.'],
 [686,'Full13½Lives Blaubär novel, not a selected storybook. Author confirms first1999.',1999,['https://www.zamonien.de/buch_blaubaer_penguin.php','https://www.zamonien.de/autor.php']],
 [694,'The Boy from the Woods is Wilde first novel. Author and publisher date17March2020, not current2019.',2020,['https://www.harlancoben.com/harlanwhatsnew-4/','https://www.hachettebookgroup.com/titles/harlan-coben/the-boy-from-the-woods/9781538748169/?lens=grand-central-publishing']],
 [695,'Drop Shot/Tegenwerking, second Myron Bolitar1996; not Deal Breaker or another sports novel.'],
 [709,'The Robber Bride1993 by Margaret Eleanor Atwood, canonical full name of existing author.'],
 [718,'El árbol de la ciencia first1911. KB2012copyright belongs to later source edition, not new Work.'],
 [719,'Fade Away1996/Vermist Myron Bolitar novel; no other same-title identity.'],
 [721,'Written in Bone2007, David Hunter second novel. Exact Dutch last-silence title, not another Written in Bone book.'],
 [749,'The White Road2002 Charlie Parker novel. Charges and fictional supernatural plot not stated as established facts.'],
 [751,'Carrasco Intemperie2013, exact Dutch De vlucht. Not another work called Flight.'],
 [752,'Das Jesus Video original1998 retained; KB2002 identifies later German edition, not original. No automatic year correction.'],
 [753,'Glavinic Die Arbeit der Nacht2006, not another same-title work; vanished-city premise is fiction.'],
 [760,'Karen Kingsbury Family2006 in Firstborn; exact Dutch Geliefd, not other generic-title books. Faith as characters’ perspective.'],
 [766,'Les Années2008. Two OL records share oneISBN: reuse exact existing identity, never duplicate edition.',2008,['https://www.nobelprize.org/uploads/2022/10/bio-bibliography-literatureprize2022.pdf']],
 [771,'Live Wire2011/Levenslijn Myron Bolitar novel; no personal ranking change.'],
 [781,'Complete Rumo2003 in two internal books, not two new Works or Blaubär.'],
 [786,'Smoke Mountain2009 is Seekers bears volume3, not Warriors cats despite shared Erin Hunter byline.'],
 [790,'One Fifth Avenue2008 by Candace Bushnell, exact Dutch numeral title.'],
 [795,'Tonje Glimmerdal2009 translated Tonje en de geheime brief; not Maria Parr’s other novels.'],
 [828,'Dutch original Drift2018 Bregje Hofstede, no translation Work duplication.'],
 [832,'Douglas Kennedy The Big Picture1997/Het oog van de lens; not other books with Big Picture title.'],
 [868,'Rafik Schami Die dunkle Seite der Liebe2004, same complete novel; no clans treated as factual account.'],
 [911,'The Divide2005 by Nicholas Evans/Het keerpunt. Alleged offences not stated as proven guilt.'],
 [914,'Der Triumph der Zwerge2015 complete Dutch hardcover, existing sequence retained.'],
 [916,'Faye Kellerman Sanctuary1994/Toevluchtsoord, not another Sanctuary Work.'],
 [919,'Leaving the World originally Hutchinson2009; US2010 edition is not original and current1998 is wrong.',2009,['https://www.simonandschuster.com/books/Leaving-the-World/Douglas-Kennedy/9781439180785']],
 [959,'Arthur Valentijn Japin canonical full name; Kolja is a novel, not established historical alternative to cholera.'],
 [985,'Dutch original Stern by Thomas Heerma van Voss. Same teacher Hugo Stern identity.']
];
const cases=loadCases().cases,entries=readings.map(([n,reason,year,extraSources,editionKey])=>{
 const c=cases.find(c=>c.caseNumber===n);if(!c?.workId)throw Error('Existing Work required');return {caseNumber:n,workId:c.workId,reason,...(year?{year,extraSources}:{}),...(editionKey?{editionKey}:{})};
});
entries.push({caseNumber:460,workId:1585,year:2016,extraSources:['https://proapi.planetadelibros.com/descargas/sala-prensa-libro/enlaces/221325/el-laberinto-de-los-espiritus.pdf'],editionKey:'/books/OL45307798M',coverId:13126795,reason:'Repair existing exact paperback1698NULL language to Dutch. No unnecessary hardcover or duplicate Work. Original Spanish2016, Dutch first2017, this paperback2018.',supplementalEdition:{editionKey:'/books/OL45307798M',title:'Het labyrint der geesten',isbn13:['9789056726126'],format:'paperback',publisher:['Signatuur'],languageConfirmed:true,titleConfirmed:true,authorConfirmed:true,problems:[],kbRecords:[{uri:'http://data.bibliotheken.nl/id/nbt/p416937306'}],sourceEvidence:{kbResponseSha256:'7d81cf6c2368b5ff04e19e4b4681ca487b2ec179f09f761a8c9e3ce7ebaafb57',review:'focused-source-readings-005.json',singleIsbnOLRecord:true}},bibliographyOverride:{isbn13:'9789056726126',language:'nl',format:'paperback',source:'https://data.bibliotheken.nl/id/nbt/p416937306',secondSource:'https://www.wehkamp.nl/het-kerkhof-der-vergeten-boeken-het-labyrint-der-geesten-carlos-ruiz-zafon-16138198/'}});
const dir=new URL('subbatches/005/',ROOT);fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(new URL('reviewed-input.json',dir),JSON.stringify({reviewedAt:'2026-11-02T17:52:00.000Z',scope:'43existing Dutch presentation repairs plus one existing-paperback exclusion repair; no production new Works or editions.',entries},null,2)+'\n');
const ids=entries.map(x=>x.workId);
const q=`with chosen as(select * from public.works where id=any(array[${ids.join(',')}]::bigint[])) select jsonb_build_object('checked_at',clock_timestamp(),'works',(select jsonb_agg(to_jsonb(t) order by id) from chosen t),'authors',(select jsonb_agg(to_jsonb(t) order by id) from public.authors t where id in(select author_id from chosen)),'editions',(select jsonb_agg(to_jsonb(t) order by id) from public.editions t where work_id in(select id from chosen)),'descriptions',(select coalesce(jsonb_agg(to_jsonb(t) order by work_id,language),'[]') from public.catalog_work_descriptions t where work_id in(select id from chosen)),'metadata',(select coalesce(jsonb_agg(to_jsonb(t) order by edition_id),'[]') from public.catalog_edition_metadata t where work_id in(select id from chosen))) as preflight;`;
fs.writeFileSync(new URL('production-preflight-readonly.sql',dir),q+'\n');console.log(JSON.stringify({entries:entries.length,workIds:ids}));
