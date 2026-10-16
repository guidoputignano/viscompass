"""Read frozen R5; write private, exact-value dashboard section artifacts.

No workbook authoring or analytical recalculation. Files must be outside the
public checkout. All numeric data stays in private output paths, never Git.
"""
from pathlib import Path
from zipfile import ZipFile
from lxml import etree as E
from collections import defaultdict
from decimal import Decimal
import argparse,json,hashlib,re

ROOT=Path(__file__).resolve().parents[1]
N={'m':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
PIN='f8fe8b13f10eab51194b057f52dd11a599d28d827ce92438b1043837c60894bb'
BLOCKED={'O-17-06/08':'I segnali di revisione sono trattenuti fino alla disposizione registrata per ciascuno (F-05).',
         'O-17-03':'Le serie trattenute richiedono la disposizione registrata prima della pubblicazione (F-05).',
         'O-14-09':'Controllo tecnico di divulgazione: nessuna cifra aziendale da visualizzare.',
         'T-C3-14':'Contesto, non confrontabile: non viene pubblicato il ponte numerico tra ledger e AIFA.',
         'ML-3-ND':'DD, DPC e tutti i canali: in attesa dei conteggi reali di persone distinte.',
         'O-11-04':'Due valori HHI attendono la disposizione della verifica numerica. Nessuna classifica di concentrazione è pubblicata.'}
OVERRIDES={
 'O-09-08':['08_Spend_Overview!A6:K106'],
 'O-11-01':['09_Composition!A9:AB18','09_Composition!A22:AB50'],
 # ATC1 has four periods through AB; ATC2 K1/K2 are distinct tables.
 # Do not truncate the ATC1 fourth share/adjustments to the old map's M column,
 # or plot both ATC levels and repeated headings as one observation series.
 'O-11-02':['09_Composition!A55:AB73','09_Composition!A76:M91','09_Composition!A93:M108'],
 'O-11-03':['09_Composition!A9:AB18','09_Composition!A22:AB50','09_Composition!A55:AB73','09_Composition!A76:M91','09_Composition!A93:M108'],
 'O-11-05':['09_Composition!A9:AB18','09_Composition!A22:AB50','09_Composition!A55:AB73','09_Composition!A76:M91','09_Composition!A93:M108'],
 'O-12-04':['10_Change_Contributions!A208:Q228','10_Change_Contributions!A230:Q252','10_Change_Contributions!A256:Q276','10_Change_Contributions!A278:Q300'],
 'O-12-06':['10_Change_Contributions!A10:AA30','10_Change_Contributions!A35:AA55'],
 'O-16-04':['16_Budget_Variance!A502:U506'],
}

def ci(s):
    n=0
    for x in s:n=n*26+ord(x)-64
    return n
def letters(n):
    s=''
    while n:n,r=divmod(n-1,26);s=chr(65+r)+s
    return s
def bounds(r):
    m=re.fullmatch(r'([A-Z]+)(\d+):([A-Z]+)(\d+)',r)
    if not m:raise ValueError('Unregistered range: '+r)
    a,b,c,d=m.groups();return ci(a),int(b),ci(c),int(d)
def text(v):return '' if v is None else str(v[0] if isinstance(v,list) else v)
def section(oid,sheet):
    if oid in ('O-10-06','O-10-06/20','PC-20'):return 'priorita'
    if oid in ('O-03-01','O-03-03','PC-03-C3','SRC-DEF-01'):return 'evidenza'
    if sheet.startswith('08_'):return 'spesa'
    if sheet.startswith('09_'):return 'composizione'
    if sheet.startswith(('04_','05_','05A_','06_','07_')):return 'attribuzione'
    if sheet.startswith('10_'):return 'cambiamento'
    if sheet.startswith(('11_','12_','12A_')):return 'costi'
    if sheet.startswith('13_') or oid=='T-C3-14':return 'confronti'
    if sheet.startswith(('13A_','14_','14A_')):return 'attivita'
    if sheet.startswith('14B_'):return 'numerosita'
    if sheet.startswith(('15','16')):return 'pianificazione'
    if sheet.startswith('17_'):return 'tendenze'
    if sheet.startswith('18'):return 'previsione'
    if sheet.startswith('19_'):return 'sensibilita'
    if sheet.startswith('20_'):return 'priorita'
    return 'evidenza'

def read_book(file):
    with ZipFile(file) as z:
        strings=[''.join(t.itertext()) for t in E.fromstring(z.read('xl/sharedStrings.xml'))]
        wb=E.fromstring(z.read('xl/workbook.xml'));styles=E.fromstring(z.read('xl/styles.xml'))
        from openpyxl.styles.numbers import BUILTIN_FORMATS
        formats=dict(BUILTIN_FORMATS)
        for t in styles.find('m:numFmts',N):formats[int(t.get('numFmtId'))]=t.get('formatCode')
        xfs=[int(t.get('numFmtId')) for t in styles.find('m:cellXfs',N)]
        headerstyles={i for i,t in enumerate(styles.find('m:cellXfs',N)) if t.get('fillId')=='2'}
        sheets={}
        for i,s in enumerate(wb.find('m:sheets',N),1):
            name=s.get('name')
            if name in ('F_Fatti','F_Mesi'):continue
            root=E.fromstring(z.read(f'xl/worksheets/sheet{i}.xml'));cells={};headers={}
            for c in root.findall('.//m:sheetData/m:row/m:c',N):
                v=c.find('m:v',N);typ=c.get('t');value=None if v is None else v.text
                if typ=='s' and value is not None:value=strings[int(value)]
                elif typ=='inlineStr':value=''.join(c.find('m:is',N).itertext())
                elif typ=='e':raise ValueError('Cached error '+name+'!'+c.get('r'))
                elif typ not in ('str','b') and value is not None:value=[value,xfs[int(c.get('s','0'))]]
                cells[c.get('r')]=value
                if int(c.get('s','0')) in headerstyles and value is not None:headers[c.get('r')]=True
            header_values={k:cells[k] for k in headers}
            for merge in root.findall('m:mergeCells/m:mergeCell',N):
                l,t,r,b=bounds(merge.get('ref'))
                anchor=f'{letters(l)}{t}'
                if anchor in headers and t==b:
                    for c in range(l,r+1):header_values[f'{letters(c)}{t}']=cells[anchor]
            cells['__headers__']=headers;cells['__header_values__']=header_values;sheets[name]=cells
        return sheets,{str(k):v for k,v in formats.items()}

def make_table(sheet,ref,cells,formats):
    left,top,right,bottom=bounds(ref)
    data=[];rownums=[]
    for row in range(top,bottom+1):
        values=[cells.get(f'{letters(c)}{row}') for c in range(left,right+1)]
        if any(v is not None for v in values):data.append(values);rownums.append(row)
    # Preserve heading rows rather than guessing away notes/multi-row headers.
    # Charts and local facets use one explicit header row selected below.
    def score(row,source_row):
        labels=[v for v in row if isinstance(v,str) and v.strip()]
        numbers=sum(isinstance(v,list) for v in row)
        styled=sum(f'{letters(left+c)}{source_row}' in cells['__headers__'] for c in range(right-left+1))
        return styled*20+len(labels)*2-numbers*3-(8 if any(len(v)>150 for v in labels) else 0)
    candidates=list(range(min(5,len(data))))
    header=max(candidates,key=lambda i:(score(data[i],rownums[i]),i)) if candidates else 0
    headings=[]
    for i,v in enumerate(data[header] if data else []):
        parts=[]
        for previous in range(max(top,rownums[header]-2),rownums[header]):
            label=text(cells['__header_values__'].get(f'{letters(left+i)}{previous}'))
            if label and label not in parts and len(label)<100:parts.append(label)
        current=text(v)
        if current and current not in parts:parts.append(current)
        headings.append(' · '.join(parts) or letters(left+i))
    # Technical selector keys remain in exact tables but not automatic charts.
    numbercols=[]
    for c,h in enumerate(headings):
        if re.search(r'(?i)crit\.|^(?:anno|year|codice|id|chiave|pagina|indice riga|ordine|mese|rango)(?:$|\s)',h) and not re.search(r'€|quota|spesa|righe|somma|costo',h,re.I):continue
        vals=[r[c] for r in data[header+1:] if r[c] is not None]
        if vals and sum(isinstance(v,list) for v in vals)>=max(1,len(vals)*.25):numbercols.append(c)
    # Avoid rendering controls/notes as observations: keep leading metadata in
    # a separate reader area and preserve their source addresses.
    return {'sheet':sheet,'range':ref,'startColumn':left,'columns':headings,'headerRow':rownums[header] if rownums else top,
       'rows':data[header+1:],'sourceRows':rownums[header+1:],
       'notes':[[rownums[i],[text(v) for v in data[i]]] for i in range(header)],'numericColumns':numbercols}

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--workbook',type=Path,required=True);ap.add_argument('--out',type=Path,required=True);ap.add_argument('--inventory-only',action='store_true');args=ap.parse_args()
    file=args.workbook.resolve();out=args.out.resolve()
    if out==ROOT or ROOT in out.parents:raise ValueError('Private output cannot be inside public checkout')
    assert hashlib.sha256(file.read_bytes()).hexdigest()==PIN,'Frozen R5 identity mismatch'
    out.mkdir(parents=True,exist_ok=True);sheets,formats=read_book(file)
    mappings=[];excluded=[];mapcells=sheets['23_Dashboard_Map']
    for row in range(5,95):
        r=[mapcells.get(f'{letters(c)}{row}') for c in range(1,15)]
        if not r[0]:continue
        oid,title,tier,state,rule,sheet,ref,proposed,grain,ready,v1,v2,public,note=map(text,r)
        refs=OVERRIDES.get(oid) or [sheet+'!'+ref]
        item={'id':oid,'title':title,'section':section(oid,sheet),'tier':tier,'qualifier':note,
          'grain':grain,'ranges':refs,'availability':'withheld' if oid in BLOCKED else 'snapshot',
          'reason':BLOCKED.get(oid),'sourceState':ready}
        if oid in BLOCKED:excluded.append(item)
        else:mappings.append(item)
    assert len(mappings)+len(excluded)==90 and len({m['id'] for m in mappings+excluded})==90,(len(mappings),'unexpected workbook map')
    (out/'EXCLUDED_INTERNAL.json').write_text(json.dumps(excluded,ensure_ascii=False,indent=2),encoding='utf8')
    (out/'output-map.json').write_text(json.dumps(mappings,ensure_ascii=False,indent=2),encoding='utf8')
    if args.inventory_only:
        for m in mappings:
            print(m['id'],m['section'],m['availability'],m['ranges'])
        return
    groups=defaultdict(list)
    for m in mappings:
        tables=[]
        if m['availability']=='snapshot':
            for scope in m['ranges']:
                sheet,ref=scope.split('!',1)
                tables.append(make_table(sheet,ref,sheets[sheet],formats))
        groups[m['section']].append({**m,'tables':tables})
    digest={}
    for group,outputs in groups.items():
        payload={'schema':'pillar-c-workbook-section-v1','workbookSha256':PIN,'section':group,'formats':formats,'outputs':outputs}
        raw=json.dumps(payload,ensure_ascii=False,separators=(',',':')).encode();h=hashlib.sha256(raw).hexdigest()
        (out/f'{group}.json').write_bytes(raw);digest[group]={'sha256':h,'bytes':len(raw),'outputs':len(outputs)}
    index={'schema':'pillar-c-workbook-index-v1','workbookSha256':PIN,'outputs':mappings,'sections':digest}
    raw=json.dumps(index,ensure_ascii=False,separators=(',',':')).encode();(out/'index.json').write_bytes(raw)
    digest['index']={'sha256':hashlib.sha256(raw).hexdigest(),'bytes':len(raw)}
    (out/'DIGESTS.json').write_text(json.dumps(digest,indent=2),encoding='utf8')
    print(json.dumps(digest))
if __name__=='__main__':main()
