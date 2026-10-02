// Test-only loopback host for Vercel's generated Fetch handler and static assets.
// No build/deploy action and no remote credentials. Supports read-only page checks.
import http from 'node:http';
import fs from 'node:fs/promises';
import path from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
const root=fileURLToPath(new URL('../.vercel/output/static/',import.meta.url));
const {default:app}=await import('../.vercel/output/functions/__server.func/index.mjs');
const types={'.js':'text/javascript','.css':'text/css','.json':'application/json','.svg':'image/svg+xml',
  '.png':'image/png','.jpg':'image/jpeg','.avif':'image/avif','.webp':'image/webp','.woff2':'font/woff2','.ico':'image/x-icon'};
http.createServer(async(req,res)=>{
  if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
  try {
    const url=new URL(req.url,'http://localhost:3983');
    const asset=path.resolve(root,'.'+decodeURIComponent(url.pathname));
    if(asset.startsWith(root)&&path.extname(asset)) {
      try {
        const data=await fs.readFile(asset);
        res.writeHead(200,{'content-type':types[path.extname(asset)]??'application/octet-stream'}).end(req.method==='HEAD'?undefined:data);
        return;
      } catch(error){if(!['ENOENT','EISDIR'].includes(error.code))throw error;}
    }
    const response=await app.fetch(new Request(url,{method:req.method,headers:req.headers}));
    res.writeHead(response.status,Object.fromEntries(response.headers));
    if(response.body&&req.method!=='HEAD')Readable.fromWeb(response.body).pipe(res);else res.end();
  } catch(error){console.error(error);res.writeHead(500).end('Local production preview failed');}
}).listen(3983,'127.0.0.1',()=>console.log('Built Vercel handler served locally at http://localhost:3983'));
