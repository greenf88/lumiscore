"""Read-only derivation from saved GSC and scoped Vercel aggregates; Google IP verification."""
import csv,datetime,hashlib,ipaddress,json,sys,urllib.request,zipfile
from pathlib import Path
from zoneinfo import ZoneInfo
root=Path(__file__).resolve().parents[2];out=root/'outputs/seo-cause-20261104';report=root/'reports/seo-cause-20261104'
src=Path('C:/Users/rickg/.codex/.chatgpt-projects/g-p-6a88a9eeda5c819181702eb71c430b4d/social-media/search-console')
def read(p):return json.loads(p.read_text(encoding='utf-8-sig'))
def save(p,o):p.write_bytes((json.dumps(o,ensure_ascii=False,indent=2)+'\n').encode('utf-8'))
manifest=read(src/'20261102/manifest.json');proof=[]
for row in manifest['exports']:
 p=src/'20261102'/row['file'];digest=hashlib.sha256(p.read_bytes()).hexdigest();assert digest==row['sha256'];proof.append({'file':str(p),'sha256':digest,'entries':zipfile.ZipFile(p).namelist()})
url='https://developers.google.com/static/crawling/ipranges/common-crawlers.json'
raw=urllib.request.urlopen(url,timeout=15).read();ranges=json.loads(raw);nets=[ipaddress.ip_network(p.get('ipv4Prefix',p.get('ipv6Prefix'))) for p in ranges['prefixes']]
(out/'google-common-crawlers-current.json').write_bytes(raw)
ips=read(out/'google-source-ips.json')['data']['summary'];verified=[]
for r in ips:
 ip=r.get('clientIp');match=next((str(n) for n in nets if ip and ipaddress.ip_address(ip) in n),None)
 verified.append({'ip':ip if match else None,'unverifiedIpSha256':hashlib.sha256(str(ip).encode()).hexdigest() if not match else None,'providerVerified':r.get('botVerified'),'googleCommonCrawlerRange':match,'count':r['vercel_request_count_count']})
save(report/'google-ip-verification.json',{'checkedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'method':'Current official common-crawler CIDR list; no UA-only identity claim. Current ranges do not prove October historical allocations. Non-matching IPs redacted.','source':url,'sourceSha256':hashlib.sha256(raw).hexdigest(),'listCreationTime':ranges.get('creationTime'),'groups':verified,'total':sum(r['count'] for r in verified),'matchedCurrentRanges':sum(r['count'] for r in verified if r['googleCommonCrawlerRange'])})
day=read(out/'google-day-status.json')['data']['data'];stats={}
for r in day:
 d=r['timestamp'][:10];s=stats.setdefault(d,{'200':0,'308':0,'404':0,'other':0});s[r['httpStatus'] if r['httpStatus'] in s else 'other']+=r['vercel_request_count_count']
gsc={}
for f,kind in [(src/'20261102/raw/prestaties-28dagen/Diagram.csv','performance'),(src/'20261102/raw/crawlstatistieken/Overzichtsdiagram crawlstatistieken.csv','crawl')]:
 rows=list(csv.DictReader(f.read_text(encoding='utf-8-sig').splitlines()))
 for r in rows:
  d=r['Datum']
  if d<'2026-10-18':continue
  item=gsc.setdefault(d,{'date':d,'vercelRequestDayUTC':stats.get(d)})
  if kind=='performance':item.update(clicks=int(r['Aantal klikken']),impressions=int(r['Vertoningen']))
  else:item.update(gscCrawlRequests=int(r['Totaal aantal crawlverzoeken']),gscAvgResponseMs=int(r['Gemiddelde reactietijd (ms)']))
save(report/'gsc-and-requests-daily.json',{'timeBasis':'GSC performance: America/Los_Angeles. Crawl CSV day timezone not independently verified; kept as reported. Vercel: UTC. Never treat these day totals as the same 24-hour window.','rows':list(gsc.values()),'weeklyGscTotals':read(src/'20261102/analyse.json')['period_comparison'],'exports':proof})
print(json.dumps({'ipGroups':len(verified),'requests':sum(r['count'] for r in verified),'ipRangeMatched':sum(r['count'] for r in verified if r['googleCommonCrawlerRange']),'days':len(gsc)}))
