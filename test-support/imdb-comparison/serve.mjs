// Loopback-only real router/UI review. No remote credentials, data or writes.
// Only auth and existing data loaders are replaced; comparison copy is real.
import {createServer} from 'vite';
import vinext from 'vinext';
import tailwindcss from '@tailwindcss/postcss';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
for(const key of Object.keys(process.env))if(/SUPABASE|DATABASE|SECRET|TOKEN|GOOGLE_BOOKS/.test(key))delete process.env[key];
const modules={
 'lib/supabase/auth.ts':`export async function loadHeaderAuthState(){return {authenticated:false}};export async function getVerifiedServerUser(){return {client:null,user:null}}`,
 'lib/supabase/books.ts':`export async function loadHighestRatedCatalog(){return {books:[],total:null}}`,
 'lib/server-environment.ts':`export const readServerEnvironment=()=> 'LOCAL_NO_DATA';export function logServerEnvironmentPresence(){}`,
 'lib/supabase/proxy.ts':`import {NextResponse} from 'next/server';export async function refreshSupabaseSession(request){return NextResponse.next({request})}`,
 'lib/supabase/categories.ts':`export async function loadPublicCategories(){return []}`,
 'lib/supabase/taste-test.ts':`export async function loadHomepagePersonalization(){throw Error('Guest must not request personal recommendations')}`,
 'lib/supabase/collections.ts':`export async function loadHomepageSeriesContinuations(){throw Error('Guest must not request personal continuations')}`,
 'lib/supabase/client.ts':`const q={select(){return q},order(){return q},async range(){return {data:[],error:null}}};export const supabase={from(){return q}}`,
};
const server=await createServer({root,configFile:false,envFile:false,cacheDir:root+'node_modules/.vite-imdb-review',resolve:{alias:{'@':root}},css:{postcss:{plugins:[tailwindcss()]}},plugins:[{name:'local-imdb-no-remote',enforce:'pre',load(id){const key=id.replaceAll('\\','/').replace(root.replaceAll('\\','/'),'').split('?')[0];return modules[key]??null}},vinext()],server:{host:'127.0.0.1',port:3152,strictPort:true}});
await server.listen();console.log('LOCAL IMDb PAGE REVIEW http://127.0.0.1:3152/nl/imdb-voor-boeken — guest, no DB/Auth/data');
