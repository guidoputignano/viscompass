"""Build the public Pillar B asset from AIFA's biosimilar EV/SC focus report.

Source (public, AIFA - Ufficio Monitoraggio della Spesa Farmaceutica e Rapporti
con le Regioni): "Biosimilari: distribuzione dei consumi e della spesa secondo
la forma di somministrazione", direct-purchase channel, January-December 2025,
NSIS / Tracciabilita del farmaco updated to December 2025.

    https://www.aifa.gov.it/documents/20142/3423405/5_FocusForme_EV_SC_gen_dic_2025.pdf

The PDF has 13 physical pages; the printed page number is one less, because
page 1 is the cover with the table of contents. The nine tables (3 molecules x
confezioni / DDD / spesa) sit on physical pages 3-5, 7-9 and 11-13. Each table
holds 21 territories plus ITALIA, each row four percentages that partition the
molecule's direct-purchase total in that territory:

    originator EV | biosimilar EV | originator SC | biosimilar SC | Totale 100.0%

Nothing is interpolated, scaled or summed across tables. Every row is checked:
exactly five percentages, the first four summing to 100 within 0.02, the fifth
exactly 100. Labels must be identical across the nine tables.

Usage:
    python scripts/build_pillar_b_public_aifa_ev_sc.py <path-to-pdf> [--date YYYY-MM-DD]

Requires pdfplumber (coordinate-based extraction: the plain text layer of the
PDF interleaves the label column and the number columns in a different order,
so a text dump cannot be trusted).

Writes:
    data/public-compiled/pillar-b-aifa-ev-sc-2025.json   (the public asset, no provenance keys)
    data/provenance/pillar-b-aifa-ev-sc-2025.json        (sha256, pages, titles, checks)
"""
import hashlib
import json
import os
import re
import sys
from datetime import date

try:
    import pdfplumber
except ImportError:
    sys.exit("pdfplumber is required: python -m pip install pdfplumber")

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = "https://www.aifa.gov.it/documents/20142/3423405/5_FocusForme_EV_SC_gen_dic_2025.pdf"
PCT = re.compile(r"^[0-9]{1,3}[.,][0-9]{1,2}%$")
TABLE_PAGES = {3: ("infliximab", "confezioni"), 4: ("infliximab", "ddd"), 5: ("infliximab", "spesa"),
               7: ("rituximab", "confezioni"), 8: ("rituximab", "ddd"), 9: ("rituximab", "spesa"),
               11: ("trastuzumab", "confezioni"), 12: ("trastuzumab", "ddd"), 13: ("trastuzumab", "spesa")}
KEYWORD = {"confezioni": "consumi (confezioni)", "ddd": "consumi (DDD)", "spesa": "della spesa"}
# AIFA label -> (Pillar A territory code, display label, kind). Codes are the
# ones /pillar-a already uses, so the two public pages name a territory the same way.
TERRITORIES = {
    "PIEMONTE": ("010", "Piemonte", "regione"),
    "V.AOSTA": ("020", "Valle d’Aosta", "regione"),
    "LOMBARDIA": ("030", "Lombardia", "regione"),
    "P.A. BOLZANO": ("041", "Prov. aut. di Bolzano", "provincia autonoma"),
    "P.A. TRENTO": ("042", "Prov. aut. di Trento", "provincia autonoma"),
    "VENETO": ("050", "Veneto", "regione"),
    "FRIULI V.G.": ("060", "Friuli Venezia Giulia", "regione"),
    "LIGURIA": ("070", "Liguria", "regione"),
    "EMILIA R.": ("080", "Emilia-Romagna", "regione"),
    "TOSCANA": ("090", "Toscana", "regione"),
    "UMBRIA": ("100", "Umbria", "regione"),
    "MARCHE": ("110", "Marche", "regione"),
    "LAZIO": ("120", "Lazio", "regione"),
    "ABRUZZO": ("130", "Abruzzo", "regione"),
    "MOLISE": ("140", "Molise", "regione"),
    "CAMPANIA": ("150", "Campania", "regione"),
    "PUGLIA": ("160", "Puglia", "regione"),
    "BASILICATA": ("170", "Basilicata", "regione"),
    "CALABRIA": ("180", "Calabria", "regione"),
    "SICILIA": ("190", "Sicilia", "regione"),
    "SARDEGNA": ("200", "Sardegna", "regione"),
    "ITALIA": ("000", "Italia", "italia"),
}


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    pdf_path = sys.argv[1]
    built = sys.argv[sys.argv.index("--date") + 1] if "--date" in sys.argv else date.today().isoformat()
    raw = open(pdf_path, "rb").read()
    sha = hashlib.sha256(raw).hexdigest()
    pdf = pdfplumber.open(pdf_path)
    assert len(pdf.pages) == 13, f"expected 13 physical pages, got {len(pdf.pages)}"
    cover = " ".join((pdf.pages[0].extract_text(x_tolerance=5) or "").split())
    assert "dic-2025" in cover and "acquisti diretti" in cover, cover[:300]

    rows, tables_meta, labels_seen = [], [], None
    for pno, (mol, measure) in TABLE_PAGES.items():
        page = pdf.pages[pno - 1]
        text = page.extract_text(x_tolerance=5) or ""
        flat = " ".join(text.split())
        title = next((ln.strip() for ln in text.splitlines() if "Distribuzione" in ln), "")
        assert mol.upper() in title and KEYWORD[measure] in title, (pno, title)
        assert "gen-dic 2025" in flat and "acquisti diretti" in flat, (pno, flat[:200])
        # The column order is read from the header, not assumed: originator EV,
        # biosimilar EV, originator SC, biosimilar SC, then Totale.
        order = [flat.find(p) for p in ("originator per la forma", "biosimilare per la", "Totale")]
        assert -1 not in order and order[0] < order[1], (pno, "header", order)
        heads = [w for w in page.extract_words(x_tolerance=5, y_tolerance=3) if w["text"] in ("EV", "SC")]
        ev = sorted(w["x0"] for w in heads if w["text"] == "EV")
        sc = sorted(w["x0"] for w in heads if w["text"] == "SC")
        assert len(ev) >= 2 and len(sc) >= 2 and max(ev[:2]) < min(sc[:2]), (pno, "EV columns precede SC columns", ev, sc)
        words = page.extract_words(x_tolerance=5, y_tolerance=3)
        lines = []
        for w in sorted(words, key=lambda w: (w["top"], w["x0"])):
            if lines and abs(lines[-1][0] - w["top"]) <= 3:
                lines[-1][1].append(w)
            else:
                lines.append([w["top"], [w]])
        labels = []
        for top, ws in lines:
            ws = sorted(ws, key=lambda w: w["x0"])
            pcts = [w["text"] for w in ws if PCT.match(w["text"])]
            label = " ".join(w["text"] for w in ws if not PCT.match(w["text"])).strip()
            if len(pcts) < 4 or not label:
                continue
            vals = [float(p.replace(",", ".").rstrip("%")) for p in pcts]
            assert len(vals) == 5, (pno, label, vals)
            assert abs(sum(vals[:4]) - 100) <= 0.02, (pno, label, vals)
            assert vals[4] == 100.0, (pno, label, vals)
            assert label in TERRITORIES, (pno, label)
            code, display, kind = TERRITORIES[label]
            labels.append(label)
            rows.append({"molecule": mol, "measure": measure, "territory": code,
                         "originator_ev": vals[0], "biosimilar_ev": vals[1],
                         "originator_sc": vals[2], "biosimilar_sc": vals[3], "page": pno})
        assert len(labels) == 22 and labels[-1] == "ITALIA", (pno, len(labels))
        if labels_seen is None:
            labels_seen = labels
        assert labels == labels_seen, (pno, labels)
        tables_meta.append({"page": pno, "printed_page": pno - 1, "molecule": mol, "measure": measure,
                            "title": title, "rows": len(labels)})

    assert len(rows) == 9 * 22, len(rows)
    territories = [{"code": code, "label": display, "kind": kind, "source_label": src}
                   for src, (code, display, kind) in TERRITORIES.items()]
    territories.sort(key=lambda t: (t["kind"] == "italia", t["label"]))
    asset = {
        "version": built,
        "source": {
            "publisher": "AIFA - Ufficio Monitoraggio della Spesa Farmaceutica e Rapporti con le Regioni",
            "title": "Biosimilari: distribuzione dei consumi e della spesa secondo la forma di somministrazione",
            "edition": "gennaio-dicembre 2025, dato NSIS / Tracciabilità del farmaco aggiornato a dicembre 2025",
            "channel": "acquisti diretti",
            "period": {"from": "2025-01", "to": "2025-12"},
            "url": URL,
            "unit": "percentuali come pubblicate (punti percentuali, due decimali); ogni riga ripartisce il totale della molecola nel canale e nel territorio",
        },
        "molecules": [
            {"id": "infliximab", "label": "Infliximab"},
            {"id": "rituximab", "label": "Rituximab"},
            {"id": "trastuzumab", "label": "Trastuzumab"},
        ],
        "measures": [
            {"id": "confezioni", "label": "Confezioni", "note": "unità di confezionamento tracciate"},
            {"id": "ddd", "label": "DDD", "note": "dosi definite giornaliere"},
            {"id": "spesa", "label": "Spesa", "note": "valori tracciabilità"},
        ],
        "territories": territories,
        "rows": rows,
    }
    provenance = {
        "asset": "data/public-compiled/pillar-b-aifa-ev-sc-2025.json",
        "built": built,
        "source_url": URL,
        "source_sha256": sha,
        "source_bytes": len(raw),
        "physical_pages": len(pdf.pages),
        "page_offset_note": "printed page = physical page - 1; page 1 is the cover with the table of contents",
        "tables": tables_meta,
        "checks": {
            "rows": len(rows), "territories_per_table": 22, "row_sum_tolerance": 0.02,
            "labels_identical_across_tables": True,
            "sc_originator_zero_everywhere": {
                "infliximab": all(r["originator_sc"] == 0 for r in rows if r["molecule"] == "infliximab")},
            "sc_biosimilar_zero_everywhere": {
                m: all(r["biosimilar_sc"] == 0 for r in rows if r["molecule"] == m) for m in ("rituximab", "trastuzumab")},
        },
        "method": "pdfplumber extract_words(x_tolerance=5, y_tolerance=3), rows rebuilt by vertical position; "
                  "the PDF text layer alone misorders the label column",
    }
    out_asset = os.path.join(ROOT, "data", "public-compiled", "pillar-b-aifa-ev-sc-2025.json")
    out_prov = os.path.join(ROOT, "data", "provenance", "pillar-b-aifa-ev-sc-2025.json")
    with open(out_asset, "w", encoding="utf-8", newline="\n") as f:
        json.dump(asset, f, ensure_ascii=False, indent=1)
        f.write("\n")
    with open(out_prov, "w", encoding="utf-8", newline="\n") as f:
        json.dump(provenance, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print(f"asset: {len(rows)} rows, {len(territories)} territories -> {os.path.relpath(out_asset, ROOT)}")
    print(f"provenance: sha256 {sha} -> {os.path.relpath(out_prov, ROOT)}")
    print("checks:", json.dumps(provenance["checks"]))


if __name__ == "__main__":
    main()
