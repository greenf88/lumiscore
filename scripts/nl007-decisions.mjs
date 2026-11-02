// Source-review decisions only. No database client, no automatic source/cover approval.
import fs from'node:fs';import assert from'node:assert/strict';
const dir='catalog/nl-research-007-20261101/',read=n=>JSON.parse(fs.readFileSync(dir+n)),save=(n,v)=>fs.writeFileSync(dir+n,JSON.stringify(v,null,2)+'\n');
const frozen=read('frozen100.json'),summaries=[1,2,3].flatMap(i=>read('original-summary-reviews-0'+i+'.json').summaries),sources=fs.readdirSync(dir+'sources').filter(n=>n.endsWith('.json')).map(n=>({file:n,...read('sources/'+n)}));
const choices=`
1009 exact-1009 9789023476825
1010 exact-1010 9789403134833
1012 exact-1012 9789023463825
1022 exact-1022 9789403108209
1023 exact-1023 9789403103600
1026 exact-1026 9789023459743
1030 exact-1030 9789021434223
1032 exact-1032 9789021450759
1036 exact-1036 9789026340994
1065 exact-1065 9789029553483
1068 exact-1068 9789044645774
1069 exact-1069 9789029574310
1107 exact-1107 9789025885793
1110 exact-1110 9789025875688
1142 alternative-1142 9789045125084
1143 exact-1143 9789024598786
1146 exact-1146 9789046706466
1174 exact-1174 9789403125008
1175 alternative-1175 9789403139005
1176 exact-1176 9789463821902
1194 alternative-1194 9789025306601
1197 print-1197 9789041716712
1199 exact-1199 9789038855240
1206 exact-1206 9789038803630
1207 exact-1207 9789049804916
1208 alternative-1208 9789025311650
1209 alternative-1209 9789025367664
1254 exact-1254 9789045124001
82 exact-82 9789403166100
83 exact-83 9789048847389
84 exact-84 9789045048048
85 exact-85 9789044615623
86 alternative-86 9789044618099
87 alternative-87 9789025314675
89 exact-89 9789049801595
91 final-91 9789041714398
94 last-94 9789061007036
95 final-95 9789025731809
96 final-96 9789025883492
97 exact-97 9789492168269
98 alternative-98 9789021680354
99 alternative-99 9789056372125
101 alternative-101 9789024580606
103 exact-103 9789029589826
104 exact-104 9789026356605
106 alternative-106 9789021027432
109 exact-109 9789400507975
110 alternative-110 9789026169786
111 exact-111 9789026129612
112 exact-112 9789025755348
115 exact-115 9789041714879
116 alternative-116 9789083206776
122 exact-122 9789403855868
123 exact-123 9789024555857
124 exact-124 9789049212063
127 alternative-127 9789403859200
130 alternative-130 9789044817171
133 final-133 9789000374656
136 exact-136 9789463242141
142 exact-142 9789029088589
1531 exact-1531 9789045050713
1459 exact-1459 9789044646870
6111 exact-6111 9789021681825
1541 exact-1541 9789045131153
new-jebentprachtig exact-new-jebentprachtig 9789021053462
new-liftennaardehemel exact-new-liftennaardehemel 9789026374715
new-dezoetezusjeszijndebaas exact-new-dezoetezusjeszijndebaas 9789043933728
new-winterengel exact-new-winterengel 9789049204877
new-wurgcontract exact-new-wurgcontract 9789461099600
new-wondermond exact-new-wondermond 9789026351785
new-defransedochter exact-new-defransedochter 9789046833520
new-hetgeschenk exact-new-hetgeschenk 9789025318604
new-grondwerk exact-new-grondwerk 9789025475598
new-alsdedieren exact-new-alsdedieren 9789493320833
new-derodekoe exact-new-derodekoe 9789044545395
new-demensheidzalnogvanmijhoren exact-new-demensheidzalnogvanmijhoren 9789403180915
new-dius exact-new-dius 9789403133836
new-wachtenopnoah exact-new-wachtenopnoah 9789022342435
new-eenwintervolverrassingen exact-new-eenwintervolverrassingen 9789049211660
new-delamzak exact-new-delamzak 9789044662467
new-sluipmoord exact-new-sluipmoord 9789049206079
new-bankgeheim exact-new-bankgeheim 9789022343135
new-grotekleinewaarheid exact-new-grotekleinewaarheid 9789400520486
new-devrouwvanmijnechtgenoot exact-new-devrouwvanmijnechtgenoot 9789049211363
new-eentoekomstinmontmartre exact-new-eentoekomstinmontmartre 9789049211356
new-hetcruisecomplot exact-new-hetcruisecomplot 9789464106121
new-indepuree exact-new-indepuree 9789083624440
`.trim().split('\n').map(l=>l.trim().split(/\s+/u));
assert.equal(choices.length,87);
const holds={
 'new-deresten':{status:'identity_conflict',reason:'Exact Dutch print9789493547148 and Alex Berger5 identity are verified. Bureau and cover credit Toni Coppers; multiple distributor records additionally credit Annick Lambert as author. The precise contributor role has not been independently resolved from a publisher colophon. Do not silently discard an author or invent a combined person record. Keep original reviewed summary outside import pending contributor evidence.',urls:['https://www.standaardboekhandel.be/p/de-resten-9789493547148','https://books.apple.com/be/book/de-resten/id6818656323','https://www.vvma.be/toni-coppers/']},
108:{status:'identity_conflict',reason:'Global exact-ISBN check found proposed9789400509023 already on Work1439, by the same Mark Manson. Work108 is the English counterpart. No second edition with the same ISBN, no duplicate availability count and no automatic Work merge.',urls:['https://metadata.isbn.nl/1471029/de-edele-kunst-van-not-giving-a-f-ck.html']},
1056:{status:'identity_conflict',reason:'Current ISBN9789023476719 is a Dutch print, but Work1669 War and turpentine shares the same author and story with1056. Keep both records and all dependencies; no extra availability count or merge until canonical identity/usage is adjudicated.',urls:['https://metadata.isbn.nl/635654/oorlog-en-terpentijn.html']},
1256:{status:'insufficient_evidence_after_documented_research',reason:'KB and NBD confirm current9789047501190 as Dutch print, and a newer edition9789000397334 exists. Exact current ISBN page is withdrawn (vrij-isbn); a sufficiently verified exact current cover binding remains missing. Preserve existing edition. Not a no-Dutch-edition assertion.',urls:['https://www.bibliotheek.nl/catalogus/titel.444255729.html/oorlogsgeheimen/','https://www.nbdbiblion.nl/sites/nbdbiblion.nl/files/vo_1304.pdf','https://www.zwijsen.nl/product/oorlogsgeheimen-9789000397334/']},
88:{status:'insufficient_evidence_after_documented_research',reason:'Dutch print9789046700051 is confirmed by Rozet and university bibliography. Named Bureau ISBN checks did not supply an exact edition cover; public identity proof alone is not a cover or content review. Keep researched evidence for a later bounded proposal.',urls:['https://rozet.nl/catalogus/691057/','https://staff.fnwi.uva.nl/f.a.bais/documents/Boeken%20natuurwetenschappen.pdf','https://www.deslegte.com/de-zelfzuchtige-genen-330517/']},
92:{status:'insufficient_evidence_after_documented_research',reason:'Named Dutch checks returned Cooked and In Defense of Food, different Pollan Works. Author original excerpt and Dutch interview confirm the identity, but no reliable exact Dutch standalone print ISBN was established. The2013 untranslated statement does not prove absence in2026.',urls:['https://michaelpollan.com/wp-content/uploads/2010/05/omnivore_excerpt.pdf','https://tegenlicht.vpro.nl/artikelen/michael-pollan']},
118:{status:'identity_conflict',reason:'Dutch Onder moeders vleugels prints were found, but the page groups first-part and combined Little Women identities. Full scope of current English edition9781684900602 versus the proposed translated volume remains unresolved. No bundle/part reassignment or merge.',urls:['https://metadata.isbn.nl/980533/onder-moeders-vleugels.html']},
119:{status:'identity_conflict',reason:'Work41 Oorlog en vrede and119 War and Peace have the same author identity under transliteration variants. Exact Dutch printed editions exist, but adding one on a second unresolved Work would inflate coverage. Preserve both and dependencies; no merge.',urls:['https://metadata.isbn.nl/220888/oorlog-en-vrede.html']},
120:{status:'identity_conflict',reason:'Work61 and120 are the same John le Carré title. No Dutch edition on an unadjudicated duplicate merely to increase counts; identity and dependencies must be resolved in a separate proposal.',urls:[]},
129:{status:'insufficient_evidence_after_documented_research',reason:'Drakevlucht ISBN902251241X /9789027467027 is a real Dutch translation candidate; bibliographic and secondhand checks distinguish it from the Dragonquest omnibus. Exact independent printed-edition/cover corroboration is incomplete. Do not claim no Dutch translation.',urls:['https://deboekenplank.nl/naslag/aut/m/mccaffrey_a.htm']},
140:{status:'insufficient_evidence_after_documented_research',reason:'KB confirms Dutch De ontheemde ISBN9027416818 and9027458634, translated by Annemarie Kindt from The Dispossessed. Exact verified cover for a suitable edition was not established by named Bureau searches. Retain approved English description; no random alternate cover.',urls:['https://www.bibliotheek.nl/catalogus/titel.851052452.html/de-ontheemde/']},
'new-deverborgenbelofte':{status:'identity_conflict',reason:'The Hidden Girl is a revised version of a Lucinda Edmonds/Riley predecessor, revised with Harry Whittaker. Exact Dutch print9789401622394 exists, but predecessor/revision identity must be adjudicated before a new Work. No duplicate created.',urls:['https://lucindariley.co.uk/the-hidden-girl-2/']},
'new-deheks':{status:'insufficient_evidence_after_documented_research',reason:'Bureau lists6Oct2026, but the official publisher lists5Nov2026 for Dutch print9789032521721. At1Nov2026 availability is not safely established. Keep future-edition proposal outside this import.',urls:['https://www.lsuitgeverij.nl/boek/de-heks-paperback/']}
};
const independent={
1009:[['https://www.bibliotheek.nl/catalogus/titel.357539168.html/het-stenen-bruidsbed/','Exact9789023476825 Dutch printed book; publisher ordinary paperback, Bureau label Diversen is incomplete format metadata.'],['https://www.bruna.nl/boeken/het-stenen-bruidsbed-9789023476825','Exact paperback/Nederlands; print dimensions confirm format.']],
1023:[['https://metadata.isbn.nl/160557/de-verwondering.html','Choose NUR301 novel9789403103600, not NUR307 Bart Meuleman theatrical adaptation9789075175455.']],
1068:[['https://uitgeverijprometheus.nl/boeken/wetten-gebonden/','Exact9789044645774 ordinary Dutch hardcover.']],
1142:[['https://annawoltz.nl/over-mij/','Anna Woltz De tunnel2021; A.B.Yehoshua same-title result rejected.']],
1175:[['https://www.bibliotheek.nl/catalogus/titel.418878455.html/de-bourgondie-rs/','Bart Van Loo history; Wouter van Friesland same-title result rejected.'],['https://www.flandersliterature.be/books-and-authors/book/the-burgundians','Original Dutch2019; rights listing reports452000copies without a single-country period. Not a universal popularity score.']],
1199:[['https://www.dbnl.org/tekst/zuid004krit01_01/kll00410.php','Individual Japi story distinguished from later collected volumes.']],
1208:[['https://www.singeluitgeverijen.nl/athenaeum/boek/kaas-2/','Elsschot novel with Frans Laarmans; unrelated Marion de Graaff cheese nonfiction rejected.']],
1209:[['https://www.singeluitgeverijen.nl/athenaeum/boek/dwaallicht/','Original novella and Laarmans search; selected edition includes contextual commentary, not a different-story omnibus.']],
86:[['https://uitgeverijprometheus.nl/boeken/heelal-paperback-2/','Het heelal9789044618099 is A Brief History of Time; not A Briefer History or children’s George series.']],
87:[['https://www.singeluitgeverijen.nl/athenaeum/boek/verstild-voorjaar/','Carson Silent Spring,2022 Nico Groen translation; older Dutch title Dode lente.']],
91:[['https://www.overamsteluitgevers.com/boek/866/jeanette-walls-het-glazen-kasteel.html','Exact individual memoir9789044356632, not combined Ontembare paarden omnibus.']],
94:[['https://www.bibliotheek.nl/catalogus/titel.444200568.html/de-kleine-prins/','Exact ordinary print9789061007036 translates Le petit prince. Aggregate Bureau narrative is West-Frisian9789491536618; not used as Dutch text/language proof.']],
95:[['https://www.bibliotheek.nl/catalogus/titel.437585557.html/alice-in-wonderland/','Exact9789025731809 translation Sofia Engelsman,original1865. Reject BabyLit, Disney, Giada Francia and Geronimo adaptations; do not import Through the Looking-Glass as part of this Work.']],
96:[['https://www.bibliotheek.nl/catalogus/titel.438085841.html/de-geheime-tuin/','Original Secret Garden translated by Imme Dros; not Margaretha van Andel retelling. Publisher marketing says hervertelling; KB identifies original complete translation.']],
98:[['https://www.zwijsen.nl/product/de-wind-in-de-wilgen-9789021680354/','Original Grahame208-page hardcover9789021680354, not Lou Peacock shortened version on same aggregate.']],
99:[['https://lemniscaat.nl/boeken/charlottes-web','E.B.White original; Jennifer Frantz movie adaptation Work4291 separate.'],['https://rozet.nl/catalogus/2209102/','Exact Dutch print, Tjalling Bos translation.']],
110:[['https://www.uitgeverijdefontein.nl/boek/matilda-hardback/','Exact9789026169786 complete Dutch hardcover, not current English graded reader.']],
112:[['https://www.bibliotheek.nl/catalogus/titel.452595916.html/rupsje-nooitgenoeg/','Exact9789025755348 original The Very Hungry Caterpillar, not shortened cloth/buggy/feel formats in aggregate.']],
130:[['https://www.boekenzoeker.be/de-bijzondere-kinderen-van-mevrouw-peregrine','Exact9789044817171, Clavis2012,first Jacob/Peregrine novel. Bureau aggregate corrupt Kick/Luc Deflo header/narrative rejected; exact ISBN block and independent bibliography control binding.'],['https://opac.kbr.be/Library/digitalCollection/DigitalCollectionAttachmentDownloadHandler.ashx?documentId=19301732&parentDocumentId=19301731&skipWatermark=true','KBR bibliographic confirmation of9789044817171.']],
136:[['https://litlab.nl/wp-content/uploads/sites/273/2025/07/2025_BEC_9001062569_DR-JEKYLL-AND-MR-HYDE.pdf','Original story identity and Utterson/Jekyll/Hyde premise; selected Dyslexion typography is not a shortened graded reader.']],
'new-jebentprachtig':[['https://www.randomhousebooks.com/wp-content/uploads/2023/03/Hello-Beautiful_Ann-Napolitano_Book-Club-Kit.pdf','Hello Beautiful William/Padavano family, not existing Dear Edward. Select Dutch Luitingh ISBN, not English-labelled Rainbow variant.']],
'new-winterengel':[['https://www.heinen.nl/BookApi/GetSample?guid=90d375a5-f5e8-45a2-a7f9-5d206222ac3e','Publisher-supplied colophon9789049204877 explicitly Dutch translation Cora Kool ©2024 Meulenhoff Boekerij. Overrides conflicting German Bureau field for this exact Dutch print.']],
'new-wurgcontract':[['https://crimecompagnie.nl/boeken/wurgcontract/','Exact9789461099600 Dutch paperback and original plot source. Existing authors662/847 not merged; canonical existing author662 chosen explicitly.']],
'new-defransedochter':[['https://belgica.kbr.be/belgica/digitalCollection/DigitalCollectionAttachmentDownloadHandler.ashx?documentId=22419048&parentDocumentId=22419047&skipCopyright=true&skipWatermark=true','KBR exact9789046833520 Dutch translation Erica Disco, Oceaan2025; overrides English Bureau field.'],['https://bookouture.com/wp-content/uploads/Full-Rights-Guide-FBF-2024-s.pdf','Original The Paris Daughter, Lost Daughters5, Blake/Evelina, not another daughter volume.']],
'new-alsdedieren':[['https://www.randkrant.be/artikels/auteur-lieselot-marien-schrijft-als-de-dieren-domweg-gelukkig-in-relegem','Author interview about new-mother experience and this novel; not just a bibliographic description.']],
'new-eenwintervolverrassingen':[['https://www.lannoo.com/nl-be/literatuur-romans/een-winter-vol-verrassingen-9789049211660','Publisher explicitly Dutch hardback9789049211660,29Sep2026,Erica Feberwee. Overrides English Bureau field.']],
'new-sluipmoord':[['https://libris.nl/dekker-vd-vegt/a/robert-bryndza/sluipmoord/501663224','Exact9789049206079 Dutch paperback29Sep2026,Willeke Lempens.'],['https://sdbh-cd.prod.sdbh.dlwnet.com/p/sluipmoord-9789049206079','Exact Dutch paperback and Jamie Day1987 standalone, not Erika Foster/Kate Marshall volume.']],
'new-grotekleinewaarheid':[['https://www.awbruna.nl/boek/romans/liane-moriarty/grote-kleine-waarheid/','Publisher exact9789400520486 translated Anna Livestro. Sequel to Big Little Lies, not existing Work604.'],['https://www.bruna.nl/boeken/grote-kleine-waarheid-9789400520486','Explicit exact-ISBN Dutch paperback; overrides English Bureau field.']],
'new-devrouwvanmijnechtgenoot':[['https://www.lannoo.com/nl-be/thrillers-spanning/de-vrouw-van-mijn-echtgenoot-9789049211363','Publisher exactISBN Dutch paperback,Jonas de Vries translation18Aug2026; overrides English Bureau field.']],
'new-eentoekomstinmontmartre':[['https://www.lannoo.com/nl-be/literatuur-romans/een-toekomst-montmartre-9789049211356','Publisher exactISBN Dutch paperback,Hans van Riemsdijk translation13Oct2026; overrides German Bureau field.'],['https://www.maritaspang.de/','Marie Lacrosse=Marita Spang=Tessa Duncan; Montmartre second volume Traum und Schicksal, not first volume.']]
};
const titleOverrides={94:'De kleine prins',1146:'De eeuw van mijn vader',130:'De bijzondere kinderen van mevrouw Peregrine',97:'Anne van het groene huis'};
// Resolve citations from captured source URLs, never from a guessed numeric Bureau identifier.
holds[1056].urls=[sources.find(s=>s.file==='exact-1056.json').url];
holds[108].urls=[sources.find(s=>s.file==='exact-108.json').url];
independent[1023][0][0]=sources.find(s=>s.file==='exact-1023.json').url;
const originalTitles={'new-jebentprachtig':'Hello Beautiful','new-defransedochter':'The Paris Daughter','new-grotekleinewaarheid':'Big Little Truths','new-eentoekomstinmontmartre':'Montmartre – Traum und Schicksal'};
const proposals=choices.map(([key,sn,isbn])=>{const r=frozen.rows.find(r=>r.candidateId===key);assert(r,key);const s=sources.find(s=>s.file===sn+'.json');assert(s?.status===200,sn);const e=s.editions.find(e=>e.facts.includes(isbn));assert(e?.covers.length,'No exact edition cover '+key);const own=independent[key]??[];assert(/taal Nederlands(?:$| )/u.test(e.facts)||own.length,'Explicit independent Dutch-language proof required '+key);let format=e.format==='Paperback'?'paperback':e.format==='Hardback'?'hardcover':key==='1009'?'paperback':null;assert(format,'No format inference '+key);const sum=summaries.find(x=>String(x.workId??x.candidateId)===key);assert(sum?.text,key);assert(sum.text.split(/\s+/u).length>=60&&sum.text.split(/\s+/u).length<=100);const ss=sum.source.startsWith('https:')?sum.source:sources.find(s=>s.file===sum.source+'.json')?.url;assert(ss,'Summary source '+key);return{candidateId:key,workId:r.workId??null,newWork:!r.workId,author:r.author,authorId:key==='new-wurgcontract'?662:r.work?.author_id??null,originalTitle:r.work?.title??originalTitles[key]??r.title,knownOriginalTitle:originalTitles[key]??(r.work?.title??null),workIdentity:{originalTitle:originalTitles[key]??r.work?.title??null,originalPublicationYear:null,verification:'Existing Work retained; for new candidates complete author corpora, global title/alias and ISBN collision checks still required.'},edition:{title:titleOverrides[key]??s.title,isbn13:isbn,language:'nld',format,publisher:e.facts.match(/imprint (.*?) uitgever/u)?.[1]??e.facts.match(/uitgever (.*?) taal/u)?.[1],coverUrl:e.covers[0],source:s.url,sourceSha256:s.sha256,sourceFacts:e.facts,sourceAuthors:s.authors},summary:{text:sum.text,source:ss,retained:false,reviewStatus:'content_reviewed_not_yet_approved_storage'},independentSources:own.map(([url,fact])=>({url,fact,checkedAt:'2026-11-01'})),checkedAt:s.checkedAt,status:'source_reviewed_cover_and_global_identity_checks_pending',tasteEligibility:'No traits or taste-test inventory added by catalogue inclusion.'};});
const current=read('production-current.json');for(const d of proposals){const prior=current.descriptions.find(x=>x.work_id===d.workId&&x.language==='nl'&&x.review_status==='approved');if(prior){d.summary={text:prior.text,source:prior.source_url,retained:true,reviewStatus:'existing_approved_retained'};d.retainedSummaryBefore=prior;}}
assert.equal(proposals.length,87);const remaining=frozen.rows.filter(r=>!proposals.some(d=>d.candidateId===r.candidateId));assert.equal(remaining.length,13);assert.equal(Object.keys(holds).length,13);
assert(remaining.every(r=>holds[r.candidateId]),'Every investigated hold needs a concrete reason.');
save('source-reviewed-proposals.json',{state:'Not a release approval; no hosted writes performed.',dossiers:proposals});save('researched-holds.json',holds);
save('cover-review-manifest.json',proposals.map(d=>({key:d.candidateId,isbn:d.edition.isbn13,url:d.edition.coverUrl,source:d.edition.source,title:d.edition.title,author:d.author})));
console.log(JSON.stringify({proposals:proposals.length,existing:proposals.filter(d=>!d.newWork).length,newCandidates:proposals.filter(d=>d.newWork).length,holds:Object.keys(holds).length}));
