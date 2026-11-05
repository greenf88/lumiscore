"""Read-only original HTTP checks on the existing authorized test Preview."""
import concurrent.futures,hashlib,html,importlib.util,json,pathlib,re,subprocess,sys
ROOT=pathlib.Path(__file__).resolve().parents[2];sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('head',ROOT/'scripts/audit-metadata-head.py');head=importlib.util.module_from_spec(spec);spec.loader.exec_module(head)
origin='https://lumiscore-omh4szyik-rgkgroeneveld-9102.vercel.app';out=ROOT/'outputs/popular-three-20261105/http';out.mkdir(parents=True,exist_ok=True)
items=json.loads((ROOT/'catalog/popular-three-20261105/reviewed-books.json').read_text(encoding='utf8'))['items']
cli=pathlib.Path.home()/'AppData/Roaming/npm/node_modules/vercel/dist/index.js'
def get(job):
 item,ua=job;path='/nl/book/'+str(item['testWorkId']);url=origin+path;key=item['key']+'-'+ua;file=out/(key+'.html')
 cmd=['node',str(cli),'curl',url,'--scope','rgkgroeneveld-9102','--','--silent','--show-error','--location','--max-time','30','--user-agent',head.UAS[ua],'--dump-header','-','--output',str(file),'--write-out','\nMETRIC:%{json}']
 r=subprocess.run(cmd,cwd=ROOT,capture_output=True,text=True,encoding='utf8',timeout=65)
 if r.returncode or 'METRIC:' not in r.stdout:raise RuntimeError('Official authorized CLI GET failed '+key)
 headers,m=r.stdout.rsplit('METRIC:',1);m=json.loads(m);raw=file.read_bytes();s=raw.decode('utf8','replace');doc=head.inspect(raw)
 assert m['http_code']==200,(key,m['http_code']);assert not doc['relevantOutsideHead'] and not doc['duplicateKinds'] and not doc['invalidHeadElements'],key
 canon=[t for t in doc['tags'] if t['kind']=='canonical'];assert len(canon)==1 and canon[0]['value']=='https://lumisco.re'+path,key
 section=re.search(r'<section class="book-description"[^>]*>([\s\S]*?)</section>',s);assert section,key
 visible=' '.join(html.unescape(re.sub('<[^>]+>',' ',section[1])).split());assert item['summary'] in visible,(key,visible);assert item['source'] in section[1],key
 assert item['editions'][0]['isbn'] in s,key
 return dict(url=url,path=path,ua=ua,status=m['http_code'],ttfbMs=m['time_starttransfer']*1000,completeMs=m['time_total']*1000,bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest(),file=file.name,exactInitialSummary=True,exactEdition=True,head=doc)
with concurrent.futures.ThreadPoolExecutor(max_workers=2)as pool:rows=list(pool.map(get,[(i,u)for i in items for u in['desktop','mobile']]))
report=dict(environment='Existing Ready isolated test Preview; no production requests or writes',origin=origin,applicationHead='f3450748458ecd98f9c117a441d145489e00a390',runtimeSourceCommit='24b3ba6d39ddb34cb12e2f8650a1a566a6e79ec6',sameRuntimeAsMain='09b96f5bcb129ecaba4e8b7ec5cfadd6372e98f4',guest=True,requests=len(rows),rows=rows,definitions='curl TTFB and full response, excludes CLI bootstrap; no cold-cache control, browser-paint or production performance claim')
(out/'responses.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf8');print(json.dumps(dict(passed=True,responses=len(rows))))
