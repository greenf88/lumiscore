// Recreate only this task's disposable CLI containers with loopback port bindings.
// Docker API payloads can contain local keys: memory only, never arguments/files/logs.
import http from 'node:http';
const project='lumiscore-pr8-discovery';
const ports={['supabase_db_'+project]:['5432/tcp','55432'],['supabase_kong_'+project]:['8000/tcp','55431'],['supabase_inbucket_'+project]:['8025/tcp','55434']};
export function loopbackContainerConfig(info, name, workdir) {
  const expected=ports[name];
  if(!expected || info.Name!=='/'+name || info.Config.Labels?.['com.supabase.cli.project']!==project ||
    info.Config.Labels?.['com.supabase.cli.workdir']!==workdir || !/^(?:public\.ecr\.aws\/supabase|supabase)\//.test(info.Config.Image)) throw new Error('Disposable container identity mismatch.');
  const bindings=info.HostConfig.PortBindings;
  if(Object.keys(bindings).length!==1 || !bindings[expected[0]]?.length || bindings[expected[0]].some(p=>p.HostPort!==expected[1])) throw new Error('Unexpected disposable port mapping.');
  const endpoints=Object.entries(info.NetworkSettings.Networks);
  if(endpoints.length!==1||endpoints[0][0]!==project) throw new Error('Unexpected disposable container network.');
  return {...info.Config,HostConfig:{...info.HostConfig,PortBindings:{[expected[0]]:[{HostIp:'127.0.0.1',HostPort:expected[1]}]}},
    NetworkingConfig:{EndpointsConfig:{[project]:{Aliases:endpoints[0][1].Aliases,DriverOpts:endpoints[0][1].DriverOpts}}}};
}
export async function confineLocalPorts(run, docker, workdir) {
  const endpoint=JSON.parse((await run(docker,['context','inspect','--format','{{json .Endpoints.docker.Host}}'])).trim());
  let socketPath;
  if(process.platform==='win32' && /^npipe:\/\/\/\/\.\/pipe\/[A-Za-z0-9_-]+$/.test(endpoint)) socketPath=endpoint.slice('npipe://'.length);
  else if(process.platform!=='win32' && endpoint==='unix:///var/run/docker.sock') socketPath='/var/run/docker.sock';
  else throw new Error('Local Docker socket required; remote Docker forbidden.');
  const request=(method,url,body,{binary=false}={})=>new Promise((resolve,reject)=>{
    const payload=Buffer.isBuffer(body)?body:body?JSON.stringify(body):'';
    const req=http.request({socketPath,path:url,method,headers:{'Content-Type':Buffer.isBuffer(body)?'application/x-tar':'application/json','Content-Length':Buffer.byteLength(payload)}},res=>{
      let chunks=[],size=0;res.on('data',x=>{size+=x.length;if(size>4*1024*1024)req.destroy(new Error('Bounded response exceeded.'));else chunks.push(x);});res.on('end',()=>{
        const data=Buffer.concat(chunks);chunks=[];
        if(res.statusCode<200||res.statusCode>=300) reject(new Error('Local Docker operation failed; response withheld.'));
        else {try {resolve(binary?data:data.length?JSON.parse(data.toString()):null);}catch {reject(new Error('Local Docker response invalid.'));}}
      });
    });req.setTimeout(30000,()=>req.destroy(new Error('Local Docker timeout.')));req.on('error',()=>reject(new Error('Local Docker unavailable.')));req.end(payload);
  });
  const version=await request('GET','/version');
  if(!/^1\.\d+$/.test(version.ApiVersion)) throw new Error('Docker API version invalid.');
  const prefix='/v'+version.ApiVersion;
  const plans=[];
  try {
  // Validate ALL exact targets before changing any container. No volumes are deleted.
  for(const name of Object.keys(ports)) {
    const [info]=JSON.parse(await run(docker,['inspect',name]));
    const config=loopbackContainerConfig(info,name,workdir);
    let archive=null;
    if(name==='supabase_kong_'+project) {
      // CLI injects gateway YAML, nginx template, TLS files and email templates here.
      // Preserve the entire task-owned directory in memory, not just the YAML file.
      if(!info.Config.Env.includes('KONG_DECLARATIVE_CONFIG=/home/kong/kong.yml')) throw new Error('Unexpected local gateway config path.');
      archive=await request('GET',`${prefix}/containers/${name}/archive?path=/home/kong`,null,{binary:true});
    }
    plans.push({name,config,archive});
  }
  for(const plan of plans) {
    await request('POST',`${prefix}/containers/${plan.name}/stop?t=10`);
    await request('DELETE',`${prefix}/containers/${plan.name}`);
    await request('POST',`${prefix}/containers/create?name=${plan.name}`,plan.config);
    if(plan.archive) {await request('PUT',`${prefix}/containers/${plan.name}/archive?path=/home`,plan.archive);plan.archive.fill(0);plan.archive=null;}
    await request('POST',`${prefix}/containers/${plan.name}/start`);
    plan.config=null;
  }
  } finally {
    for(const plan of plans) {if(plan.archive) plan.archive.fill(0);plan.archive=null;plan.config=null;}
  }
}
