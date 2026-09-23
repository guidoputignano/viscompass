"""Build shared workbook/web public evidence. Never reads private hospital rows."""
import argparse, csv, hashlib, io, json, zipfile
from collections import defaultdict
from decimal import Decimal
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'outputs/pillar-a-update'

def main():
    args = argparse.ArgumentParser()
    args.add_argument('--source-root', type=Path, default=ROOT)
    source_root = args.parse_args().source_root
    OUT.mkdir(parents=True, exist_ok=True)
    policy = json.loads((ROOT/'lib/analytics/pillar-a-scope.json').read_text())
    manifest = json.loads((source_root/'data/raw/aifa/aifa_series_manifest.json').read_text())
    sums = defaultdict(lambda: [Decimal(0),Decimal(0),0,0,0])
    sources, regions = [], {'000':'Italia'}
    for p in manifest['profiles']:
        path = source_root / p['file'].replace('\\','/')
        raw = path.read_bytes()
        digest = hashlib.sha256(raw).hexdigest()
        assert digest == p['sha256']
        try: text = raw.decode('utf-8-sig')
        except UnicodeDecodeError: text = raw.decode('cp1252')
        sources.append({'file':path.name,'sha256':digest,'year':int(p['year']),'publisher':'AIFA'})
        for row in csv.DictReader(io.StringIO(text),delimiter='|'):
            g = next((g['id'] for g in policy['groups'] if row['atc4'].startswith(g['prefix'])),None)
            if not g: continue
            year,month,region = int(row['anno']),int(row['mese']),row['codreg'].zfill(3)
            assert year == int(p['year']) and 1 <= month <= 12 and region != '000'
            regions[region] = row['regione']
            for channel,cost,packs in [('direct','spesa_flusso_tracciabilita','numero_confezioni_traccia'),('convenzionata','spesa_convenzionata','numero_confezioni_convenzionata')]:
                for code in (region,'000'):
                    v=sums[(year,month,code,g,channel)]
                    v[4]+=1
                    for idx,col in enumerate((cost,packs)):
                        value=row[col].strip()
                        if value:
                            amount=Decimal(value)
                            assert amount.is_finite()
                            v[idx]+=amount
                            v[2+idx]+=1
    populations={}
    for year in range(2019,2026):
        path=source_root/f'data/raw/denominators/istat/POSAS_{year}_it_Tutti_i_file.zip'
        raw=path.read_bytes()
        sources.append({'file':path.name,'sha256':hashlib.sha256(raw).hexdigest(),'year':year,'publisher':'ISTAT'})
        z=zipfile.ZipFile(io.BytesIO(raw)); name=next(n for n in z.namelist() if n.endswith('_Regioni.csv'))
        text=z.read(name).decode('utf-8-sig')
        rows=list(csv.reader(io.StringIO(text),delimiter=';'))[2:]
        parts=defaultdict(int); totals={}
        for r in rows:
            if len(r)<20: continue
            code=r[0].zfill(2)+'0'; value=int(r[-1])
            if r[2]=='999': totals[code]=value
            else: parts[code]+=value
        assert len(totals)==20 and parts==totals, f'Population age totals mismatch {year}'
        for code,value in totals.items(): populations[(year,code)]=value
        populations[(year,'000')]=sum(totals.values())
        # AIFA reports the autonomous provinces separately. Aggregate municipal
        # total-age rows, checking them against the sum of individual ages.
        province_totals = {}
        for province, aifa in [('021','041'),('022','042')]:
            matches = [n for n in z.namelist() if f'_it_{province}_' in n and n.endswith('.csv')]
            assert len(matches) == 1, (year, province, matches)
            provincial_rows = list(csv.reader(io.StringIO(z.read(matches[0]).decode('utf-8-sig')), delimiter=';'))[2:]
            age_sum = total_sum = 0
            municipalities = set()
            for row in provincial_rows:
                if len(row) < 20: continue
                assert row[0].startswith(province) and len(row[0]) == 6
                if row[2] == '999':
                    assert row[0] not in municipalities
                    municipalities.add(row[0]); total_sum += int(row[-1])
                else: age_sum += int(row[-1])
            assert total_sum > 0 and total_sum == age_sum
            populations[(year,aifa)] = total_sum
            province_totals[aifa] = total_sum
        assert sum(province_totals.values()) == totals['040'], year
    annual=defaultdict(lambda:[Decimal(0),Decimal(0),0,0,0,set()])
    monthly=[]
    for (year,month,region,g,channel),v in sorted(sums.items()):
        a=annual[(year,region,g,channel)]
        for i in range(5): a[i]+=v[i]
        a[5].add(month)
        monthly.append(dict(year=year,month=month,region=region,group=g,channel=channel,spend=float(v[0]) if v[2] else None,packs=float(v[1]) if v[3] else None))
    # Reconcile national values from separate regional buckets with decimal arithmetic.
    for key,v in annual.items():
        year,region,g,channel=key
        if region=='000':
            for i in (0,1): assert v[i]==sum(x[i] for k,x in annual.items() if k[0]==year and k[1]!='000' and k[2:]==(g,channel))
    historical=json.loads((ROOT/'data/derived/pillar_a/population_2016_2018.json').read_text())
    assert len(historical['rows'])==66
    for row in historical['rows']:
        key=(row['year'],row['region'])
        assert key not in populations and row['population']>0
        populations[key]=row['population']
    sources.extend({**s,'publisher':'ISTAT','years':[2016,2017,2018]} for s in historical['sources'])
    records=[]
    for (year,region,g,channel),v in sorted(annual.items()):
        pop=populations.get((year,region)); prior=annual.get((year-1,region,g,channel))
        spend=float(v[0]) if v[2] else None
        records.append(dict(year=year,region=region,group=g,channel=channel,spend=spend,packs=float(v[1]) if v[3] else None,
                            spendYoy=float(v[0]/prior[0]-1) if prior and prior[2] and prior[0]!=0 and v[2] else None,
                            population=pop,perResident=spend/pop if spend is not None and pop else None,
                            populationBasis='ISTAT intercensal reconstruction, January 1' if year<2019 else 'ISTAT POSAS, January 1',
                            missingSpendCells=v[4]-v[2],missingPackCells=v[4]-v[3],months=len(v[5])))
    activity=list(csv.DictReader((source_root/'data/derived/pillar_a/sdo_acute_regional_2021_2024.csv').open(encoding='utf-8')))
    for r in activity:
        for k in ('year','ordinary_days','day_accesses','days_plus_accesses'): r[k]=int(r[k])
    public_candidates=[]
    for r in csv.DictReader((source_root/'outputs/pillar-a-scope/candidate_and_coverage.csv').open(encoding='utf-8-sig')):
        public_candidates.append({k:r[k] for k in ('atc5','group','ingredient_or_reference_names','aware','aware_status','public_parent_years')})
    data=dict(version='2026-09-23.1',scope=policy,regions=regions,annual=records,monthly=monthly,activity=activity,candidates=public_candidates,sources=sources,
              checks={'nationalRegionalReconciliation':'passed','populationAgeReconciliation':'passed'},
              notes=['Spending and package sums use reported numeric cells; missing cells are counted, not filled.',
                     'Acquisti diretti and convenzionata are separate public flows; neither is mapped to local DD/CO.',
                     'Per-resident denominator is ISTAT population at 1 January, not weighted population or an annual mean.',
                     '2016-2018 uses the intercensal reconstruction (2019 territorial boundaries); 2019 onward uses POSAS.',
                     'Bolzano/Trento use municipal totals from their provincial files; their sum reconciles to the combined regional total.',
                     'No package-to-DDD inference. Antifungals never enter AWaRe. Current classifications are retrospective.'])
    (OUT/'public-series.json').write_text(json.dumps(data,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
    with (OUT/'annual-public-series.csv').open('w',encoding='utf-8-sig',newline='') as f:
        writer=csv.DictWriter(f,fieldnames=list(records[0]));writer.writeheader();writer.writerows(records)
    print(json.dumps({'annual':len(records),'monthly':len(monthly),'activity':len(activity),'sources':len(sources),'regions':regions,'checks':data['checks']}))

if __name__=='__main__': main()
