# Decision needed: M6 (Confronto fra Aziende) is live on data that does not reconcile

**For:** Guido Putignano, Foundation President
**Prepared:** 2026-09-09
**Decision owner:** Foundation President, with the external reviewer where relevant
**Status:** open

## The question in one line

M6 publishes a comparison between Aziende. The purchase figures those
comparisons rest on disagree with the dispensing figures by 18 to 55
million euro per Azienda. Do we gate the module, caveat it, or leave it
as is?

## Why this is being raised now

The technical document *Governance della spesa farmaceutica* (v2.0)
proposes a set of publication rules. One of them is a hard gate:

> Azienda, anno — difference between acquistato and erogato — threshold
> 5% — **blocks publication of the inter-Azienda comparison.**

M6 is in production today. Measured against the gold file, it would not
pass that gate.

## The measurement

Recomputed directly from
`DIR_OSP_TRA_003AS_SellInSellOut_nuova_estrazione_2025.xlsx`, 2025,
Abruzzo, 13,116 rows.

| ASL | Acquistato | Erogato | Difference |
|---|---:|---:|---:|
| 130201 | 82,648,601 | 100,534,922 | **−17,886,321** |
| 130202 | 97,913,030 | 119,290,293 | **−21,377,263** |
| 130203 | 189,036,511 | 133,645,086 | **+55,391,425** |
| 130204 | 80,308,346 | 98,117,117 | **−17,808,771** |

The table uses *Costo aziendale stimato* `(h)` as the purchase basis,
which is the basis the v2.0 document used. The file's own variance
column instead uses `(g se disponibile oppure h)`, which gives −18.96M,
−23.39M, +43.25M and −19.23M. **The choice of basis does not change the
decision:** every Azienda exceeds the 5% threshold under either one.

Three Aziende record substantially less purchased than dispensed; the
fourth records substantially more. The largest deviating items are
products typically handled through *distribuzione per conto*. That
pattern points to an **attribution problem** — purchases booked to one
Azienda while the dispensing is recorded against another — rather than
to real over- or under-consumption.

Two further facts bear on how much weight the comparison can carry:

- **Only 31% of the purchase valuation is backed by an observed company
  price.** The remaining two thirds are estimated using the regional
  average price. A comparison between Aziende is therefore partly a
  comparison between estimates.
- **At row level, 53% of rows deviate by more than 20% and 41% by more
  than 50%,** even though the regional totals appear close. The totals
  look reconciled because deviations of opposite sign cancel out.

## Why it matters commercially, not just technically

M6 is described in our own materials as the module with the highest
perceived value, and inter-Azienda comparison is the function a Region
buys. It is also the most contestable thing we publish: the first
competent reader who asks "why does my Azienda look worse than the one
next door" will find the answer is an accounting attribution artefact,
not performance.

The project's stated differentiator is that VIS ingests the
institution's own reconciliation file and makes discrepancies
explainable. Publishing a comparison built on an unexplained discrepancy
runs directly against that.

## Options

**A. Gate it.** Apply the 5% rule. M6 renders, but the comparison is
withheld with an explicit reason and a link to the underlying
discrepancy. Cost: the highest-value feature goes dark for Abruzzo until
the attribution question is answered. Benefit: nothing indefensible is
ever shown, and the gate itself demonstrates the quality engine working.

**B. Caveat it.** Keep the comparison visible, attach the per-Azienda
gap and the 31%-observed-price figure to every screen, and label the
estimated portion. Cost: a reader may still take the ranking at face
value. Benefit: the feature stays available and the limitation is
disclosed rather than hidden.

**C. Reframe it.** Compare only on quantities and unit prices actually
observed, and drop the acquistato-versus-erogato comparison until the
attribution rule exists. Cost: narrower feature. Benefit: everything
shown is measured rather than estimated.

**D. Leave as is.** Not recommended. It is the only option where a
reader can be misled without any signal that they might be.

## Recommendation

**A now, B when the attribution rule is written, C as the durable
shape.** The gate is cheap to implement, it is honest, and it doubles as
a live demonstration of the quality engine. Reaching B or C requires one
answer from the stakeholder, below.

## What we need from the institution to resolve it

One question, addressed to whoever administers the reporting platform
rather than to the administrative contact:

> When purchases are made centrally or handled through *distribuzione
> per conto*, which Azienda is the purchase attributed to, and does that
> attribution follow the dispensing Azienda or the purchasing one?

The answer determines whether the 18–55 million gap is a real difference
to display, or a bookkeeping convention to normalise away before any
comparison is published.

## Related open items

- The v2.0 document's own list of pre-development decisions includes
  "perimetro aziendale o regionale", noting that inter-Azienda
  comparison exists only at regional perimeter. That decision and this
  one should be taken together.
- Whether the minimum publishable aggregation level is the *struttura
  erogante* (as our working agreement states) or the *unità operativa*
  (as the antibiotics module already renders) is a separate but adjacent
  call.
