// Offline annotation after human visual review of both19-image contact sheets.
import fs from'node:fs';import{createHash}from'node:crypto';
const root=new URL('../catalog/nl100-hosted-20261031/',import.meta.url),base=new URL('../catalog/nl100-completion-20261031/',import.meta.url),read=n=>JSON.parse(fs.readFileSync(new URL(n,root)));
const dimensions=read('detail-variant-dimensions.json'),proofs=JSON.parse(fs.readFileSync(new URL('cover-proof.json',base)));
const reviewedIds=[1013,1155,1219,1286,1325,1326,1328,1332,1336,1337,135,1369,1382,1386,291,501,549,679,686];
if(dimensions.length!==19||reviewedIds.some(id=>!dimensions.some(d=>d.workId===id)))throw Error('Changed visual review scope');
const approved=[];
for(const d of dimensions){const v=read('detail-variants/'+d.workId+'.json'),original=proofs.find(p=>p.isbn===d.isbn),source=read('detail-covers/'+d.workId+'.json');
 if(!original||v.status!==200||v.bytes>=300000||d.width<600||d.height<900||!source.publishedVariants.some(p=>p.url===v.actualPublishedUrl)||Math.abs(d.width/d.height-original.dimensions.width/original.dimensions.height)>.002)throw Error('Unreviewable derivative identity/quality');
 if(createHash('sha256').update(fs.readFileSync(v.localQAFile)).digest('hex')!==v.sha256)throw Error('Changed visual QA file');
 const row={workId:d.workId,isbn:d.isbn,url:v.actualPublishedUrl,sha256:v.sha256,bytes:v.bytes,dimensions:{width:d.width,height:d.height},sourceUrl:v.sourceUrl,sourceSha256:v.sourceSha256,checkedAt:v.checkedAt,identity:'manual_title_author_plus_exact_isbn_bibliographic_binding',status:200,approvedForDetail:true,samePublishedAssetKey:true,visualFinding:'Decoded and visually inspected31Oct2026 on contact sheets1/2: same verified edition jacket/title/author, readable710px width, original aspect, no crop or arbitrary resize URL. Filename130 is NOT actual pixel height.',original:{url:original.url,bytes:original.bytes,sha256:original.sha256,dimensions:original.dimensions}};
 v.qualityReview='approved_same_edition_readable_detail_variant';v.dimensions=row.dimensions;fs.writeFileSync(new URL('detail-variants/'+d.workId+'.json',root),JSON.stringify(v,null,2)+'\n');approved.push(row);
}
fs.writeFileSync(new URL('detail-cover-selections.json',base),JSON.stringify({reviewedAt:'2026-10-31',source:'Actual published asset, decoded dimensions and visual review; never inferred from URL size hints',approved},null,2)+'\n');
console.log(JSON.stringify({approved:approved.length,remainingLarge:34-approved.length,minBytes:Math.min(...approved.map(p=>p.bytes)),maxBytes:Math.max(...approved.map(p=>p.bytes))}));
