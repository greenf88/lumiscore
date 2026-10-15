// Synthetic loopback review only. Never imported by the production application.
import {buildRatingResultProfile} from '../../lib/taste-test/rating-result.ts';
import {buildEffectiveWorkTraitVector,evidenceRowsForTraits} from '../../lib/recommendations/work-trait-evidence.ts';
import type {Book} from '../../app/data/books.ts';
export const books:Book[]=Array.from({length:20},(_,i)=>({id:`profile-review-${i}`,workId:String(990001+i),source:'demo',title:i===3?'De uitzonderlijk lange geschiedenis van een huis tussen de sterren':'Een nieuwe horizon '+(i+1),author:'Synthetische Auteur',firstPublishYear:2000+i,cover:'orbit',coverUrls:['/profile-review-cover.svg'],score:9-i/10,ratingBand:'3–4',ratingsCount:null,match:null}));
export const categories=[];
const evidenceFor=(id:string)=>evidenceRowsForTraits({workId:id,traits:{thriller_mystery:1,dark:.8,fast_paced:.7},confidence:1,source:'manual',sourceKey:'profile-local-review',rawLabels:[],verifiedAt:'2026-10-15'});
export function fixtureUser(mode:string){return mode==='guest'?null:{id:mode==='b'?'synthetic-reader-b':'synthetic-reader-a',email:mode==='b'?'reader-b@example.invalid':mode==='long'?'synthetic-reader-with-a-long-private-address@long-mailbox.example.invalid':'reader-a@example.invalid',user_metadata:{display_name:mode==='b'?'Lokale lezer B':mode==='long'?'Synthetische lezer met een lange naam':'Lokale lezer A'}};}
export function fixtureClient(mode:string){
 const count=mode==='empty'?0:mode==='many'?1505:mode==='b'?1:10;
 const ratings=Array.from({length:count},(_,i)=>({work_id:990001+i,rating:8}));
 const statuses=[...ratings.map(r=>({work_id:r.work_id,status:'read'})),...Array.from({length:mode==='empty'||mode==='b'?0:14},(_,i)=>({work_id:1000000+i,status:'read'})),...Array.from({length:mode==='empty'||mode==='b'?0:18},(_,i)=>({work_id:1000100+i,status:'want_to_read'})),...Array.from({length:mode==='empty'||mode==='b'?0:3},(_,i)=>({work_id:1000200+i,status:'reading'}))];
 const evidence=ratings.flatMap(r=>evidenceFor(String(r.work_id)).map(e=>({work_id:Number(e.workId),trait:e.trait,weight:e.weight,confidence:e.confidence,source:e.source,source_key:e.sourceKey,raw_labels:e.rawLabels,mapping_version:e.mappingVersion,verified_at:e.verifiedAt})));
 return {from(table:string){let owner='',ids:number[]|null=null,range=[0,999];
  const q={select(){return q;},eq(key:string,value:string){if(key==='user_id')owner=value;return q;},order(){return q;},in(_key:string,value:number[]){ids=value;return q;},range(lo:number,hi:number){range=[lo,hi];return q;},async then(resolve:(x:unknown)=>unknown){
   if(mode==='error')return resolve({data:null,error:new Error('SYNTHETIC_READ_FAILURE')});
   const rows=table==='work_trait_evidence'?evidence.filter(e=>ids?.includes(e.work_id)):owner===fixtureUser(mode)?.id?(table==='ratings'?ratings:statuses):[];
   return resolve({data:rows.slice(range[0],range[1]+1),error:null});
  }};return q;}};
}
export function profileResult(){const evidence=new Map(books.slice(0,10).map(b=>[b.workId!,buildEffectiveWorkTraitVector(evidenceFor(b.workId!))]));return {kind:'result',profile:buildRatingResultProfile(books.slice(0,10).map(b=>({workId:b.workId!,rating:8})),evidence),roundRatedCount:10,language:'nl',partial:false,exhausted:false,recommendations:[]};}
export async function loadHighestRatedCatalog(){return {books:books.slice(0,8),total:20};}
export async function loadCatalogBooksByIds(ids:string[]){return books.filter(b=>ids.includes(b.workId!));}
export const loadCatalogBooksByIdsWithStoredCovers=loadCatalogBooksByIds;
export async function loadCatalogBook(id:string){return books.find(b=>b.workId===id)??null;}
