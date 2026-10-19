import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import {calculateSeriesProgress,type CollectionBook} from './model.ts';
test('six linked Works retain progress when only four editions can be shown',()=>{
 const all=Array.from({length:6},(_,i)=>({workId:String(i+1),sequenceNumber:i+1,publicationOrder:i+1,subgroup:null,book:{id:'work-'+(i+1),workId:String(i+1),title:'Fixture',author:'Synthetic',cover:'orbit',score:null,ratingsCount:null,match:null}})) as CollectionBook[];
 const visible=all.filter(b=>!['2','5'].includes(b.workId));
 const status=new Map([['2','read'] as const]);const ratings=new Set(['5']);
 assert.equal(calculateSeriesProgress(visible,status,6,ratings).read,0);
 const actual=calculateSeriesProgress(all,status,6,ratings);
 assert.equal(actual.read,2);assert.equal(actual.cataloguedTotal,6);assert.equal(actual.total,6);assert.equal(actual.percentage,33);
});
test('server transmits full progress scope; client uses it without rendering unavailable books',async()=>{
 const server=await readFile(new URL('../supabase/collections.ts',import.meta.url),'utf8');
 const ui=await readFile(new URL('../../app/components/LumiScoreCollectionPage.tsx',import.meta.url),'utf8');
 assert.match(server,/progressBooks,\s*authenticated:/);
 assert.match(ui,/const progressBooks = data.progressBooks \?\? books/);
 assert.match(ui,/calculateSeriesProgress\(\s*progressBooks,/);
 assert.match(ui,/calculateCollectionProgress\(\s*progressBooks,/);
 assert.match(ui,/books\.find\(\(\{ workId \}\) => workId === actionWorkId\)/);
 assert.match(ui,/collection-edition-availability/);
});
