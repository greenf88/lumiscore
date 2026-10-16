// Only the explicit loopback runner imports this module. No real user/data.
import type {Book} from '../../app/data/books';
import type {CollectionPageData} from '../../lib/supabase/collections';
export const books: Book[] = Array.from({length:5},(_,i)=>({
  id:`review-book-${i}`,workId:String(990100+i),source:'supabase',sourceType:'lumiscore_native',
  title:['Lokale testuitgave — al beoordeeld','Een winter aan zee','Een bijzonder lange boektitel die ook op een klein scherm volledig leesbaar moet blijven','Het laatste licht','Zomeravond'][i],
  author:'Suzanne Vermeer',firstPublishYear:2010+i,score:null,ratingsCount:null,ratingBand:null,match:null,cover:'orbit',coverUrls:['/collection-review-cover.svg'],
}));
const memory = globalThis as typeof globalThis & {__localCollectionReview?: {ratings: Map<string,Record<string,number>>; requests: string[]}};
const {ratings, requests} = memory.__localCollectionReview ??= {ratings: new Map<string,Record<string,number>>(), requests: [] as string[]};
export function userFor(mode:string){return mode==='guest'?null:mode==='b'?'synthetic-b':'synthetic-a';}
export function dataFor(mode='reader'):CollectionPageData {
  const user=userFor(mode);if(user&&!ratings.has(user))ratings.set(user,user==='synthetic-a'?{'990100':7}:{});
  const current=user?{...ratings.get(user)}:{};
  const members=mode==='empty'?[]:books;
  if(mode==='all'&&user)for(const book of books)current[book.workId!]=7;
  return {collection:{id:'local-suzanne',slug:'suzanne-vermeer',name:'Suzanne Vermeer',collectionType:'author_collection',description:'Uitsluitend lokale synthetische testgegevens.',expectedMainSeriesTotal:null},
    books:members.map((book,i)=>({book,workId:book.workId!,sequenceNumber:null,publicationOrder:i,subgroup:null})),
    authenticated:Boolean(user),userRatings:current,ratedWorkIds:Object.keys(current),statuses:Object.fromEntries(Object.keys(current).map(id=>[id,'read'])),
    progress:{read:Object.keys(current).length,total:members.length,cataloguedTotal:members.length,percentage:0},highlightedUnreadWorkId:null};
}
export async function save(mode:string,workId:string,score:number,onlyIfUnrated:boolean,expectedUserId:string){
  const user=userFor(mode);if(!user)return {status:401,body:{}};
  if(expectedUserId!==user)return {status:409,body:{}};
  if(!books.some(book=>book.workId===workId)||!Number.isInteger(score)||score<1||score>10)return {status:400,body:{}};
  requests.push(`${user}:${workId}`);
  if(mode==='slow')await new Promise(resolve=>setTimeout(resolve,1200));
  if(mode==='error')return {status:500,body:{error:'Synthetic save failure'}};
  dataFor(mode);const current=ratings.get(user)!;const created=!(workId in current);
  if(created||!onlyIfUnrated)current[workId]=score;
  if(mode==='ambiguous')return {status:500,body:{error:'Synthetic lost response after commit'}};
  return {status:200,body:{state:{authenticated:true,userRating:current[workId],created}}};
}
export function metrics(){return {syntheticOnly:true,requests:[...requests],ratings:Object.fromEntries(ratings)};}
