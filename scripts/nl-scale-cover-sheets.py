"""Decode exact archived cover bytes; small internal review sheets, no image approval."""
import json,hashlib,math,sys,re
from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
base=Path(__file__).resolve().parents[1]
root=base/'catalog/nl-scale-20261102'
cache=base/'.research-cache/nl-scale-20261102/covers'
requested=[x for x in sys.argv[1:] if re.fullmatch(r'--v(?:[2-9]|[1-9][0-9])',x)]
if len(requested)>1:raise ValueError('One output revision only')
version=requested[0][1:] if requested else ''
large='--large' in sys.argv
if large and version:raise ValueError('Large source has its own output namespace')
if large:version='-large'
out=base/('outputs/nl-scale-20261102/covers'+version)
out.mkdir(parents=True,exist_ok=True)
rows=json.loads((root/'cover-archive-readback.json').read_text(encoding='utf8'))
if (root/'cover-tar-readback.json').exists():
    rows+=json.loads((root/'cover-tar-readback.json').read_text(encoding='utf8'))
if version and (root/'cover-archive-v2-readback.json').exists():
    rows+=json.loads((root/'cover-archive-v2-readback.json').read_text(encoding='utf8'))
rows=list({r['coverId']:r for r in rows if r.get('sha256')}.values())
if large:rows=json.loads((root/'cover-large-bulk-v2-readback.json').read_text(encoding='utf8'))
suffix='-large' if large else ''
targets=json.loads((root/'cover-review-targets.json').read_text(encoding='utf8'))['targets']
decoded=[]
for r in rows:
    path=cache/f"{r['coverId']}{suffix}.jpg"
    if not path.exists():continue
    raw=path.read_bytes()
    if hashlib.sha256(raw).hexdigest()!=r['sha256']:raise ValueError('Changed cached member')
    try:
        with Image.open(path) as im:
            im.load()
            if min(im.size)<50:raise ValueError('Tiny image / placeholder')
            decoded.append({**r,'decoded':True,'dimensions':list(im.size),'format':im.format})
    except Exception as ex:decoded.append({**r,'decoded':False,'error':str(ex)})
(root/('cover-decode-results'+version+'.json')).write_text(json.dumps(decoded,ensure_ascii=False,indent=2),encoding='utf8')
font_path='C:/Windows/Fonts/arial.ttf'
font=ImageFont.truetype(font_path,14)
small=ImageFont.truetype(font_path,12)
for start in range(0,len(decoded),16):
    group=decoded[start:start+16]
    sheet=Image.new('RGB',(1080,400*math.ceil(len(group)/4)),(244,244,244))
    draw=ImageDraw.Draw(sheet)
    for n,r in enumerate(group):
        x=(n%4)*270;y=(n//4)*400
        draw.text((x+6,y+4),r['candidateId'],font=font,fill='black')
        draw.text((x+6,y+24),r.get('title','')[:34],font=small,fill='black')
        draw.text((x+6,y+40),str(r['coverId'])+' | '+str(r['bytes'])+'B',font=small,fill='black')
        if not r['decoded']:continue
        with Image.open(cache/f"{r['coverId']}{suffix}.jpg") as im:
            im=im.convert('RGB');im.thumbnail((250,325))
            sheet.paste(im,(x+(270-im.width)//2,y+62))
    sheet.save(out/f"sheet-{start//16+1:03}.jpg",quality=90)
print(json.dumps({'receiptRows':len(rows),'decoded':sum(r['decoded']for r in decoded),'semanticApproval':False,'sheets':math.ceil(len(decoded)/16)}))
