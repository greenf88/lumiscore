import test from 'node:test';
import assert from 'node:assert/strict';
import { editorialTopLists, editorialTopBooks, topListBookHref, getEditorialWorkSourceId } from './top-lists.ts';
import { bookAuthenticationReturnPath, resolveBookReturnNavigation } from '../navigation/book-return.ts';
import { buildPublicSitemapPaths } from '../seo/sitemap.ts';
test('two exact editorial lists reference 35 existing stable identities, not scores or editions',()=>{
  assert.deepEqual(editorialTopLists.map(l=>l.workIds.length),[10,25]);
  assert.equal(new Set(editorialTopBooks.map(b=>b.workId)).size,35);
  for(const list of editorialTopLists){
    assert.equal(new Set(list.workIds).size,list.workIds.length);
    for(const id of list.workIds){
      const b=editorialTopBooks.find(b=>b.workId===id)!; assert.ok(b);
      assert.match(id,/^[1-9]\d*$/); assert.ok(b.note.nl && b.note.en && b.basis.nl && b.source);
      assert.equal(new URL(topListBookHref(id,list.slug),'https://lumisco.re').pathname,'/book/'+id);
      if(list.slug==='dystopie-vanaf-1990') assert.ok(b.originalYear>=1990);
    }
    assert.ok(buildPublicSitemapPaths([],[]).includes('/toplijsten/'+list.slug));
  }
  assert.throws(()=>topListBookHref('null',editorialTopLists[0].slug));
});
test('editorial return verifies canonical source identity, not a colliding numeric fixture ID',async()=>{
 const path='/toplijsten/dystopie-vanaf-1990';
 assert.deepEqual(await resolveBookReturnNavigation(path,'921100102',async()=>null,getEditorialWorkSourceId('102')),{kind:'editorial',href:path});
 for(const source of [null,'OL999W',getEditorialWorkSourceId('6')])assert.deepEqual(await resolveBookReturnNavigation(path,'102',async()=>null,source),{kind:'browse',href:'/browse'});
 assert.throws(()=>getEditorialWorkSourceId('999999'));
});
test('verified list-to-book navigation returns to exact list; forged sources fall back safely',async()=>{
  const verify=async()=>null;
  assert.deepEqual(await resolveBookReturnNavigation('/toplijsten/dystopie-vanaf-1990','102',verify),{kind:'editorial',href:'/toplijsten/dystopie-vanaf-1990'});
  for(const path of ['/toplijsten/unknown','https://evil.example/toplijsten/dystopie-vanaf-1990','/toplijsten/dystopie-vanaf-1990?x=1']){
    assert.deepEqual(await resolveBookReturnNavigation(path,'102',verify),{kind:'browse',href:'/browse'});
  }
  assert.deepEqual(await resolveBookReturnNavigation('/toplijsten/dystopie-vanaf-1990','6',verify),{kind:'browse',href:'/browse'});
  const navigation = await resolveBookReturnNavigation('/toplijsten/dystopie-vanaf-1990','102',verify);
  assert.equal(bookAuthenticationReturnPath('102',navigation),'/book/102?returnTo=%2Ftoplijsten%2Fdystopie-vanaf-1990');
  assert.equal(bookAuthenticationReturnPath('102',{kind:'browse',href:'/browse'}),'/book/102');
});
