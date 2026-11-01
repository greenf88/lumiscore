// One content review of the exact sources whose first terminal excerpt was truncated.
import fs from'node:fs';const root='catalog/nl-research-005-20261101/';
const rows=[26,688,698,699,715,772].map(id=>({candidateId:String(id),name:'review-'+id,url:JSON.parse(fs.readFileSync(root+'sources/edition-'+id+'.json')).url}));
rows.push({candidateId:'512',name:'exact-512',url:'https://metadata.isbn.nl/1555814/heartstopper-deel-2.html'});
fs.writeFileSync(root+'requests-content-review.json',JSON.stringify(rows,null,2)+'\n');
