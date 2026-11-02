// Actual checksummed provider index names are 0006750000-L.jpg, not original-image names.
export function parseLargeCoverIndex(source){
 const rows=source.trimEnd().split('\n').map(line=>{const m=/^(\d{1,10})-L\.jpg\t(\d+)\t(\d+)\r?$/.exec(line);if(!m)throw Error('Unknown large-cover index format');const [coverId,offset,length]=m.slice(1).map(Number);if(![coverId,offset,length].every(Number.isSafeInteger)||offset<0||offset%512)throw Error('Invalid large-cover index integer/alignment');return{name:m[1]+'-L.jpg',coverId,offset,length};});
 if(!rows.length||rows.length>20000||new Set(rows.map(x=>x.coverId)).size!==rows.length)throw Error('Unbounded or duplicate large-cover index');return rows;
}
