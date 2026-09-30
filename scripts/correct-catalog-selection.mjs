// CSV authoring uses the bundled spreadsheet runtime; importer has no artifact dependency.
import fs from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import { categoryCorrections,years,uncertainYears,yearNotes,hold,extraGenres,sources,formCorrections } from '../catalog/selection-v1/review-decisions.mjs';
import model from '../lib/catalog/categories.json' with { type:'json' };
import { csv,validIsbn,assertSelection,digest } from './catalog-selection-core.mjs';
const runtime=process.env.ARTIFACT_NODE_MODULES;
if(!runtime)throw new Error('Set ARTIFACT_NODE_MODULES to the bundled dependency node_modules path');
const {Workbook}=createRequire(path.join(runtime,'__entry.cjs'))('@oai/artifact-tool');
const dir=new URL('../catalog/selection-v1/',import.meta.url);
const text=await fs.readFile(new URL('lumiscore-catalogusselectie-v1.original.csv',dir),'utf8');
const wb=await Workbook.fromCSV(text,{sheetName:'Selectie'});
const sheet=wb.worksheets.getItemAt(0);
const matrix=sheet.getRange('A1:T1001').values;
const headers=matrix[0].map(h=>String(h).replace(/^\uFEFF/,''));matrix[0]=headers;
const baseCategories={'Biografie & memoires':'biography','Economie & persoonlijke ontwikkeling':'economics','Fantasy':'fantasy','Filosofie & psychologie':'psychology','Geschiedenis & maatschappij':'history','Historische fictie':'historical','Horror':'horror','Kunst, cultuur & reizen':'travel','Literaire fictie':'literary','Misdaad & thriller':'thriller','Romantiek':'romance','Sciencefiction':'sf','Wetenschap & natuur':'science'};
const overrides=new Map();for(const [key,ids]of Object.entries(categoryCorrections))for(const id of ids.split(' ').map(Number)){if(overrides.has(id))throw new Error('Double category decision '+id);overrides.set(id,key);}
const changes=[],records=[];
for(let n=1;n<=1000;n++){
  const original=Object.fromEntries(headers.map((h,i)=>[h,String(matrix[n][i]??'')]));
  const row={...original},id=row['kandidaat-ID'];
  const cat=model.aliases[n===125?'literary':overrides.get(n)??baseCategories[row['hoofdcategorie NL']]];
  const label=model.categories.find(c=>c.id===cat);if(!label)throw new Error('Missing category '+id);
  const notes=[];const change=(field,value,reason)=>{value=String(value??'');if(row[field]!==value){changes.push([id,field,row[field],value,reason]);row[field]=value;notes.push(reason);}};
  change('hoofdcategorie NL',label.nl,overrides.has(n)?'Inhoudelijke AI-herbeoordeling van dit werk; geen auteur-/titelwoordregel.':'Canoniek categoriemodel en stabiele NL/EN-labels.');
  change('hoofdcategorie EN',label.en,'NL/EN verwijzen naar dezelfde categorie-ID.');
  if(formCorrections[n])change('werkvorm',formCorrections[n],'Werkvorm afzonderlijk inhoudelijk gecorrigeerd; geen genre.');
  if(n===557)change('doelgroep','volwassenen','Peer Gynt is geen oorspronkelijk als YA geschreven toneelstuk.');
  if(Object.hasOwn(years,n))change('oorspronkelijke publicatiejaar',years[n],yearNotes[n]??'AI-bibliografische correctie: oorspronkelijke publicatie in plaats van onjuist bron-/editiejaar; geen wijziging bestaand databasejaar.');
  if(uncertainYears.includes(n))change('oorspronkelijke publicatiejaar','','Exact oorspronkelijk publicatiejaar onvoldoende vastgesteld; niet afleiden van editie/ontstaan.');
  const isbns=[...row['beschikbare ISBN- of Work-identifiers'].matchAll(/ISBN-(?:13|10):\s*([\dX-]+)/g)].map(m=>m[1]);
  for(const isbn of isbns.filter(i=>!validIsbn(i)))change('beschikbare ISBN- of Work-identifiers',row['beschikbare ISBN- of Work-identifiers'].replace(new RegExp(';?\\s*ISBN-(?:13|10):\\s*'+isbn),'').trim(),'Ongeldige ISBN-checksum verwijderd; oorspronkelijke waarde: '+isbn);
  if(hold[n])change('classificatiestatus','TWIJFEL',hold[n]);
  // Facts and AI interpretation remain distinguishable even with an external source.
  change('classificatiebasis',sources[n]?'AI_KENNIS + GERICHTE_BRONCONTROLE':'AI_KENNIS_HERBEOORDEELD','Redactionele AI-indeling; geen HIGH-evidence of menselijke beoordeling.');
  const categories=[...new Set([cat,...(extraGenres[n]??[]).map(k=>model.aliases[k])])];
  change('aanvullende genres',categories.slice(1).map(id=>model.categories.find(c=>c.id===id).nl).join('; '),'Aanvullende genres opnieuw inhoudelijk afgewogen; uitsluitend canonieke genres, doelgroep en werkvorm blijven afzonderlijk.');
  if(n===514) {
    change('bestaande LumiScore Work-ID','1936','Vertaling gematcht op bestaand Work 1936; geen nieuwe Work.');
    change('catalogusmatch','aanwezig','Bibliotheek bevestigt Nederlandse vertaling; origineel en vertaling zijn hetzelfde werk.');
  }
  if(yearNotes[n])notes.push(yearNotes[n]);
  if(sources[n]){row['bron-URL’s']+=' | '+sources[n][0];notes.push(sources[n][1]);}
  if(original['korte twijfel- of correctienotitie'])notes.unshift('Oorspronkelijke notitie (niet overgenomen als regel): '+original['korte twijfel- of correctienotitie']);
  row['korte twijfel- of correctienotitie']=[...new Set(notes)].join(' ');
  matrix[n]=headers.map(h=>row[h]);
  records.push({candidate_id:id,title:row.titel,author:row.auteur,year:row['oorspronkelijke publicatiejaar']?Number(row['oorspronkelijke publicatiejaar']):null,
    year_basis:sources[n]&&[105,340,395,502,523,539,558,616,1000].includes(n)?'EXTERNAL_CHECK':uncertainYears.includes(n)?'UNRESOLVED':'AI_BIBLIOGRAPHIC_REVIEW',
    categories,audience:row.doelgroep,form:row.werkvorm,status:row.classificatiestatus,classifier:'AI_EDITORIAL',
    basis:row.classificatiebasis,source_urls:row['bron-URL’s'].split(' | '),source_checked:sources[n]??null,reviewed_at:'2026-09-30',
    existing_work_id:Number(row['bestaande LumiScore Work-ID'])||null,open_library_id:row['beschikbare ISBN- of Work-identifiers'].match(/OL\d+W/)?.[0]??null,
    isbns:isbns.filter(validIsbn),hold:hold[n]??null,notes:row['korte twijfel- of correctienotitie']});
}
assertSelection(records);sheet.getRange('A1:T1001').values=matrix;wb.recalculate();
const saved=sheet.getRange('A1:T1001').values;
if(saved.length!==1001||saved.some(r=>r.length!==20))throw new Error('Output shape changed');
await fs.writeFile(new URL('lumiscore-catalogusselectie-v1.corrected.csv',dir),csv(saved));
await fs.writeFile(new URL('changes.csv',dir),csv([['kandidaat-ID','veld','oud','nieuw','reden'],...changes]));
await fs.writeFile(new URL('reviewed-records.json',dir),JSON.stringify(records,null,2)+'\n');
console.log(JSON.stringify({reviewed:records.length,fieldChanges:changes.length,hold:records.filter(r=>r.hold).length,hash:digest(records)}));
