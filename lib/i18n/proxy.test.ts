import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import test from 'node:test';
import ts from 'typescript';
import * as paths from './paths.ts';
import { PRIVATE_RESPONSE_HEADERS } from '../auth/request.ts';

// Execute the real proxy with synthetic transport/session adapters, not Auth
// credentials. This covers cookie copying when NextResponse is replaced.
async function fixture() {
  type Cookie = { name:string; value:string; path?:string; httpOnly?:boolean; secure?:boolean };
  const response = (kind:string, target?:URL, options?:{request?:{headers:Headers}}) => {
    const cookies:Cookie[]=[];
    return {kind,target,options,status:200,headers:new Headers(),cookies:{getAll:()=>cookies,set:(cookie:Cookie)=>cookies.push(cookie)}};
  };
  let refreshes=0;
  const runtimeExports:Record<string, (request:unknown)=>Promise<ReturnType<typeof response>>>={};
  const source=await readFile(new URL('../../proxy.ts',import.meta.url),'utf8');
  const compiled=ts.transpile(source,{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022});
  runInNewContext(compiled, {exports:runtimeExports,Headers,require:(name:string)=>{
    if(name==='next/server') return {NextResponse:{next:(options:Parameters<typeof response>[2])=>response('next',undefined,options),rewrite:(target:URL,options:Parameters<typeof response>[2])=>response('rewrite',target,options),redirect:(target:URL,status:number)=>({...response('redirect',target),status})}};
    if(name==='./lib/i18n/paths') return paths;
    if(name==='@/lib/auth/request') return {PRIVATE_RESPONSE_HEADERS};
    if(name==='@/lib/supabase/proxy') return {refreshSupabaseSession:async(request:{headers:Headers})=>{
      refreshes++;
      request.headers.set('cookie','synthetic-session=refreshed');
      const refreshed=response('next');
      refreshed.cookies.set({name:'synthetic-session',value:'refreshed',path:'/',httpOnly:true,secure:true});
      for(const [key,value] of Object.entries(PRIVATE_RESPONSE_HEADERS)) refreshed.headers.set(key,value);
      return refreshed;
    }};
    throw new Error('Unexpected dependency');
  }});
  const request=(pathname:string)=>{
    const url=new URL(pathname,'https://lumisco.re');
    return {nextUrl:Object.assign(url,{clone:()=>new URL(url)}),headers:new Headers({cookie:'synthetic-session=old',[paths.LOCALE_REQUEST_HEADER]:'en',[paths.PATH_REQUEST_HEADER]:'/attacker'})};
  };
  return {proxy:runtimeExports.proxy,request,refreshes:()=>refreshes};
}

test('locale rewrite forwards refreshed session cookies and private cache headers, not spoofed locale/path',async()=>{
  const f=await fixture();
  const rewritten=await f.proxy(f.request('/nl/browse?page=2'));
  assert.equal(rewritten.kind,'rewrite');
  assert.equal(rewritten.target?.pathname,'/browse');
  assert.equal(rewritten.target?.search,'?page=2');
  assert.equal(rewritten.options?.request?.headers.get('cookie'),'synthetic-session=refreshed');
  assert.equal(rewritten.options?.request?.headers.get(paths.LOCALE_REQUEST_HEADER),'nl');
  assert.equal(rewritten.options?.request?.headers.get(paths.PATH_REQUEST_HEADER),'/nl/browse?page=2');
  assert.deepEqual(JSON.parse(JSON.stringify(rewritten.cookies.getAll())),[{name:'synthetic-session',value:'refreshed',path:'/',httpOnly:true,secure:true}]);
  for(const [key,value] of Object.entries(PRIVATE_RESPONSE_HEADERS)) assert.equal(rewritten.headers.get(key),value);
  const login=await f.proxy(f.request('/nl/login'));
  assert.equal(login.headers.get('cache-control'),PRIVATE_RESPONSE_HEADERS['Cache-Control']);
  assert.equal(f.refreshes(),2);
});

test('legacy redirect remains fixed; neutral actions receive no caller-supplied locale authority',async()=>{
  const f=await fixture();
  const legacy=await f.proxy(f.request('/book/123?returnTo=%2Fbrowse'));
  assert.equal(legacy.target?.pathname,'/en/book/123');
  assert.equal(legacy.target?.search,'?returnTo=%2Fbrowse');
  assert.equal(legacy.status,307);
  assert.equal(legacy.headers.get('cache-control'),'no-store');
  assert.equal(f.refreshes(),0);
  const action=await f.proxy(f.request('/auth/callback'));
  assert.equal(action.kind,'next');
  assert.equal(action.options?.request?.headers.get(paths.LOCALE_REQUEST_HEADER),null);
  assert.equal(action.options?.request?.headers.get(paths.PATH_REQUEST_HEADER),null);
});
