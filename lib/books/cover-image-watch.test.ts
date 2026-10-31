import test from 'node:test';
import assert from 'node:assert/strict';
import { watchCoverImage, COVER_IMAGE_TIMEOUT_MS } from './cover-image-watch.ts';

function image(complete=false,width=0,height=0) {
  const target=new EventTarget();
  return Object.assign(target,{complete,naturalWidth:width,naturalHeight:height,currentSrc:'https://covers.example.test/verified.jpg',src:'https://covers.example.test/verified.jpg'}) as unknown as HTMLImageElement;
}

test('a stalled request fails once within its budget; unmounted/old edition callbacks do nothing', t => {
  t.mock.timers.enable({apis:['setTimeout']});
  const cover=image(),failures:string[]=[];
  const stop=watchCoverImage(cover,url=>failures.push(url),true);
  t.mock.timers.tick(COVER_IMAGE_TIMEOUT_MS-1);assert.equal(failures.length,0);
  t.mock.timers.tick(1);assert.equal(failures.length,1);
  cover.dispatchEvent(new Event('error'));t.mock.timers.tick(COVER_IMAGE_TIMEOUT_MS);assert.equal(failures.length,1);stop();
  const next=image();const remove=watchCoverImage(next,url=>failures.push(url),true);remove();
  next.dispatchEvent(new Event('error'));t.mock.timers.tick(COVER_IMAGE_TIMEOUT_MS);assert.equal(failures.length,1);
});

test('valid cached/loaded images cancel the timeout; tiny placeholders progress to the next permitted attempt', t => {
  t.mock.timers.enable({apis:['setTimeout']});let failed=0;
  watchCoverImage(image(true,330,500),()=>failed++,true);
  const fresh=image();watchCoverImage(fresh,()=>failed++,true);
  Object.assign(fresh,{naturalWidth:330,naturalHeight:500});fresh.dispatchEvent(new Event('load'));
  t.mock.timers.tick(COVER_IMAGE_TIMEOUT_MS);assert.equal(failed,0);
  watchCoverImage(image(true,1,1),()=>failed++,true);assert.equal(failed,1);
});

test('lazy below-fold images do not spend a load budget until visible', t => {
  t.mock.timers.enable({apis:['setTimeout']});let notify:(entries:Array<{isIntersecting:boolean}>)=>void=()=>{};let disconnected=0,failed=0;
  const original=Object.getOwnPropertyDescriptor(globalThis,'IntersectionObserver');
  Object.defineProperty(globalThis,'IntersectionObserver',{configurable:true,value:class {
    constructor(callback:typeof notify){notify=callback;}observe(){}disconnect(){disconnected++;}
  }});
  try {
    const stop=watchCoverImage(image(),()=>failed++,false);
    t.mock.timers.tick(COVER_IMAGE_TIMEOUT_MS*3);assert.equal(failed,0);
    notify([{isIntersecting:false}]);t.mock.timers.tick(COVER_IMAGE_TIMEOUT_MS);assert.equal(failed,0);
    notify([{isIntersecting:true}]);t.mock.timers.tick(COVER_IMAGE_TIMEOUT_MS);assert.equal(failed,1);
    stop();assert.ok(disconnected>0);
  }finally{if(original)Object.defineProperty(globalThis,'IntersectionObserver',original);else Reflect.deleteProperty(globalThis,'IntersectionObserver');}
});
