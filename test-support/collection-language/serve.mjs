import {createServer} from 'vite';import react from '@vitejs/plugin-react';import tailwindcss from '@tailwindcss/postcss';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const server=await createServer({root:root+'test-support/collection-language',configFile:false,envFile:false,cacheDir:root+'node_modules/.vite-collection-language-3150',plugins:[react()],resolve:{alias:{'@':root}},css:{postcss:{plugins:[tailwindcss()]}},define:{'process.env.NEXT_PUBLIC_SUPABASE_URL':JSON.stringify(''),'process.env.NODE_ENV':JSON.stringify('development')},server:{host:'127.0.0.1',port:3150,strictPort:true,fs:{allow:[root]}}});
await server.listen();console.log('LOCAL SYNTHETIC COLLECTION UI http://127.0.0.1:3150/nl — no DB/Auth/writes');
