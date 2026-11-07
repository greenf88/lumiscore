"""Actual candidate original bytes; public production metadata read-only.
Optional providers fail only inside the local harness. UA simulations only.
"""
import json,urllib.request,urllib.error,hashlib
from pathlib import Path
import importlib.util
spec=importlib.util.spec_from_file_location('metadata_head',Path(__file__).with_name('audit-metadata-head.py'))
parser=importlib.util.module_from_spec(spec);spec.loader.exec_module(parser)
inspect,UAS=parser.inspect,parser.UAS

out=Path('outputs/seo-reliability-20261107/readonly-http');(out/'responses').mkdir(parents=True,exist_ok=True)
audit=Path('C:/Users/rickg/Documents/Codex/2026-09-30/seo-check/work/excluded-books-lumiscore-2026-11-07.json')
excluded=[r['url'].replace('https://lumisco.re','') for r in json.loads(audit.read_text(encoding='utf-8-sig'))['rows']]
cases=[(p,'excluded')for p in excluded]+[(p,'indexable')for p in ['/en','/nl','/en/browse','/en/browse?page=2','/nl/browse','/en/book/1','/nl/book/10472','/nl/collection/suzanne-vermeer','/nl/toplijsten/na-project-hail-mary']]+[('/en/book/999999999','missing'),('/nl/book/999999999','missing'),('/en/search?q=book','private'),('/nl/login','private')]
rows=[]
for path,kind in cases:
 for ua in ['desktop','googlebot']:
  req=urllib.request.Request('http://127.0.0.1:45432'+path,headers={'User-Agent':UAS[ua]})
  try:r=urllib.request.urlopen(req,timeout=30)
  except urllib.error.HTTPError as e:r=e
  raw=r.read();html=inspect(raw);tags=html['tags'];can=[t for t in tags if t['kind']=='canonical'];alts=[t for t in tags if t['kind']=='hreflang'];robots=[t['value']for t in tags if t['kind']=='robots'];text=raw.decode('utf-8','replace')
  assert not html['relevantOutsideHead'],(path,'outside head')
  assert not html['duplicateKinds'],(path,html['duplicateKinds'])
  if kind=='indexable':
   assert r.status==200,(path,r.status)
   assert len(can)==1 and can[0]['value']=='https://lumisco.re'+path,(path,can)
   assert not any('noindex'in v for v in robots),(path,robots)
   assert len(html['h1'])==1,(path,html['h1'])
  elif kind in ['excluded','missing']:
   assert r.status==(404 if kind=='missing'else 200),(path,r.status)
   assert not can and not alts,(path,can,alts)
   assert any('noindex'in v for v in robots),(path,robots)
   assert not __import__('re').search(r'"@type"\s*:\s*"Book"',text),(path,'Book schema')
  else:assert any('noindex'in v and 'follow'in v for v in robots),(path,robots)
  key=hashlib.sha256((path+ua).encode()).hexdigest()[:18];(out/'responses'/f'{key}.html').write_bytes(raw)
  rows.append({'path':path,'kind':kind,'ua':ua,'requestUserAgent':UAS[ua],'status':r.status,'canonical':can,'hreflang':alts,'robots':robots,'h1':html['h1'],'sha256':hashlib.sha256(raw).hexdigest(),'file':f'responses/{key}.html'})
(out/'matrix.json').write_text(json.dumps({'method':__doc__,'requests':len(rows),'excludedUrls':len(excluded),'rows':rows},ensure_ascii=False,indent=2),encoding='utf-8')
print(json.dumps({'requests':len(rows),'excludedUrls':len(excluded),'allPassed':True}))
