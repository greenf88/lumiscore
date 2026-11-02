"""Bounded read-only GET audit: original bytes and parser positions, never browser repair."""
import argparse, concurrent.futures, hashlib, json, time, urllib.request, urllib.error
from html.parser import HTMLParser
from pathlib import Path

UAS={
 'desktop':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/142.0.0.0 Safari/537.36',
 'mobile':'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1',
 'googlebot':'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)',
 'inspection':'Mozilla/5.0 (compatible; Google-InspectionTool/1.0;)',
 'bingbot':'Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)',
}
HEADERS={'content-type','cache-control','age','vary','x-robots-tag','link','server-timing','x-vercel-cache','x-vercel-id','location','etag','content-encoding'}
class Document(HTMLParser):
 def __init__(self,text):
  super().__init__(convert_charrefs=True);self.text=text;self.lines=text.splitlines(keepends=True);self.starts=[];self.ends=[];self.tags=[];self.head=False;self.body=False;self.template=0;self.current=None;self.titles=[];self.h1=[]
 def pos(self):
  line,col=self.getpos();return len((''.join(self.lines[:line-1])+self.lines[line-1][:col]).encode('utf-8'))
 def handle_starttag(self,t,attrs):
  a=dict(attrs);at=self.pos()
  if t=='head':self.head=True;self.starts.append(at)
  if t=='body':self.body=True
  if t=='template':self.template+=1
  effective_head=self.head and not self.body and self.template==0
  if t in ('title','h1'):self.current={'kind':t,'offset':at,'inHead':effective_head,'text':''}
  kind='canonical' if t=='link' and a.get('rel')=='canonical' else 'hreflang' if t=='link' and a.get('rel')=='alternate' and a.get('hreflang') else a.get('name',a.get('property')) if t=='meta' else None
  if kind in ('canonical','hreflang','description','robots','googlebot','og:title','og:description','og:url','og:image','twitter:card','twitter:image'):
   self.tags.append({'kind':kind,'offset':at,'inHead':effective_head,'afterBody':self.body,'value':a.get('href',a.get('content')),'hreflang':a.get('hreflang')})
 def handle_endtag(self,t):
  if t=='head':self.ends.append(self.pos());self.head=False
  if t=='template':self.template=max(0,self.template-1)
  if t in ('title','h1') and self.current and self.current['kind']==t:
   (self.titles if t=='title' else self.h1).append(self.current);self.current=None
 def handle_data(self,s):
  if self.current:self.current['text']+=s

def inspect(raw):
 text=raw.decode('utf-8','replace');p=Document(text);p.feed(text)
 return {'headOpen':p.starts,'headClose':p.ends,'title':p.titles,'h1':p.h1,'tags':p.tags,'byteHeadClose':p.ends[0] if p.ends else -1,'naiveByteHeadClose':raw.lower().find(b'</head>'),'relevantOutsideHead':[t for t in p.tags+p.titles if not t['inHead']],'duplicateKinds':{**{k:sum(t['kind']==k for t in p.tags) for k in ['canonical','description','robots','og:title','og:image'] if sum(t['kind']==k for t in p.tags)>1},**({'title':len(p.titles)} if len(p.titles)>1 else {})}}

class Redirects(urllib.request.HTTPRedirectHandler):
 def __init__(self):super().__init__();self.chain=[]
 def redirect_request(self,req,fp,code,msg,headers,newurl):
  self.chain.append({'url':req.full_url,'status':code,'location':newurl});return super().redirect_request(req,fp,code,msg,headers,newurl)

def get(origin,path,ua,output,repeat):
 url=origin.rstrip('/')+path;key=hashlib.sha256((url+ua+str(repeat)).encode()).hexdigest()[:18];r={'url':url,'ua':ua,'requestUserAgent':UAS[ua],'attempt':repeat,'cacheCondition':'First observed request, not verified cold' if repeat==0 else 'Repeated request; caches not cleared'};redirects=Redirects();opener=urllib.request.build_opener(redirects);started=time.perf_counter();raw=b'';chunks=[]
 try:
  try:response=opener.open(urllib.request.Request(url,headers={'User-Agent':UAS[ua],'Accept':'text/html','Accept-Encoding':'identity'}),timeout=30)
  except urllib.error.HTTPError as e:response=e
  r.update(status=response.status,finalUrl=response.url,headers={k.lower():v for k,v in response.headers.items() if k.lower() in HEADERS},redirects=redirects.chain,ttfbMs=(time.perf_counter()-started)*1000)
  with response:
   while True:
    b=response.read1(4096)
    if not b:break
    raw+=b;chunks.append({'bytes':len(raw),'ms':(time.perf_counter()-started)*1000})
    if len(raw)>5000000:raise ValueError('Response cap5MB; not a complete response')
  r.update(totalMs=(time.perf_counter()-started)*1000,bytes=len(raw),sha256=hashlib.sha256(raw).hexdigest(),complete=True,html=inspect(raw),chunks=chunks)
  def arrival(offset):return next((c['ms'] for c in chunks if c['bytes']>offset),None)
  r['headReceivedMs']=arrival(r['html']['byteHeadClose']+7) if r['html']['byteHeadClose']>=0 else None
  r['firstH1SourceMs']=arrival(r['html']['h1'][0]['offset']) if r['html']['h1'] else None
  file='responses/'+key+'.html';(output/file).write_bytes(raw);r['file']=file
 except Exception as e:r['error']=str(e)[:240]
 return r

if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('--origin',default='https://lumisco.re');p.add_argument('--output',required=True);p.add_argument('--paths',nargs='+',default=['/nl','/en']);p.add_argument('--uas',nargs='+',choices=list(UAS),default=list(UAS));p.add_argument('--repeat',type=int,default=1);a=p.parse_args();out=Path(a.output);(out/'responses').mkdir(parents=True,exist_ok=True)
 jobs=[(path,ua,n) for path in a.paths for ua in a.uas for n in range(a.repeat)]
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:rows=list(pool.map(lambda j:get(a.origin,*j[:2],out,j[2]),jobs))
 report={'origin':a.origin,'method':'Original complete GET bytes plus HTMLParser token locations. UA simulations do not authenticate a real crawler; firstH1SourceMs is not browser paint. No cookies, writes or cache clearing. Headers limited to non-sensitive diagnostics.','rows':rows}
 (out/'responses.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps({'requests':len(rows),'outsideHead':{ua:sum(bool(r.get('html',{}).get('relevantOutsideHead')) for r in rows if r['ua']==ua) for ua in a.uas},'errors':[{'url':r['url'],'error':r['error']} for r in rows if r.get('error')]},ensure_ascii=False))
