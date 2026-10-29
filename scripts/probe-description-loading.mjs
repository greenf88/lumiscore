// Bounded public read-only diagnostics. Never prints source copy or credentials.
const rows = [{id:148,edition:'OL7292690M',isbn:'9780064471107'}, {id:228,edition:'OL7521619M',isbn:'9780440418566'}, {id:553,edition:'OL46530123M',isbn:'9781837901326'}];
async function probe(url,kind) {
  const start=performance.now();
  try {
    const response=await fetch(url,{signal:AbortSignal.timeout(15000),headers:{Accept:kind==='page'?'text/html':'application/json'}});
    const text=await response.text();
    const base={url,status:response.status,milliseconds:Math.round(performance.now()-start),bytes:Buffer.byteLength(text)};
    if(kind==='page') return {...base,temporaryFailure:/The description could not load right now|De beschrijving kon tijdelijk niet worden geladen/.test(text),confirmedMissing:/verified English description is not available|geverifieerde (?:Engelse|Nederlandse) beschrijving/.test(text),sourceLinks:[...new Set([...text.matchAll(/https:\/\/(?:openlibrary\.org\/(?:books|works)\/OL\d+[MW]|books\.google\.com\/books\?vid=ISBN\d+)/g)].map(m=>m[0]))]};
    let data;try{data=JSON.parse(text)}catch{return {...base,json:false}}
    if(kind==='edition') return {...base,language:data.languages,works:data.works,hasDescription:!!data.description};
    return {...base,providerError:data.error?{code:data.error.code,status:data.error.status,reasons:data.error.errors?.map(e=>e.reason)}:null,items:data.items?.map(i=>({id:i.id,language:i.volumeInfo?.language,isbn:i.volumeInfo?.industryIdentifiers,hasDescription:!!i.volumeInfo?.description}))??[]};
  }catch(error){return {url,milliseconds:Math.round(performance.now()-start),error:error.name}}
}
const mode=process.argv[2]??'pages';
if(mode==='pages')for(const row of rows)for(const locale of ['nl','en'])console.log(JSON.stringify(await probe(`https://lumisco.re/${locale}/book/${row.id}`,'page')));
if(mode==='sources')for(const row of rows){console.log(JSON.stringify(await probe(`https://openlibrary.org/books/${row.edition}.json`,'edition')));console.log(JSON.stringify(await probe(`https://www.googleapis.com/books/v1/volumes?q=isbn:${row.isbn}&maxResults=5&projection=full`,'google')));}
