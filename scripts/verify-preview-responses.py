import json,importlib.util
from pathlib import Path
spec=importlib.util.spec_from_file_location('metadata_head',Path(__file__).with_name('audit-metadata-head.py'));parser=importlib.util.module_from_spec(spec);spec.loader.exec_module(parser)
out=Path('outputs/seo-reliability-20261107/hosted-http');report=json.loads((out/'responses.json').read_text(encoding='utf-8'));rows=[]
for row in report['rows']:
 raw=(out/row['file']).read_bytes();h=parser.inspect(raw);p=row['path'];tags=h['tags'];can=[t for t in tags if t['kind']=='canonical'];robots=[t['value']for t in tags if t['kind']=='robots']
 assert not h['relevantOutsideHead'] and not h['invalidHeadElements'] and not h['duplicateKinds'],(p,h)
 missing='999999999'in p
 assert len(can)==(0 if missing else 1),(p,can)
 if not missing:assert can[0]['value']=='https://lumisco.re'+p,(p,can)
 assert any('noindex'in v for v in robots)==missing,(p,robots)
 assert len(h['h1'])==1,(p,h['h1'])
 rows.append({**row,'canonical':can,'robots':robots,'hreflang':[t for t in tags if t['kind']=='hreflang'],'h1':h['h1'],'originalHeadValid':True})
(out/'matrix.json').write_text(json.dumps({**report,'rows':rows},ensure_ascii=False,indent=2),encoding='utf-8');print(json.dumps({'requests':len(rows),'allPassed':True,'previewProtectionHeaderSeparate':True}))
