"""Extract the public OSMED 2024 table, preserving its revised historical series."""
import hashlib
import json
import re
from pathlib import Path
from pypdf import PdfReader

ROOT = Path(__file__).resolve().parents[1]
path = ROOT / 'data/raw/pillar-a-drive-20260922/Allegato 4 - Rapporto_OSMED_2024 - Estratto.pdf'
text = PdfReader(path).pages[3].extract_text()
assert 'Tabella 5.2' in text and '2016' in text and '2024' in text
names = ['Piemonte', 'Valle d’ Aosta', 'Lombardia', 'PA Bolzano', 'PA Trento',
         'Veneto', 'Friuli VG', 'Liguria', 'Emilia R.', 'Toscana', 'Umbria',
         'Marche', 'Lazio', 'Abruzzo', 'Molise', 'Campania', 'Puglia',
         'Basilicata', 'Calabria', 'Sicilia', 'Sardegna', 'Italia']
codes = ['010','020','030','041','042','050','060','070','080','090','100',
         '110','120','130','140','150','160','170','180','190','200','000']
rows = []
for name, code in zip(names, codes):
    matches = [line for line in text.splitlines() if line.startswith(name + ' ')]
    assert len(matches) == 1, name
    values = re.findall(r'[−‐-]?\d+,\d+', matches[0][len(name):])
    assert len(values) == 12, (name, values)
    rates = [float(v.replace(',', '.')) for v in values[:9]]
    assert all(v > 0 for v in rates)
    rows.append({'region': code, 'rates': dict(zip(map(str, range(2016, 2025)), rates))})
assert next(r for r in rows if r['region']=='000')['rates']['2024'] == 83.5
assert next(r for r in rows if r['region']=='000')['rates']['2023'] == 85.4
# The published payload carries the citation a reader needs - edition, table and
# printed page - but not the extract's filename or digest. Those describe how VIS
# obtained the figure rather than the figure itself, and are the kind of internal
# detail the reviewer asked to keep off the public surface.
result = {'edition': 2024, 'table': '5.2', 'printedPage': 165,
          'metric': 'DDD/100 hospital activity days, OSMED definition',
          'scope': 'J01; public hospital purchases net of direct distribution',
          'baseline': 2022, 'targetYear': 2025, 'reductionStrictlyGreaterThan': 0.05,
          'rows': rows}
(ROOT/'data/public-compiled/pillar-a-osmed.json').write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding='utf-8')

# Provenance stays in the repository for audit, in a directory that is never
# served: nothing under data/provenance/ is reachable over HTTP.
provenance = {'artifact': 'pillar-a-osmed.json', 'edition': 2024, 'table': '5.2',
              'printedPage': 165, 'sourceFile': path.name,
              'sha256': hashlib.sha256(path.read_bytes()).hexdigest()}
(ROOT/'data/provenance').mkdir(parents=True, exist_ok=True)
(ROOT/'data/provenance/pillar-a-osmed.json').write_text(json.dumps(provenance, ensure_ascii=False, indent=2), encoding='utf-8')
print(f'PASS: {len(rows)} territories x 9 years; OSMED 2024 edition only')
print('Provenance written to data/provenance/pillar-a-osmed.json (never served)')
