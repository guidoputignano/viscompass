"""Read-only XLSX audit; stage private SQL and regression inputs outside Git."""
import hashlib,json,sys
from pathlib import Path
import openpyxl

source=Path(sys.argv[1]); out=Path('private-staging');out.mkdir(exist_ok=True)
w=openpyxl.load_workbook(source,data_only=True)
assert list(next(w['Data'].values))==['Year','Azienda','AWaRe','Spend EUR','DDD','A2 (source-defined)','Weighted pop']
sha=hashlib.sha256(source.read_bytes()).hexdigest()
facts=[]; expected={}
cats={'Total':'T','Access':'A','Watch':'W','Reserve':'R'}
for idx,row in enumerate(list(w['Data'].values)[1:],2):
    year,org,category,cost,ddd,a2,pop=row
    assert year in (2023,2024,2025) and str(org) in ('130','201','202','203','204')
    assert all(isinstance(v,(int,float)) and v>=0 for v in (cost,ddd,a2,pop))
    if str(org)=='130':continue # Never double-count supplied regional totals.
    facts.append(dict(org_code=str(org),year=year,aware_category=cats[category],cost_eur=cost,ddd_count=ddd,unit_code=None))
    if category=='Total':
        assert abs(w['Indicators'].cell(idx,6).value-cost/ddd)<1e-8
for row in list(w['Decomposition'].values)[1:]:
    if row[2]=='national' and str(row[1]) in ('201','202','203','204'):
        expected[f'{row[1]}/{row[0]}']=dict(zip(['actual','reference','excess','price','mix','interaction'],row[9:15]))
assert len(facts)==48 and len({(r['org_code'],r['year'],r['aware_category']) for r in facts})==48
for org in ('201','202','203','204'):
    for year in (2023,2024,2025):
        selected=[r for r in facts if r['org_code']==org and r['year']==year]
        total=next(r for r in selected if r['aware_category']=='T')
        for key in ('cost_eur','ddd_count'):
            assert abs(total[key]-sum(r[key] for r in selected if r['aware_category']!='T'))<=2
note=f'VIS_WORKBOOK_V1: SHA256={sha}; supplied rounded costs and DDD; A2 and weighted-population semantics pending; no package conversion; source Data!A2:G61'
values=',\n'.join("('%s',%s,'%s',%s,%s)"%(r['org_code'],r['year'],r['aware_category'],r['cost_eur'],r['ddd_count']) for r in facts)
sql="""begin;
do $$ begin
 if not (select relrowsecurity from pg_class where oid='public.antibiotic_consumption_fact'::regclass) then raise exception 'RLS must be enabled'; end if;
 if exists(select 1 from public.antibiotic_consumption_fact) then raise exception 'Existing rows: import aborted, no overwrite'; end if;
 if (select count(*) from public.organizations where org_code in ('201','202','203','204') and org_type='asl' and region_code='130')<>4 then raise exception 'Organization mapping mismatch'; end if;
end $$;
insert into public.antibiotic_consumption_fact(org_code,year,aware_category,cost_eur,ddd_count,bed_days,population,unit_code,period_status,source_note)
select org,yr,cat,cost,ddd,null,null,null,'provisional','%s' from (values
%s
) as input(org,yr,cat,cost,ddd);
commit;
select count(*) as imported_rows from public.antibiotic_consumption_fact;
"""%(note,values)
(out/'import.sql').write_text(sql,encoding='utf-8')
(out/'workbook-regression.json').write_text(json.dumps(dict(facts=facts,expected=expected,source_sha256=sha)),encoding='utf-8')
print(json.dumps(dict(rows=len(facts),reference_checks=len(expected),sha256=sha)))
