"""Read official reconstructed population; reconcile age, sex and geography totals."""
import csv
import hashlib
import io
import json
import re
import zipfile
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sources=[]

def read(area):
    path=ROOT/f'data/raw/istat-reconstruction/PopolazioneEta-Territorio-{area}.zip'
    raw=path.read_bytes()
    sources.append({'file':path.name,'sha256':hashlib.sha256(raw).hexdigest(),
                    'url':f'https://demo.istat.it/data/ricostruzione/{path.name}'})
    z=zipfile.ZipFile(io.BytesIO(raw))
    assert len(z.namelist())==1
    rows=csv.reader(io.StringIO(z.read(z.namelist()[0]).decode('utf-8-sig')),delimiter=';')
    year=sex=None
    all_citizens=False
    result={}
    for row in rows:
        if not row: continue
        if len(row)==1 and 'Anno:' in row[0]:
            year=int(re.search(r'Anno: (\d{4})',row[0])[1])
            all_citizens=row[0].startswith('Tutte le cittadinanze')
            sex=None
        elif row[0].startswith('Codice '):
            sex=row[2]
            assert sex in ('Totale','Maschi','Femmine')
        elif all_citizens and year in (2016,2017,2018) and sex and len(row)==103:
            if not (row[0].isdigit() or row[1]=='Totale'): continue
            key=(year,row[0] or 'TOTAL',sex)
            assert key not in result
            result[key]=sum(int(n) for n in row[2:])
    for (y,code,sex),value in result.items():
        if sex=='Totale':
            assert value==result[(y,code,'Maschi')]+result[(y,code,'Femmine')]
    return {(y,c):v for (y,c,s),v in result.items() if s=='Totale'}

regions=read('Regioni'); provinces=read('Province'); national=read('Italia-Ripartizioni')
population=[]
for year in (2016,2017,2018):
    selected={c:v for (y,c),v in regions.items() if y==year and c!='TOTAL'}
    assert len(selected)==20
    total=sum(selected.values())
    assert total==national[(year,'TOTAL')]==regions[(year,'TOTAL')]==provinces[(year,'TOTAL')]
    assert sum(v for (y,c),v in provinces.items() if y==year and c!='TOTAL')==total
    assert provinces[(year,'021')]+provinces[(year,'022')]==selected['04']
    for code,value in selected.items():
        if code!='04': population.append({'year':year,'region':code+'0','population':value})
    population.extend([{'year':year,'region':'041','population':provinces[(year,'021')]},
                       {'year':year,'region':'042','population':provinces[(year,'022')]},
                       {'year':year,'region':'000','population':total}])
assert len(population)==66
out=ROOT/'data/derived/pillar_a/population_2016_2018.json'
out.parent.mkdir(parents=True,exist_ok=True)
out.write_text(json.dumps({'basis':'ISTAT intercensal reconstruction; January 1; 2019 territorial boundaries',
                          'sources':sources,'rows':population},indent=2),encoding='utf-8')
print('PASS: 66 population denominators; sex, regional, provincial and national totals reconcile')
