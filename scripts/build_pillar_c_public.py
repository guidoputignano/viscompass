"""Build the public Pillar C projection, never a private packet passthrough.

Run from this checkout: python scripts/build_pillar_c_public.py --evidence-root
<workspace>/outputs/pillar-c. Only admitted public-source tables and regional
forecast result fields are emitted. Source pins and projection checks stay in a
separate local receipt; private workbook metadata and model diagnostics do not ship.
"""
import argparse
import csv
from decimal import Decimal
import hashlib
import json
from pathlib import Path

def sha(b):return hashlib.sha256(b).hexdigest()
def numeric(v):
    if isinstance(v,list) and len(v)==2:
        d=Decimal(v[0]);assert d.is_finite();return float(d)
    assert v in ('—','n.a. (primo anno)','n.a. (non ricalcolabile dalle celle aggregate)'),repr(v)
    return None
def main():
    p=argparse.ArgumentParser();p.add_argument('--evidence-root',type=Path,required=True);p.add_argument('--receipt',type=Path,required=True);a=p.parse_args()
    root=a.evidence_root
    pins=json.loads((root/'public-comparators-20261024/PINS_PUBLIC.json').read_text())
    public_bytes=(root/'public-comparators-20261024/objects/v9/regione'/pins['name']).read_bytes()
    assert sha(public_bytes)==pins['sha256']=='078832a2d92f441b8114cf13e6405866a5e03e78163e7437455a2765e4806446'
    packet_bytes=(root/'dashboard-review-20261015-r5/pillar-c-review-packet-r5.json').read_bytes()
    assert sha(packet_bytes)=='fd09373fafeb5ef2c9acd1788504bac2c911c7d33a828b956e584f4b820d93df'
    tables={o['id']:o['tables'][0] for o in json.loads(public_bytes)['outputs']}
    forecast=json.loads(packet_bytes)['forecast'];assert forecast['region']=='Abruzzo' and forecast['scope']=='regional_public_forecast'
    # Public source identities and dated publications only, no workbook/Storage lineage.
    references=[{'id':'aifa','name':'AIFA · spesa e consumo','url':'https://www.aifa.gov.it/it/spesa-e-consumo-relativi-al-flusso-della-farmaceutica-convenzionata-e-degli-acquisti-diretti','licence':'CC BY 4.0','licenceUrl':'https://creativecommons.org/licenses/by/4.0/deed.it'},
      {'id':'population','name':'Ministero della Salute · popolazione ISTAT','url':'https://www.dati.salute.gov.it/it/dataset/corrispondenze-asl-comuni-e-popolazione-residente-anno-2024/','licence':'Riuso con attribuzione','licenceUrl':None},
      {'id':'activity','name':'Ministero della Salute · Annuario SSN 2023','url':'https://www.salute.gov.it/new/it/pubblicazione/annuario-statistico-del-servizio-sanitario-nazionale-anno-2023/','licence':'Riuso con attribuzione','licenceUrl':None}]
    trend=[dict(year=int(r[0]),abruzzo=numeric(r[1]),italy=numeric(r[2]),rest=numeric(r[3]),abruzzoChange=numeric(r[4]),restChange=numeric(r[5]),abruzzoIndex=numeric(r[6]),restIndex=numeric(r[7]),partial=r[8]=='S',vintage=r[9]) for r in tables['PUB-04']['rows']]
    direct=tables['PUB-01']['rows'];conv=tables['PUB-05']['rows'];assert [r[0] for r in direct]==[r[0] for r in conv]
    regions=[dict(name=r[0],population=numeric(r[1]),direct=numeric(r[7]),classA=numeric(r[2]),classH=numeric(r[3]),classC=numeric(r[4]),conventional=numeric(c[4]),missingDirect=numeric(r[9])) for r,c in zip(direct,conv)]
    classes=['A','H','C','C-BIS','Cnn','Altro','Non classificato']
    reimbursement=[dict(year=int(r[0]),geography=r[1],shares={k:numeric(v) for k,v in zip(classes,r[2:9])},total=numeric(r[9])) for r in tables['PUB-02']['rows']]
    atc_bytes=(root/'public-20261013/aifa-liste/atc.csv').read_bytes()
    atc_pin=next(x['sha256'] for x in json.loads((root/'public-20261013/MANIFEST_20261013.json').read_text())['groups']['aifa-liste']['files'] if x['file']=='atc.csv')
    assert sha(atc_bytes)==atc_pin
    atc_names={r['CODICE_ATC']:r['DESCRIZIONE'].capitalize() for r in csv.DictReader(atc_bytes.decode('utf-8-sig').splitlines(),delimiter=';') if len(r['CODICE_ATC'])==1}
    atc=[dict(code=r[0],label=atc_names.get(r[0],'ATC non indicato'),abruzzo2024=numeric(r[1]),rest2024=numeric(r[2]),difference2024=numeric(r[3]),abruzzo2025=numeric(r[4]),rest2025=numeric(r[5]),difference2025=numeric(r[6])) for r in tables['PUB-03']['rows']]
    activity=[dict(name=r[0],population=numeric(r[1]),admissions=numeric(r[2]),rate=numeric(r[3]),stay=numeric(r[4]),occupancy=numeric(r[5]),prescriptions=numeric(r[6]),prescriptionCost=numeric(r[7])) for r in tables['PUB-07-10']['rows']]
    diagnoses=[dict(chapter=r[0],label=r[1],abruzzoAdmissions=numeric(r[2]),abruzzoShare=numeric(r[3]),abruzzoRate=numeric(r[4]),abruzzoStay=numeric(r[5]),italyAdmissions=numeric(r[6]),italyRate=numeric(r[7]),italyStay=numeric(r[8])) for r in tables['PUB-07-03']['rows']]
    # Independently reviewed final output; compare every emitted point/bound to the frozen result CSV.
    result_rows=list(csv.DictReader((root/'stage-c3/ml5-r5p/out/ml5r5_previsione_2026.csv').open(encoding='utf-8-sig')))
    checked=0;series=[]
    fields={'point':'previsione_eur','low80':'pi80_inf_eur','high80':'pi80_sup_eur','low95':'pi95_inf_eur','high95':'pi95_sup_eur'}
    for key,label in [('TOT','Totale'),('A','Classe A'),('H','Classe H')]:
        assert next(x for x in forecast['admission'] if x['series']==key)['decision']=='AMMESSA'
        rows=[r for r in forecast['monthly'] if r['series']==key]
        observed=[r for r in forecast['observed2025'] if r['series']==key]
        assert [r['month'] for r in rows]==[f'2026-{i:02}' for i in range(1,13)]
        assert [r['month'] for r in observed]==[f'2025-{i:02}' for i in range(1,13)]
        months=[]
        for r,o in zip(rows,observed):
            final=next(x for x in result_rows if x['serie']==key and x['periodo']==r['month'] and x['tipo']=='mensile')
            for field,column in fields.items():assert Decimal(r[field])==Decimal(final[column]);checked+=1
            months.append({'month':int(r['month'][-2:]),'observed':float(o['value']) if o['value'] is not None else None,'observedPartial':o['rowsMissing']>0,**{f:float(r[f]) for f in fields}})
        annual=next(r for r in forecast['annual'] if r['series']==key)
        annual_csv=next(x for x in result_rows if x['serie']==key and x['periodo']=='2026 (anno)' and x['tipo'].startswith('totale annuo ('))
        assert Decimal(annual['total'])==Decimal(annual_csv['previsione_eur'])
        for field,column in fields.items():
            if field!='point':assert Decimal(annual[field])==Decimal(annual_csv[column]);checked+=1
        series.append({'key':key,'label':label,'months':months,'annual':{k:float(annual[k]) for k in ['total','low80','high80','low95','high95']}})
    data={'schema':'public-pillar-c-v1','version':'2026-10-28','region':'Abruzzo','references':references,'trend':trend,'regions':regions,'reimbursement':reimbursement,'atc':atc,'activity':activity,'diagnoses':diagnoses,'forecast':{'region':'Abruzzo','year':2026,'observedYear':2025,'series':series}}
    # No free-form inherited objects. The public result has no private figures, keys or fitting diagnostics.
    forbidden={'workbookSha256','attivitaSha256','sourceState','ranges','admission','sigma','model','method','variants','budgets','recipients','scope','lineage','org','unit'}
    def inspect(v):
        if isinstance(v,dict):
            assert not forbidden.intersection(v)
            for x in v.values():inspect(x)
        elif isinstance(v,list):
            for x in v:inspect(x)
    inspect(data)
    out=Path(__file__).resolve().parents[1]/'data/public-compiled/pillar-c.json';out.parent.mkdir(parents=True,exist_ok=True)
    b=(json.dumps(data,ensure_ascii=False,separators=(',',':'))+'\n').encode();out.write_bytes(b)
    receipt={'status':'PASS','assetSHA256':sha(b),'bytes':len(b),'publicComparatorInputSHA256':sha(public_bytes),'forecastInputSHA256':sha(packet_bytes),'forecastNumericComparisons':checked,'admittedSeries':['TOT','A','H'],'excluded':['PUB-07-11 perimeter-mismatched ratio','class C forecast','private ledger and organizational data','model diagnostics and private lineage'],'rowCounts':{k:len(data[k]) for k in ['trend','regions','reimbursement','atc','activity','diagnoses']}}
    a.receipt.parent.mkdir(parents=True,exist_ok=True);a.receipt.write_text(json.dumps(receipt,indent=2),encoding='utf-8');print(json.dumps(receipt))
if __name__=='__main__':main()
