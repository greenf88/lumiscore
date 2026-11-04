"""Manual postdeployment check; no scheduler or GSC requests. No cookies/secrets."""
import argparse,datetime,importlib.util,json,pathlib,re,sys
sys.dont_write_bytecode=True
root=pathlib.Path(__file__).resolve().parents[2]
spec=importlib.util.spec_from_file_location('audit',root/'scripts/audit-metadata-head.py');a=importlib.util.module_from_spec(spec);spec.loader.exec_module(a)
p=argparse.ArgumentParser();p.add_argument('--sha',required=True);p.add_argument('--deployment',required=True);p.add_argument('--output',required=True);args=p.parse_args()
if not re.fullmatch('[0-9a-f]{40}',args.sha) or not re.fullmatch('dpl_[A-Za-z0-9]+',args.deployment):p.error('Exact externally verified production SHA and deployment required')
out=pathlib.Path(args.output);(out/'responses').mkdir(parents=True,exist_ok=True)
paths=['/nl','/en','/nl/book/7220','/en/book/8856','/nl/collection/suzanne-vermeer','/nl/toplijsten/fantasy-om-mee-te-beginnen','/nl/toplijsten/na-project-hail-mary','/book/8856?returnTo=%2Fbrowse%3Fpage%3D2']
rows=[]
for path in paths:
 for ua in ['desktop','mobile','googlebot','inspection']:
  r=a.get('https://lumisco.re',path,ua,out,0);rows.append(r)
  assert not r.get('error'),r
  assert r['status']==200,r['url'];h=r['html'];c=[x for x in h['tags'] if x['kind']=='canonical'];assert len(c)==1 and c[0]['inHead'],r['url'];assert c[0]['value']=='https://lumisco.re'+r['finalUrl'].split('lumisco.re',1)[1].split('?')[0],r['url']
  assert not h['invalidHeadElements'] and not h['relevantOutsideHead'] and not h['duplicateKinds'],r['url']
  assert not any('noindex' in t['value'] for t in h['tags'] if t['kind']=='robots'),r['url']
  logical=r['finalUrl'].split('lumisco.re',1)[1].split('?')[0][3:]
  assert {t['hreflang']:t['value'] for t in h['tags'] if t['kind']=='hreflang'}=={'en':'https://lumisco.re/en'+logical,'nl-NL':'https://lumisco.re/nl'+logical,'x-default':'https://lumisco.re/en'+logical},r['url']
  if path.startswith('/book/'):assert len(r['redirects'])==1 and r['redirects'][0]['status']==308
report={'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'reportedProductionSha':args.sha,'reportedDeployment':args.deployment,'identityBoundary':'Caller verifies active custom-domain mapping before/after. This unauthenticated script does not infer SHA from HTML. UA simulations are not real crawlers; source H1 timing is not paint.','rows':rows}
(out/'responses.json').write_bytes((json.dumps(report,ensure_ascii=False,indent=2)+'\n').encode());print(json.dumps({'responsesPassed':len(rows),'sha':args.sha}))
