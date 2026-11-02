// Explicit individual decisions following source-text, KB, identity and cover reading.
// No automated approval or external write. Holds elsewhere are not cleared.
import fs from'node:fs';import{ROOT}from'./nl-scale-snapshot.mjs';
const entries=[
[387,334,'Candide ou L’optimisme1759, exact Dutch hardcover. KB explicitly explains shortened front title Candide.'],
[396,177,'Kafka’s Der Prozess novel, exact Dutch hardcover. Do not infer original publication from the later KB cited1935printing; no year change proposed.'],
[398,324,'Austen’s complete novel Emma, C.W.Polderman-deVries translation, Spectrum hardcover. No film retelling or new Work.'],
[400,331,'Exact Dutch play TheTempest. GerritKomrij is translator, Shakespeare remains primary author.'],
[403,433,'Exact Dutch play TheMerchantofVenice. GerritKomrij is translator, no contributor-based duplicate Work.'],
[482,1193,'Couperus ElineVere: same novel, distinct1888serial/1889book dates retained without new year correction. Hardback is an explicit print synonym.'],
[484,1201,'Same DeHaan novel Pijpelijntjes, no names dependent on1904version in summary. No assertion that historical textual revisions are identical.'],
[493,1464,'Same WatershipDown novel by RichardGeorgeAdams. Duplicate source-author names are not separate coauthors or a reason to merge catalogue authors. Existing Work and primary author retained.'],
[502,1400,'Plato’s Politeia dialogue, exact Dutch hardcover9789025315313. Philosophy stays outside automatic taste-test approval.'],
[526,3332,'Exact Dutch translation of Schlink’s DerVorleser1995, not a movie edition or unrelated reader anthology.'],
[533,1824,'Kafka’s unfinished DasSchloss novel. Querido hardback is explicit print; summary explicitly retains unfinished status.'],
[552,1408,'Exact Dutch KingLear play in Komrij translation. Source spoiler ending excluded from original short text.'],
[561,2409,'Dawkins science non-fiction TheGreatestShowonEarth2009; exact NieuwAmsterdam paperback. No automatic taste traits or claims of measured popularity.'],
[604,1376,'Huysmans Àrebours1884, not the1903edition date cited by one record. Existing Work retained; hardback explicit print.'],
[676,1483,'Hardy MayorofCasterbridge. KB explicitly binds long bibliographic title to shortened front title; one novel, no duplicate Work.'],
[698,1468,'Flaubert Salammbô, exact Athenaeum hardcover. No year mutation based on later source1863printing.'],
[716,4964,'VargasLlosa Pantaleónylasvisitadoras1973. Choose only the exact existing edition with visually read front, not both source editions.'],
[742,5055,'VargasLlosa Elhablador1987. One Dutch paperback and original source identity, retain Work5055.'],
[769,3535,'Walliams children’s novel, Clavis hardcover. Current content summary does not claim source2020citation as first original year.'],
[831,3179,'ThomasMann LotteinWeimar1939 novel about Goethe; not a book authored by Goethe or a documentary biography.'],
[833,3202,'IrisMurdoch TheItalianGirl1964, exact Querido/Salamander paperback. No new identity from full-name authorityJeanIrisMurdoch.'],
[854,5073,'Hermans1993fictional wartime diary/Boekenweek novella. Same ISBN appears on two source-edition keys: reuse exact current record and bound front, never add another edition.'],
[893,6012,'ChristianKracht1979 is the novel title; original publication2001 remains separate. Exact Dutch hardcover.'],
[920,6185,'UlrichKarger picturebook GeisterstundeimKindergarten2002, UliWaas illustration. Reuse exact current edition despite duplicate source keys; no added author or Work.']
].map(([caseNumber,workId,reason])=>({caseNumber,workId,reason}));
const dir=new URL('subbatches/010/',ROOT);fs.mkdirSync(dir,{recursive:true});
fs.writeFileSync(new URL('source-reading-24.json',dir),JSON.stringify({reviewedAt:'2026-11-02T19:34:00.000Z',scope:'24 source/identity readings. Current-row comparison separates reuse, missing ISBN, new edition and unresolved exact-cover/scope cases. Not24import approvals.',entries},null,2)+'\n');
const reuseIds=new Set([1464,3332,2409,5055,3535,3179,3202,5073,6012,6185]);
const reuse=entries.filter(x=>reuseIds.has(x.workId)).map(x=>({...x,...(x.workId===5073?{editionKey:'/books/OL24328241M'}:x.workId===6185?{editionKey:'/books/OL24228364M'}:{})}));
fs.writeFileSync(new URL('reviewed-input.json',dir),JSON.stringify({reviewedAt:'2026-11-02T19:34:00.000Z',scope:'10 existing Dutch edition presentation repairs. Other14source readings not silently imported.',entries:reuse},null,2)+'\n');
const ids=reuse.map(x=>x.workId).join(',');
const q=`with chosen as(select * from public.works where id in(${ids})) select jsonb_build_object('checked_at',clock_timestamp(),'project','qvplwejffhjvxaypmjut','works',(select jsonb_agg(to_jsonb(t) order by id) from chosen t),'authors',(select jsonb_agg(to_jsonb(t) order by id) from public.authors t where id in(select author_id from chosen)),'editions',(select jsonb_agg(to_jsonb(t) order by id) from public.editions t where work_id in(select id from chosen)),'descriptions',(select coalesce(jsonb_agg(to_jsonb(t) order by work_id,language),'[]') from public.catalog_work_descriptions t where work_id in(select id from chosen)),'metadata',(select coalesce(jsonb_agg(to_jsonb(t) order by edition_id),'[]') from public.catalog_edition_metadata t where work_id in(select id from chosen))) as preflight;`;
fs.writeFileSync(new URL('production-preflight.sql',dir),q+'\n');console.log({prepared:entries.length,readOnlySql:true});
