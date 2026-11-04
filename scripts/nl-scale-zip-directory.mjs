// PKWARE APPNOTE sections4.3.12–4.3.16. Strict bounded single-disk ZIP/ZIP64.
// Only parses source archives; no filesystem extraction or network of its own.
function u64(b,p) {
 if(p<0||p+8>b.length)throw Error('Truncated ZIP64 integer');
 const n=b.readBigUInt64LE(p);
 if(n>BigInt(Number.MAX_SAFE_INTEGER))throw Error('Unsafe ZIP64 integer');
 return Number(n);
}
export async function locateDirectory(tail,tailStart,total,readRange) {
 if(!Number.isSafeInteger(total)||total<22||tailStart<0||tailStart+tail.length!==total)throw Error('Invalid archive bounds');
 let p=tail.length-22;
 for(;p>=0;p--)if(tail.readUInt32LE(p)===0x06054b50&&p+22+tail.readUInt16LE(p+20)===tail.length)break;
 if(p<0)throw Error('ZIP end record absent');
 if(tail.readUInt16LE(p+4)||tail.readUInt16LE(p+6)||tail.readUInt16LE(p+8)!==tail.readUInt16LE(p+10))throw Error('Multi-disk ZIP not supported');
 let count=tail.readUInt16LE(p+10),size=tail.readUInt32LE(p+12),offset=tail.readUInt32LE(p+16),end=tailStart+p,zip64=false;
 if(size===0xffffffff||offset===0xffffffff||count===65535){
  zip64=true;
  const lp=p-20;
  if(lp<0||tail.readUInt32LE(lp)!==0x07064b50||tail.readUInt32LE(lp+4)!==0||tail.readUInt32LE(lp+16)!==1)throw Error('Invalid ZIP64 locator');
  const z=u64(tail,lp+8);
  if(z<0||z+56>end-20)throw Error('ZIP64 end outside archive');
  const b=z>=tailStart&&z+56<=total?tail.subarray(z-tailStart,z-tailStart+56):await readRange(z,z+55);
  if(b.length!==56||b.readUInt32LE(0)!==0x06064b50)throw Error('Invalid ZIP64 end record');
  const recordSize=u64(b,4);
  if(recordSize<44||recordSize>1048576||z+12+recordSize!==end-20||b.readUInt32LE(16)!==0||b.readUInt32LE(20)!==0||u64(b,24)!==u64(b,32))throw Error('ZIP64 end identity or disk mismatch');
  count=u64(b,32);size=u64(b,40);offset=u64(b,48);end=z;
 }
 if(count<1||count>100000||size<46||size>8000000||offset<0||offset+size>end)throw Error('Unbounded ZIP directory');
 return {count,size,offset,zip64};
}
export function readDirectory(b) {
 let p=0;const out=[];
 while(p<b.length){
  if(p+46>b.length||b.readUInt32LE(p)!==0x02014b50)throw Error('Invalid ZIP directory');
  const nl=b.readUInt16LE(p+28),el=b.readUInt16LE(p+30),cl=b.readUInt16LE(p+32),end=p+46+nl+el+cl;
  if(!nl||end>b.length)throw Error('Truncated ZIP directory');
  const e={name:b.subarray(p+46,p+46+nl).toString(),flags:b.readUInt16LE(p+8),method:b.readUInt16LE(p+10),crc32:b.readUInt32LE(p+16),compressed:b.readUInt32LE(p+20),size:b.readUInt32LE(p+24),offset:b.readUInt32LE(p+42)};
  const disk=b.readUInt16LE(p+34);
  if(disk!==0)throw Error('Multi-disk ZIP member not supported');
  let q=p+46+nl,extra=null;
  while(q<p+46+nl+el){
   if(q+4>p+46+nl+el)throw Error('Truncated ZIP extra header');
   const id=b.readUInt16LE(q),n=b.readUInt16LE(q+2);
   if(q+4+n>p+46+nl+el)throw Error('Truncated ZIP extra');
   if(id===1){if(extra)throw Error('Ambiguous ZIP64 extra');extra=b.subarray(q+4,q+4+n);}
   q+=4+n;
  }
  let j=0;
  for(const k of ['size','compressed','offset'])if(e[k]===0xffffffff){
   if(!extra)throw Error('ZIP64 metadata absent');
   e[k]=u64(extra,j);j+=8;
  }
  if(!e.name||e.flags&1||![0,8].includes(e.method)||!Number.isSafeInteger(e.offset))throw Error('Unsupported ZIP member');
  out.push(e);p=end;
 }
 return out;
}
