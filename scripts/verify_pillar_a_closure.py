"""Read-only source audit and private derivation. Never publishes hospital data.

Run with bundled Python. Outputs stay in git-ignored private-staging.
No macros are executed and no source workbook is saved.
"""
import hashlib
import json
from collections import defaultdict
from decimal import Decimal
from pathlib import Path
import openpyxl

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / 'data/raw/pillar-a-drive-20260922'
OUT = ROOT / 'private-staging/closure'


def dec(value):
    assert isinstance(value, (int, float)) and not isinstance(value, bool), value
    result = Decimal(str(value))
    assert result.is_finite()
    return result


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    sources = []
    for path in sorted(SOURCE.iterdir()):
        raw = path.read_bytes()
        assert raw[:2] == b'PK' if path.suffix in ('.xlsx', '.xlsm') else raw[:4] == b'%PDF'
        sources.append({'file': path.name, 'bytes': len(raw), 'sha256': hashlib.sha256(raw).hexdigest()})
    assert len(sources) == 5
    ana = openpyxl.load_workbook(SOURCE/'Allegato 1 - Dati_Anagrafiche.xlsx', data_only=True)
    report = openpyxl.load_workbook(SOURCE/'Allegato 2 - Dati_Analisi.xlsm', data_only=True)
    formula = openpyxl.load_workbook(SOURCE/'Allegato 2 - Dati_Analisi.xlsm', data_only=False)
    sheets = {w: {s.title: {'rows': s.max_row, 'columns': s.max_column,
              'populated_cells': sum(c.value is not None for row in s for c in row)}
              for s in book} for w, book in [('anagrafiche', ana), ('analysis', report)]}
    atc = {r[2]: {'atc5': r[2], 'name': r[3], 'sourceAware': r[4], 'note': r[5]}
           for r in list(ana['Ana_ATC'].values)[2:] if r[2]}
    assert len(atc) == 78 and all(k.startswith('J01') for k in atc)
    # Reference perimeter is versioned independently of the broad public ATC4 scope.
    perimeter = {'version': '2026-09-23.1', 'sourceSheet': 'Ana_ATC',
                 'sourceSha256': next(s['sha256'] for s in sources if s['file'].endswith('Anagrafiche.xlsx')),
                 'policy': 'Local J01 reference only; does not narrow public AIFA ATC4 totals; WR remains unresolved',
                 'codes': [{'atc5': k, 'sourceAware': v['sourceAware']} for k,v in sorted(atc.items())]}
    (ROOT/'lib/analytics/pillar-a-local-perimeter.json').write_text(
        json.dumps(perimeter, indent=2), encoding='utf-8')
    # WR is preserved, never guessed into Watch or Reserve.
    aic_rows = [r for r in list(ana['Ana_AIC'].values)[2:] if r[2]]
    aic = {str(r[2]).zfill(9): r for r in aic_rows}
    assert len(aic) == len(aic_rows), 'Duplicate AIC reference'
    source_rows = [r for r in list(ana['Ana_Dati_CO'].values)[3:] if r[0]]
    expected = ('Anno','ASL','ATC','AWR','AIC','AIC_Desc','UP','FC','QF','Prz_F','CF','QN','Prz_N','CN','QMR','Prz_MR','CMR','INFO_Norm')
    assert tuple(list(ana['Ana_Dati_CO'].values)[2]) == expected
    assert report['Report']['A2'].value == 'A3'
    assert report['Report']['B2'].value == 'CO1'
    assert report['Dati']['B7'].value == 'A3'
    totals = defaultdict(lambda: {'CF': Decimal(0), 'CN': Decimal(0), 'CMR': Decimal(0), 'DDD': Decimal(0)})
    details = []
    seen = set()
    for row in source_rows:
        year, org, code, aware, product = row[:5]
        product = str(product).zfill(9)
        assert year in (2023,2024,2025) and org in ('201','202','203','204')
        assert code in atc and product in aic and aic[product][0] == code
        assert aware in ('A','W','R') and aic[product][1] == aware
        key = (year, org, product)
        assert key not in seen, key
        seen.add(key)
        ddd = dec(row[14]) * dec(aic[product][12])
        record = dict(year=year, org=org, atc5=code, aware=aware, aic=product,
                      name=row[5], QMR=dec(row[14]), DDD_AIC=dec(aic[product][12]),
                      CF=dec(row[10]), CN=dec(row[13]), CMR=dec(row[16]), DDD=ddd)
        assert all(record[k] >= 0 for k in ('CF','CN','CMR','DDD'))
        details.append(record)
        for org_key in (org, '130'):
            for cat in (aware, 'T'):
                for measure in ('CF','CN','CMR','DDD'):
                    totals[(year, org_key, cat)][measure] += record[measure]
    # Independent cached report controls for both cost bases and supplied DDD.
    residuals = []
    for row in report['Dati_CO'].values:
        if row[0] not in ('CO','CO1') or row[1] not in ('T','A','W','R') or row[2] not in ('201','202','203','204','130'):
            continue
        basis = 'CF' if row[0] == 'CO' else 'CMR'
        for j, year in enumerate((2023,2024,2025)):
            calculated = totals[(year,row[2],row[1])]
            for measure, col, tolerance in ((basis,3+j,Decimal('.02')), ('DDD',8+j,Decimal('1'))):
                delta = calculated[measure] - dec(row[col])
                residuals.append({'year':year,'org':row[2],'category':row[1],'measure':measure,'delta':delta})
                assert abs(delta) <= tolerance, residuals[-1]
    assert len(residuals) == 240, len(residuals)
    # A3 selected denominator is T1, not T; retain exact source labels.
    activity = {(int(r[0]),r[2]): dec(r[4]) for r in report['Dati_GG'].values
                if r[1] == 'A3' and r[2] in ('201','202','203','204')}
    for i, org in enumerate(('201','202','203','204'), 4):
        for col, year in zip(('D','E','F'), (2023,2024,2025)):
            assert activity[(year,org)] == dec(report['Dati_Rpt'][f'{col}{i}'].value)
    for year in (2023,2024,2025):
        activity[(year,'130')] = sum(activity[(year,org)] for org in ('201','202','203','204'))
    indicators = []
    for (year,org,cat), values in sorted(totals.items()):
        days = activity[(year,org)]
        indicators.append(dict(year=year,org=org,aware=cat,**values,activity=days,
            dddPer100Activity=values['DDD']/days*100,
            reportedCostPerActivity=values['CF']/days,
            reportedCostPerDdd=values['CF']/values['DDD'] if values['DDD'] else None))
    # ABC is a spend concentration rule; crossing item stays in the preceding band.
    for year in (2023,2024,2025):
        for org in ('201','202','203','204'):
            rows = sorted((r for r in details if r['year']==year and r['org']==org), key=lambda r:(-r['CF'],r['aic']))
            total = sum(r['CF'] for r in rows)
            cumulative = Decimal(0)
            for row in rows:
                before = cumulative/total if total else None
                row['abc'] = None if before is None else 'A' if before < Decimal('.8') else 'B' if before < Decimal('.95') else 'C'
                cumulative += row['CF']
                row['spendShare'] = row['CF']/total if total else None
                row['cumulativeShare'] = cumulative/total if total else None
            assert cumulative == totals[(year,org,'T')]['CF']
    def save(name, value):
        (OUT/name).write_text(json.dumps(value, ensure_ascii=False, indent=2,
            default=lambda x: float(x) if isinstance(x,Decimal) else str(x)), encoding='utf-8')
    save('source-manifest.json', sources)
    save('indicators.json', indicators)
    save('product-analysis.json', details)
    # Composition links are not longitudinal transitions or patient pathways.
    composition = defaultdict(Decimal)
    for row in details:
        for metric in ('CF', 'DDD'):
            composition[(row['year'],row['org'],metric,row['aware'],row['atc5'][:5])] += row[metric]
    links = [dict(year=y,org=o,metric=m,source=a,target=atc4,value=v)
             for (y,o,m,a,atc4),v in sorted(composition.items())]
    for year in (2023,2024,2025):
        for org in ('201','202','203','204'):
            for metric in ('CF','DDD'):
                assert sum(r['value'] for r in links if r['year']==year and r['org']==org and r['metric']==metric) == totals[(year,org,'T')][metric]
    save('composition-links.json', links)
    save('audit.json', dict(sheets=sheets, sourceRows=len(details), atcObserved=len({r['atc5'] for r in details}),
         aicObserved=len({r['aic'] for r in details}), reconciliation=residuals,
         activityVariant=report['Report']['A2'].value, activityLabel=report['Dati']['A7'].value,
         selectedActivityFormula=formula['Dati_Rpt']['D4'].value,
         classification=list(atc.values()), abcRule='80/95 percent of CF; boundary item assigned by cumulative share before item; AIC breaks ties'))
    print(json.dumps({'status':'passed','sourceFiles':len(sources),'sourceRows':len(details),
        'referenceAtc':len(atc),'indicatorRows':len(indicators),'independentComparisons':len(residuals),
        'maxDddResidual':float(max(abs(r['delta']) for r in residuals if r['measure']=='DDD'))}))


if __name__ == '__main__':
    main()
