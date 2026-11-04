"""Fixed historical cohorts, bounded public HTML link graph. No cookies/GSC/writes."""
import argparse, concurrent.futures, datetime, hashlib, importlib.util, json, pathlib, re, sys, time, urllib.request
from html.parser import HTMLParser
from urllib.parse import urljoin, urlsplit, urlunsplit
sys.dont_write_bytecode = True
ROOT = pathlib.Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('head', ROOT / 'scripts/audit-metadata-head.py')
head = importlib.util.module_from_spec(spec); spec.loader.exec_module(head)
class Content(HTMLParser):
 def __init__(self):
  super().__init__(convert_charrefs=True); self.links=[]; self.text=[]; self.skip=0; self.main=0; self.a=None
 def handle_starttag(self,t,attrs):
  a=dict(attrs)
  if t in ('script','style','template'): self.skip+=1
  if t=='main': self.main+=1
  if not self.skip and t=='a' and a.get('href'): self.a={'href':a['href'],'text':'','main':bool(self.main),'rel':a.get('rel','')}
 def handle_endtag(self,t):
  if t in ('script','style','template'): self.skip=max(0,self.skip-1)
  if t=='main': self.main=max(0,self.main-1)
  if t=='a' and self.a:
   self.a['text']=' '.join(self.a['text'].split()); self.links.append(self.a); self.a=None
 def handle_data(self,s):
  if not self.skip:
   if self.main: self.text.append(s)
   if self.a: self.a['text']+=s+' '
def clean(url):
 p=urlsplit(url); return urlunsplit((p.scheme,p.netloc,p.path.rstrip('/') or '/',p.query,''))
def main():
 p=argparse.ArgumentParser();p.add_argument('--sources',required=True);p.add_argument('--output',required=True);p.add_argument('--sha',required=True);args=p.parse_args()
 source=pathlib.Path(args.sources);out=pathlib.Path(args.output);(out/'responses').mkdir(parents=True,exist_ok=True)
 files=[source/'20261030/audit.json',source/'20261103/recovery/analysis.json']
 old=json.loads(files[0].read_text(encoding='utf-8-sig'));priority=json.loads(files[1].read_text(encoding='utf-8-sig'))
 cohort=old['manifest']['sample'];priorities=[r['url'] for r in priority['target_pages']]; targets=list(dict.fromkeys(cohort+priorities))
 checkpoint=out/'checkpoint.json'
 rows=json.loads(checkpoint.read_text(encoding='utf-8')) if checkpoint.exists() else {}
 def fetch(url):
  time.sleep(.15);r=head.get('https://lumisco.re',url.split('lumisco.re',1)[1],'desktop',out,0)
  if r.get('file'):
   c=Content();c.feed((out/r['file']).read_text(encoding='utf-8'));r['mainText']=' '.join(' '.join(c.text).split());r['links']=c.links
   for link in r['links']:link['url']=clean(urljoin(r['finalUrl'],link['href']))
  return r
 def batch(urls):
  urls=[u for u in urls if u not in rows]
  with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
   for url,r in zip(urls,pool.map(fetch,urls)):rows[url]=r
  (out/'checkpoint.json').write_text(json.dumps(rows,ensure_ascii=False),encoding='utf-8')
 hubs=['https://lumisco.re/'+lang+path for lang in ['nl','en'] for path in ['', '/browse','/browse?page=2','/browse?page=3','/browse?page=2&pageSize=16&sort=highest','/collections','/categories','/toplijsten']]
 batch(list(dict.fromkeys(targets+hubs)))
 # One additional public hub layer, at most 100 pages, plus collection hub pagination.
 extra=[]
 for url in hubs:
  for l in rows[url].get('links',[]):
   if l['url'].startswith('https://lumisco.re/') and re.search(r'/(?:collection/|toplijsten/|collections\?)',l['url']) and '/book/' not in l['url'] and l['url'] not in targets+hubs:
    extra.append(l['url'])
 batch(list(dict.fromkeys(extra))[:100])
 # Read only public robots/sitemap; reuse bounded getter (XML is not a page).
 batch(['https://lumisco.re/robots.txt','https://lumisco.re/sitemap.xml'])
 sr=rows['https://lumisco.re/sitemap.xml']
 if not sr.get('file'):
  # Sitemap XML legitimately exceeds the HTML audit's 5MB cap. No HTML rechecks.
  with urllib.request.urlopen(urllib.request.Request('https://lumisco.re/sitemap.xml',headers={'User-Agent':head.UAS['desktop']}),timeout=40) as response:
   raw=response.read(15_000_001)
   if len(raw)>15_000_000:raise ValueError('Sitemap XML exceeds 15MB cap')
   sr={'status':response.status,'file':'sitemap.xml','bytes':len(raw),'sha256':hashlib.sha256(raw).hexdigest(),'initialHtmlCapError':sr.get('error')};(out/'sitemap.xml').write_bytes(raw);rows['https://lumisco.re/sitemap.xml']=sr
  checkpoint.write_text(json.dumps(rows,ensure_ascii=False),encoding='utf-8')
 sitemap=(out/sr['file']).read_text(encoding='utf-8')
 graph={}
 for url,r in rows.items():
  # Book returnTo links address the same public Work page; retain the literal
  # href separately as evidence, but use its clean path for graph traversal.
  destinations=[l['url'].split('?')[0] if '/book/' in l['url'] else l['url'] for l in r.get('links',[])]
  graph[url]=list(dict.fromkeys(u for u in destinations if u in rows and u.split('lumisco.re/')[1][:2]==url.split('lumisco.re/')[1][:2]))
 def path(target):
  root='https://lumisco.re/'+target.split('lumisco.re/')[1][:2];queue=[(root,[root])];seen=set()
  while queue:
   u,p=queue.pop(0)
   if u==target:return p
   if u in seen:continue
   seen.add(u);queue.extend((v,p+[v]) for v in graph.get(u,[]) if v not in seen)
  return None
 report=[]
 for url in targets:
  r=rows[url];h=r.get('html',{});text=r.get('mainText','');can=[t for t in h.get('tags',[]) if t['kind']=='canonical']
  inbound=[{'source':s,'anchor':l['text'],'href':l['href']} for s,x in rows.items() for l in x.get('links',[]) if clean(l['url']).split('?')[0]==url and s!=url and s.split('lumisco.re/')[1][:2]==url.split('lumisco.re/')[1][:2]]
  desc=text.split('Over dit boek',1)[-1] if 'Over dit boek' in text else text.split('About this book',1)[-1] if 'About this book' in text else None
  report.append({'url':url,'cohorts':[n for n,a in [('excluded-30',cohort),('priority-12',priorities)] if url in a],'status':r.get('status'),'finalUrl':r.get('finalUrl'),'canonical':can,'robots':[t['value'] for t in h.get('tags',[]) if t['kind']=='robots'],'headValid':not h.get('invalidHeadElements') and not h.get('relevantOutsideHead'),'h1':h.get('h1'),'mainWords':len(text.split()),'mainText':text,'descriptionSectionObserved':desc,'inSitemap':'<loc>'+url+'</loc>' in sitemap,'sameLanguageInlinks':inbound,'observedHomePath':path(url),'sourceFile':r.get('file'),'sha256':r.get('sha256'),'ttfbMs':r.get('ttfbMs'),'totalMs':r.get('totalMs'),'error':r.get('error')})
 result={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'productionSha':args.sha,'sourceHashes':{str(f):hashlib.sha256(f.read_bytes()).hexdigest() for f in files},'boundaries':{'cohort':len(cohort),'priorities':len(priorities),'uniqueTargets':len(targets),'documents':len(rows),'extraHubCap':100,'parallelism':2,'noInlink':'Not observed in bounded graph, not proven orphan','googleStatus':'Historical GSC status reused; HTTP does not prove current indexing','ua':head.UAS['desktop'],'timing':'Network GET timing; no verified cold cache, no browser paint/CrUX'},'targets':report,'documents':[{'url':u,**{k:r.get(k) for k in ['status','finalUrl','html','links','sha256','file','ttfbMs','totalMs','mainText']}} for u,r in rows.items()]}
 (out/'audit.json').write_text(json.dumps(result,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'targets':len(report),'documents':len(rows),'statuses':{s:sum(r['status']==s for r in report) for s in [200,404,500]},'withInlinks':sum(bool(r['sameLanguageInlinks']) for r in report),'withHomePath':sum(bool(r['observedHomePath']) for r in report)}))
if __name__=='__main__':main()
