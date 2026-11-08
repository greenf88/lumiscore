// Local preparation for the isolated TEST fixture, no DB connection here.
import{readFile,writeFile}from'node:fs/promises';import{descriptionBinding}from'../lib/books/description-snapshot.ts';
export const probeBook={id:'work-979999991',workId:'979999991',authorId:'735',editionId:'979999992',title:'TEST ONLY Metadata probe',editionTitle:'TEST ONLY Metadata probe',editionLanguage:'eng',strictEditionLanguage:'en',editionAvailable:true,openLibraryWorkId:'OL979999991W',openLibraryEditionId:'OL979999992M',isbn13:null};
if(process.argv[2]==='prepare'){
 const binding=descriptionBinding(probeBook,'en');if(!binding)throw Error('Invalid probe binding');
 let sql=await readFile('docs/public-metadata-20261108/test-probe.sql','utf8');
 sql=sql.replace("'eng','OL979999992M'","'en_US','OL979999992M'");
 // Only the external snapshot uses the real application binding; the revision
 // probe retains its separate synthetic page fingerprint.
 sql=sql.replace("'en',repeat('a',64),735",()=>"'en','"+binding+"',735");
 await writeFile('outputs/metadata-20261108/final-probe.sql',sql);
 await writeFile('outputs/metadata-20261108/probe-manifest.json',JSON.stringify({testProject:'hlvujbrmfdlrfxdjwsmb',book:probeBook,binding,synthetic:true,productionActions:0},null,2));
}
