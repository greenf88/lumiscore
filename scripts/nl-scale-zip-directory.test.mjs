import test from 'node:test';
import assert from 'node:assert/strict';
import {locateDirectory,readDirectory} from './nl-scale-zip-directory.mjs';
const end=()=>{const b=Buffer.alloc(22);b.writeUInt32LE(0x06054b50);b.writeUInt16LE(1,8);b.writeUInt16LE(1,10);b.writeUInt32LE(60,12);b.writeUInt32LE(100,16);return b;};
test('ordinary end record with explicit comment length',async()=>{
 const b=end(),result=await locateDirectory(b,160,182,()=>assert.fail('No extra range'));
 assert.deepEqual(result,{count:1,size:60,offset:100,zip64:false});
 const bad=Buffer.from(b);bad.writeUInt16LE(1,20);
 await assert.rejects(()=>locateDirectory(bad,160,182,()=>{}),/absent/);
});
test('ZIP64 directory beyond4GiB uses exact supported56byte record',async()=>{
 const total=5_000_000_000,z=total-98,tail=Buffer.concat([Buffer.alloc(20),end()]);
 tail.writeUInt32LE(0x07064b50);tail.writeBigUInt64LE(BigInt(z),8);tail.writeUInt32LE(1,16);
 tail.writeUInt16LE(65535,28);tail.writeUInt16LE(65535,30);tail.writeUInt32LE(0xffffffff,32);tail.writeUInt32LE(0xffffffff,36);
 const record=Buffer.alloc(56);record.writeUInt32LE(0x06064b50);record.writeBigUInt64LE(44n,4);record.writeBigUInt64LE(10000n,24);record.writeBigUInt64LE(10000n,32);record.writeBigUInt64LE(800000n,40);record.writeBigUInt64LE(BigInt(z-800000),48);
 const result=await locateDirectory(tail,total-tail.length,total,(start,finish)=>{assert.equal(start,z);assert.equal(finish,z+55);return record;});
 assert.equal(result.zip64,true);assert.equal(result.count,10000);assert.equal(result.offset,z-800000);
 const malformed=Buffer.from(record);malformed.writeBigUInt64LE(1n<<63n,48);
 await assert.rejects(()=>locateDirectory(tail,total-tail.length,total,()=>malformed),/Unsafe/);
});
test('multi-disk and missing ZIP64 locator are refused without fallback',async()=>{
 const b=end();b.writeUInt16LE(1,4);await assert.rejects(()=>locateDirectory(b,160,182,()=>{}),/Multi-disk/);
 const z=end();z.writeUInt32LE(0xffffffff,16);await assert.rejects(()=>locateDirectory(z,160,182,()=>{}),/locator/);
});
test('central directory consumes ZIP64 fields only for sentinel values',()=>{
 const name=Buffer.from('0008186454.jpg'),extra=Buffer.alloc(12),b=Buffer.alloc(46+name.length+extra.length);
 b.writeUInt32LE(0x02014b50);b.writeUInt16LE(name.length,28);b.writeUInt16LE(extra.length,30);b.writeUInt32LE(0xffffffff,42);b.writeUInt32LE(123,20);b.writeUInt32LE(123,24);
 extra.writeUInt16LE(1);extra.writeUInt16LE(8,2);extra.writeBigUInt64LE(4_500_000_000n,4);name.copy(b,46);extra.copy(b,46+name.length);
 assert.equal(readDirectory(b)[0].offset,4_500_000_000);
 assert.equal(readDirectory(b)[0].size,123);
 assert.throws(()=>readDirectory(b.subarray(0,b.length-1)),/Truncated/);
 const bad=Buffer.from(b);bad.writeUInt16LE(1,34);assert.throws(()=>readDirectory(bad),/Multi-disk/);
});
