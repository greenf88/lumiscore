"""Exact immutable test Previews only. Existing official CLI auth; no tokens/logs."""
import concurrent.futures, hashlib, importlib.util, json, pathlib, re, subprocess, sys
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('head',ROOT/'scripts/audit-metadata-head.py');head=importlib.util.module_from_spec(spec);spec.loader.exec_module(head)
out=ROOT/'outputs/seo-p1-20261104/hosted';out.mkdir(parents=True,exist_ok=True)
cli=pathlib.Path.home()/'AppData/Roaming/npm/node_modules/vercel/dist/index.js'
origins={'before':'https://lumiscore-oi0pnlmaz-rgkgroeneveld-9102.vercel.app','after':'https://lumiscore-1dbfua4b1-rgkgroeneveld-9102.vercel.app'}
def get(job):
 phase,path,ua,repeat=job;url=origins[phase]+path;key=hashlib.sha256((url+ua+str(repeat)).encode()).hexdigest()[:18];file=out/(key+'.html')
 cmd=['node',str(cli),'curl',url,'--scope','rgkgroeneveld-9102','--','--silent','--show-error','--location','--max-time','30','--user-agent',head.UAS[ua],'--dump-header','-','--output',str(file),'--write-out','\nMETRIC:%{json}']
 r=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True,encoding='utf-8',timeout=60)
 if r.returncode:raise RuntimeError('Official CLI request failed for '+path+'; diagnostic retained only in memory')
 if 'METRIC:' not in r.stdout:raise RuntimeError('No curl measurement for '+path)
 headers,m=r.stdout.rsplit('METRIC:',1);m=json.loads(m);raw=file.read_bytes();h=head.inspect(raw)
 # Never retain Set-Cookie, credential/debug headers or CLI diagnostics.
 safe={k.lower():v.strip() for k,v in re.findall(r'^([A-Za-z-]+):([^\r\n]+)',headers,re.M) if k.lower() in head.HEADERS}
 return {'phase':phase,'path':path,'url':url,'ua':ua,'userAgent':head.UAS[ua],'repeat':repeat,'status':m['http_code'],'finalUrl':m['url_effective'],'redirects':m['num_redirects'],'ttfbMs':m['time_starttransfer']*1000,'totalMs':m['time_total']*1000,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'file':file.name,'headers':safe,'html':h,'bookIds':list(dict.fromkeys(re.findall(r'class="book-card-main-link"[^>]*href="/(?:nl|en)/book/(\d+)',raw.decode('utf-8','replace'))))}
jobs=[]
for lang in ['nl','en']:
 for path in ['/browse','/browse?page=2','/browse?page=3']:
  for ua in ['desktop','googlebot','inspection']:jobs.append(('after','/'+lang+path,ua,0))
 for path in ['/browse?page=2&sort=highest&pageSize=16','/browse?page=2&sort=az','/browse?page=2&pageSize=32','/browse?page=2&category=fiction_fantasy','/browse?page=999999']:
  jobs.append(('after','/'+lang+path,'desktop',0))
 for phase in ['before','after']:
  for path in ['/browse','/browse?page=2','/browse?page=3']:
   for n in [1,2]:jobs.append((phase,'/'+lang+path,'desktop',n))
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:rows=list(pool.map(get,jobs))
for r in rows:
 assert r['status']==200,r['path'];h=r['html'];assert not h['relevantOutsideHead'] and not h['duplicateKinds'] and not h['invalidHeadElements'],r['path'];c=[t for t in h['tags'] if t['kind']=='canonical'];assert len(c)==1 and c[0]['inHead'],r['path']
 if r['phase']=='after':
  locale=r['path'].split('/')[1];tail=r['path'].split('/browse',1)[1];filtered='sort=az' in tail or 'pageSize=32' in tail or 'category=' in tail
  expected=r['finalUrl'].split('.vercel.app',1)[1] if '999999' in tail else '/'+locale+'/browse'+('' if filtered or not tail else '?page='+re.search(r'page=(\d+)',tail)[1])
  assert c[0]['value']=='https://lumisco.re'+expected,(r['path'],c[0]);assert [t['value'] for t in h['tags'] if t['kind']=='robots']==['noindex, follow' if filtered else 'index, follow'],r['path']
  assert len([t for t in h['tags'] if t['kind']=='hreflang'])==(3 if not tail else 0),r['path']
  if '999999' in tail:assert r['redirects']==1,r['path']
  elif not filtered:assert len(r['bookIds'])==16,(r['path'],r['bookIds'])
for lang in ['nl','en']:
 seq=[r for r in rows if r['phase']=='after' and r['ua']=='desktop' and r['repeat']==0 and r['path'] in ['/'+lang+'/browse','/'+lang+'/browse?page=2','/'+lang+'/browse?page=3']]
 assert len(set(i for r in seq for i in r['bookIds']))==48,lang
 for path in ['/'+lang+'/browse','/'+lang+'/browse?page=2','/'+lang+'/browse?page=3']:
  before=next(r for r in rows if r['path']==path and r['phase']=='before');after=next(r for r in rows if r['path']==path and r['phase']=='after');assert before['bookIds']==after['bookIds'],path
report={'applicationSha':'c7ed81dda41ccc6e0d528a73bc399b56efe87482','previewDeployment':'dpl_ECMkGMQ67ermLV7V9mtv2UqHQZjV','baselineRuntime':'PR74, identical runtime to current main; same isolated test catalog','definitions':'Official authenticated Vercel CLI GETs, no cookies. Curl response-start and complete-response timings exclude CLI bootstrap. No controlled cold cache, no production performance claim, no LCP/INP measurement. UA simulation is not a real Google visit. Preview x-robots-tag is separate from application robots.','rows':rows}
(out/'responses.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'requests':len(rows),'passed':True,'uniqueCardsPerLocale':48,'selectionUnchanged':True}))
