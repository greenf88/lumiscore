import fs from 'node:fs';
import {createHash} from 'node:crypto';
const root=new URL('../outputs/popular-three-20261105/',import.meta.url);fs.mkdirSync(root,{recursive:true});
const urls={
 'hof-pb-current':'https://www.lannoo.com/sites/default/files/styles/product_gallery_media/public/onix_product/cover/16/9789000378401_20261103.jpg',
 'hof-pb-bibliographic':'https://metadata.isbn.nl/ie_fcache/0000797296_Hof_van_versplinterde_harmonieen_0_0.jpg',
 'hof-pb-small':'https://www.lannoo.com/sites/default/files/styles/product_gallery_media/public/onix_product/cover/16/9789000378401_20261022.jpg',
 'hof-hb-small':'https://www.lannoo.com/sites/default/files/styles/product_gallery_media/public/onix_product/cover/16/9789000408481_20261028.jpg',
 'co-front':'https://cdn.mavenpublishing.nl/books/cover_fronts/781/optimized/Mollick-Co-existentie-voorplat.jpg',
 'hof-paperback':'https://www.lannoo.com/nl-be/fantasy-sciencefiction/hof-van-versplinterde-harmonieen-9789000378401',
 'hof-hardcover':'https://www.lannoo.com/nl-be/fantasy-sciencefiction/hof-van-versplinterde-harmonieen-9789000408481',
 'co-existentie':'https://www.mavenpublishing.nl/boeken/co-existentie',
 'insane':'https://www.uitgeverijdefontein.nl/boek/insane/',
 'hof-original':'https://www.bloomsbury.com/us/court-of-splintered-harmony-9781639739134/',
 'co-isbn':'https://metadata.isbn.nl/2196168/co-existentie.html',
 'hof-isbn':'https://metadata.isbn.nl/2075711/hof-van-doorns-en-rozen-6.html',
 'changelog':'https://supabase.com/changelog.md',
 'hof-pb-cover':'https://www.lannoo.com/sites/default/files/onix_product/cover/16/9789000378401_20261022.jpg',
 'hof-hb-cover':'https://www.lannoo.com/sites/default/files/onix_product/cover/16/9789000408481_20261028.jpg',
 'co-cover':'https://cdn.mavenpublishing.nl/books/cover_fulls/781/optimized/Omslag_formaat_website-12.png',
 'insane-cover':'https://www.uitgeverijdefontein.nl/wp-content/uploads/2026/10/9789026186790_frontcover_original-320x504.jpg'
};
const results=[];for(const [key,url]of Object.entries(urls)){
 if(process.argv.includes('--pb-only')&&key!=='hof-pb-current')continue;
 if(process.argv.includes('--covers-only')&&!['hof-pb-small','hof-hb-small','co-front'].includes(key))continue;
 const started=Date.now();try{const r=await fetch(url,{signal:AbortSignal.timeout(25000)}),bytes=Buffer.from(await r.arrayBuffer()),type=r.headers.get('content-type')??'';const extension=type.includes('image/png')?'png':type.includes('image/')?'jpg':type.includes('markdown')?'md':'html';
 fs.writeFileSync(new URL(key+'.'+extension,root),bytes);results.push({key,url,finalUrl:r.url,status:r.status,contentType:type,bytes:bytes.length,elapsedMs:Date.now()-started,sha256:createHash('sha256').update(bytes).digest('hex'),at:new Date().toISOString(),file:key+'.'+extension});
 }catch(e){results.push({key,url,error:e.message,elapsedMs:Date.now()-started});}
}fs.writeFileSync(new URL(process.argv.includes('--pb-only')?'pb-transport.json':process.argv.includes('--covers-only')?'cover-transport.json':'transport.json',root),JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results));
