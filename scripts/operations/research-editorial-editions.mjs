// Read-only public bibliographic research. Does not connect to a database.
import {readFile,writeFile} from 'node:fs/promises';
const root=new URL('../../',import.meta.url);
const baseline=JSON.parse(await readFile(new URL('catalog/editorial-parity-20261021/production-public-baseline.json',root),'utf8'));
const keys=baseline.rows.flatMap(work=>work.editions.map(edition=>'/books/'+edition.open_library_edition_id)).filter(key=>!key.endsWith('null'));
async function read(url){
  const start=Date.now();
  try{
    const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(18000)});
    const data=response.ok?await response.json():null;
    return {url:String(url),status:response.status,ms:Date.now()-start,data};
  }catch(error){return {url:String(url),status:null,ms:Date.now()-start,error:error.message};}
}
const url=new URL('https://openlibrary.org/api/get_many');url.searchParams.set('keys',JSON.stringify(keys));
const [editions,oryx,giver]=await Promise.all([read(url),read('https://openlibrary.org/works/OL675722W/editions.json?limit=50'),read('https://openlibrary.org/isbn/9780544336261.json')]);
const fields=['key','title','languages','works','isbn_13','isbn_10','covers','physical_format','publishers','publish_date'];
const minimal=edition=>Object.fromEntries(fields.filter(key=>edition[key]!==undefined).map(key=>[key,edition[key]]));
if(editions.data?.result) editions.data.result=Object.fromEntries(Object.entries(editions.data.result).map(([key,value])=>[key,minimal(value)]));
if(oryx.data?.entries) oryx.data={size:oryx.data.size,entries:oryx.data.entries.map(minimal)};
if(giver.data)giver.data=minimal(giver.data);
const result={checkedAt:new Date().toISOString(),editions,oryx,giver};
await writeFile(new URL('catalog/editorial-parity-20261021/source-research.json',root),JSON.stringify(result,null,2));
console.log(JSON.stringify({editionStatus:editions.status,exactEditions:keys.length,returned:Object.keys(editions.data?.result??{}).length,oryxStatus:oryx.status,oryxCandidates:oryx.data?.entries?.length??0}));
