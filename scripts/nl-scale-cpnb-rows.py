"""Extract bibliographic ranking facts by table coordinates; never invent glyphs."""
import json,re,collections
from pathlib import Path
base=Path(__file__).resolve().parents[1]
folder=base/'outputs/nl-scale-20261102/cpnb'
all_rows=[];quality=[]
for path in sorted(folder.glob('20*-*.json')):
    d=json.loads(path.read_text(encoding='utf8'));source=d['source'];rows={}
    for page in d['pages']:
        words=page['words']
        anchors=[w for w in words if re.fullmatch(r'\d{1,3}',w['text']) and 29<=w['x0']<=65 and 50<w['top']<800 and 1<=int(w['text'])<=100]
        left=min((w['x0'] for w in anchors),default=39)+10
        starts=collections.Counter()
        for rank in anchors:
            line=sorted([w for w in words if abs(w['top']-rank['top'])<5.5 and w['x0']>=left],key=lambda w:w['x0'])
            for i,w in enumerate(line):
                if i and 290<w['x0']<460 and w['x0']-line[i-1]['x1']>8 and not re.fullmatch(r'[\d.,€�-]+',w['text']):starts[round(w['x0'])]+=1
        publisher=starts.most_common(1)[0][0] if starts else (356 if source['signal']=='retail_sales_rank' else 400)
        for rank in sorted(anchors,key=lambda w:w['top']):
            number=int(rank['text'])
            if number in rows or number!=len(rows)+1:continue
            line=sorted([w for w in words if abs(w['top']-rank['top'])<5.5 and left<=w['x0']<publisher-1],key=lambda w:w['x0'])
            markers=[i for i,w in enumerate(line)if w['text']in('�','•','●')]
            if len(markers)!=1:
                following=min((a['top'] for a in anchors if a['top']>rank['top']+3),default=rank['top']+45)
                extra=sorted([w for w in words if rank['top']+3<w['top']<min(following-3,rank['top']+35) and left<=w['x0']<publisher-1],key=lambda w:(round(w['top']/3),w['x0']))
                rows[number]={'position':number,'title':None,'author':None,'raw':' '.join(w['text']for w in line+extra),'parseStatus':'manual_review_missing_separator','page':page['page']}
                continue
            marker=markers[0];title=' '.join(w['text']for w in line[:marker]).strip();author=' '.join(w['text']for w in line[marker+1:]).strip()
            rows[number]={'position':number,'title':title,'author':author,'raw':' '.join(w['text']for w in line),'parseStatus':'wrapped_row_manual_review'if not(title and author) else 'glyph_corroboration_required'if'�'in(title+author)else'extracted_fact','page':page['page']}
        if len(rows)==100:break
    if set(rows)!=set(range(1,101)):raise ValueError(f"Incomplete ranking extraction {path.name}: {len(rows)}")
    for row in rows.values():
        row.update({'signal':source['signal'],'year':source['year'],'country':'Netherlands','sourceUrl':source['url'],'sourceSha256':source['sha256'],'checkedAt':source['checkedAt'],'notEditionProof':True,'notUniqueReaders':True})
        all_rows.append(row)
    quality.append({'year':source['year'],'signal':source['signal'],'rows':len(rows),'manual':sum(r['parseStatus']!='extracted_fact'for r in rows.values())})
output=base/'catalog/nl-scale-20261102/sources/cpnb-ranking-facts.json'
output.write_text(json.dumps({'facts':all_rows,'quality':quality,'method':'Coordinates and actual positions 1..100, source title/author delimiter. Font replacement glyphs are not guessed; exact identity requires corroboration. Sales and loan events remain separate; editions may be aggregated in source.'},ensure_ascii=False,indent=2),encoding='utf8')
print(json.dumps({'rows':len(all_rows),'quality':quality},ensure_ascii=False))
