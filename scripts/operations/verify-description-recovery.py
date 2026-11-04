"""Bounded guest GETs of exact test fixtures. Official CLI auth; no secret output."""
import concurrent.futures,hashlib,html,importlib.util,json,pathlib,re,subprocess,sys
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('head',ROOT/'scripts/audit-metadata-head.py');head=importlib.util.module_from_spec(spec);spec.loader.exec_module(head)
origin=sys.argv[1].rstrip('/');out=ROOT/'outputs/description-recovery-20261104/hosted';out.mkdir(parents=True,exist_ok=True)
assert origin.startswith('https://lumiscore-') and origin.endswith('-rgkgroeneveld-9102.vercel.app')
cli=pathlib.Path.home()/'AppData/Roaming/npm/node_modules/vercel/dist/index.js'
items=json.loads((ROOT/'catalog/description-recovery-20261104/four-summaries.json').read_text(encoding='utf8'))['items']
mapping={6272:988110001,1995:988110002,1824:987110006,8783:988110003}
expected={'/'+i['language']+'/book/'+str(mapping[i['workId']]):i for i in items}
jobs=[(p,u) for p in expected for u in ['desktop','mobile','googlebot','inspection']]
jobs += [(f'/{l}/browse'+('' if p==1 else '?page='+str(p)),'desktop') for l in ['nl','en'] for p in [1,2,3]]
jobs += [(p,'desktop') for p in ['/nl/book/987110006','/nl/collection/suzanne-vermeer','/nl/toplijsten/fantasy-om-mee-te-beginnen','/nl/toplijsten/na-project-hail-mary']]
def get(job):
 path,ua=job;url=origin+path;key=hashlib.sha256((url+ua).encode()).hexdigest()[:18];file=out/(key+'.html')
 cmd=['node',str(cli),'curl',url,'--scope','rgkgroeneveld-9102','--','--silent','--show-error','--location','--max-time','30','--user-agent',head.UAS[ua],'--dump-header','-','--output',str(file),'--write-out','\nMETRIC:%{json}']
 r=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True,encoding='utf8',timeout=65)
 if r.returncode or 'METRIC:' not in r.stdout:raise RuntimeError('Official CLI GET failed: '+path)
 headers,m=r.stdout.rsplit('METRIC:',1);m=json.loads(m);raw=file.read_bytes();doc=head.inspect(raw);s=raw.decode('utf8','replace')
 assert m['http_code']==200,(path,m['http_code'])
 assert not doc['relevantOutsideHead'] and not doc['duplicateKinds'] and not doc['invalidHeadElements'],path
 canon=[t for t in doc['tags'] if t['kind']=='canonical'];assert len(canon)==1 and canon[0]['value']=='https://lumisco.re'+path,path
 if '/browse' not in path:assert '"@type":"BreadcrumbList"' in s or '"@type": "BreadcrumbList"' in s,path
 if path in expected:
  item=expected[path];section=re.search(r'<section class="book-description"[^>]*>([\s\S]*?)</section>',s)
  assert section,path;visible=' '.join(html.unescape(re.sub('<[^>]+>',' ',section[1])).split());assert ' '.join(item['after']['text'].split()) in visible,(path,visible)
  assert item['after']['source_url'].replace('&','&amp;') in section[1],path
  assert 'Loading the description' not in visible and 'wordt geladen' not in visible and 'could not load' not in visible and 'tijdelijk niet' not in visible,path
  assert item['expectedEdition']['isbn_13'] in s,path
 if '/browse' in path:
  assert [t['value'] for t in doc['tags'] if t['kind']=='robots']==['index, follow'],path
  assert len([t for t in doc['tags'] if t['kind']=='hreflang'])==(0 if '?page=' in path else 3),path
 safe={k.lower():v.strip() for k,v in re.findall(r'^([A-Za-z-]+):([^\r\n]+)',headers,re.M) if k.lower() in head.HEADERS}
 return {'path':path,'url':url,'ua':ua,'requestUserAgent':head.UAS[ua],'status':m['http_code'],'finalUrl':m['url_effective'],'redirects':m['num_redirects'],'ttfbMs':m['time_starttransfer']*1000,'completeMs':m['time_total']*1000,'bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'file':file.name,'headers':safe,'html':doc,'approvedInitialSummary':path in expected}
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:rows=list(pool.map(get,jobs))
report={'origin':origin,'requests':len(rows),'uaSimulationsOnly':True,'guestRequests':True,'browserPaintMeasured':False,'definitions':'TTFB and complete-response durations from curl; CLI bootstrap excluded. No controlled cold cache. Original initial description section checked, not merely presence in RSC/body scripts. Preview protection headers are separate from app robots. No production performance claim.','rows':rows}
(out/'responses.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8');print(json.dumps({'passed':True,'requests':len(rows),'exactDescriptions':4,'preservedBrowsePages':6}))
