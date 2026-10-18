// Explicit loopback-only renderer. No env/Auth keys, database or remote writes.
import {createServer} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));
const server=await createServer({configFile:false,envFile:false,root:root+'test-support/edition-presentation',publicDir:root+'public',cacheDir:root+'.wrangler/node_modules/edition-review-vite',
 resolve:{alias:{'@':root,'next/image':root+'node_modules/vinext/dist/shims/image.js'},dedupe:['react','react-dom']},define:{'process.env':'{}'},css:{postcss:{plugins:[]}},
 plugins:[react(),{name:'deny-local-review-mutations',configureServer(vite){vite.middlewares.use((req,res,next)=>{if(!['GET','HEAD'].includes(req.method)||req.url.startsWith('/api/')){res.writeHead(405);res.end('LOCAL READ-ONLY REVIEW');return;}next();});}}],
 server:{host:'127.0.0.1',port:3136,strictPort:true,fs:{allow:[root]}}});
await server.listen();console.log('Local read-only edition review: http://127.0.0.1:3136/nl/review');
