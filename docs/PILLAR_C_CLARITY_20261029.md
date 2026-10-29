# Pillar C: clearer reading and task-oriented starting views

Owner decisions, 29 October 2026, joint-review feedback G2-03–G2-06 and G2-11–G2-22.

- Lead DPC cost and concentration with short statements and exact released figures per ASL. A median is described as
  a value at or below which at least half the observations lie; ties are allowed. No aggregate distribution is inferred.
- Keep service-cost measures, the under-EUR10 medicine list, recorded dispensing intervals, portfolio trends and named
  product-change contributions visible. Put the distribution explorer, typical-use interval plots, pharmacy-fee spread,
  concentration curves and detailed portfolio breakdowns under closed `Altre analisi` sections.
- Lead annual File F with its annual distinct identifiers and reported amount. Keep its profile, concentration and
  frequency in secondary detail. Annual statistics never appear under a monthly selection.
- Use `Assistiti con erogazioni DPC`. Count each admitted identifier once per ASL; an aggregate is the sum of ASL counts,
  not a regionally deduplicated patient count. File F identifiers keep their separate source definition.
- Offer `Direzione ASL`, `Farmacia` and `Regione` entry points. Store the preference in `c_percorso`; pharmacy opens DPC,
  management opens spending at the authorized default, and Regione opens the permitted aggregate. Task links preserve
  the current authorized selection. A preference grants no data access or professional membership attribute.
- A spending heading follows its selected organization/channel. DPC and File F headings describe their own delivered
  source coverage. The DPC source continues to display authorized units side by side.

No source release, numerical engine, storage object, membership, rollout switch or access policy changes. Detail panels
retain their original components and checks. Closed secondary sections defer mounting their contents.

Verification includes closed/expanded render tests; annual/monthly separation; authorized heading and URL normalization;
source/data guards; the existing numerical, private-input and access suites; TypeScript; lint; production build; and live
interaction after deployment. A local passing check is not a claim of a live account test.
