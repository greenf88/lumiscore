const pages=[
['126','https://prhinternationalsales.com/book/?isbn=9780553582024'],
['1116','https://lemniscaat.nl/boeken/het-gulden-vlies-van-thule'],
['699','https://hachetteindia.com/Home/bookdetails/Info/9780349436340/king-of-pride'],
['688','https://www.indigo.ca/products/twisted-hate-special-edition'],
['772','https://bookshop.sg/products/king-of-wrath-1'],
['253','https://www.bloomsbury.com/au/court-of-silver-flames-9781526602312/'],
['178','https://books.google.je/books?id=K1qUPwAACAAJ&lr=&num=20&rview=1']
];const out=[];
for(let start=0;start<pages.length;start+=2)await Promise.all(pages.slice(start,start+2).map(async([workId,url])=>{
try{const r=await fetch(url,{signal:AbortSignal.timeout(15000)}),h=await r.text();
const clean=s=>s.replace(/&(?:amp;)?imgtk=[^" >]*/g,'');
const imgs=[...h.matchAll(/<img\b[^>]*>/gi)].map(m=>clean(m[0])).filter(m=>/cover|book|978|thule/i.test(m));
const metas=[...h.matchAll(/<meta\b[^>]*(?:og:image|og:title)[^>]*>/gi)].map(m=>clean(m[0]));
out.push({workId,url,status:r.status,finalUrl:r.url,metas,images:imgs.slice(0,15)});}catch(error){out.push({workId,url,error:String(error)});}
}));console.log(JSON.stringify(out,null,2));
