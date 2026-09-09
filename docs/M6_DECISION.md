# Decision: M6 (Confronto fra Aziende) compares on erogato only

**For:** Guido Putignano, Foundation President
**Prepared:** 2026-09-09
**Decision owner:** Foundation President, with the external reviewer where relevant
**Status:** decided, one confirmation outstanding

## The question in one line

M6 publishes a comparison between Aziende. Purchase figures and
dispensing figures differ by 18 to 55 million euro per Azienda while
reconciling almost exactly at regional level. Which of the two bases can
carry a comparison between Aziende?

## Why this is being raised now

An earlier version of this note read the per-Azienda gap as a data
quality failure and proposed gating M6 against the 5% threshold in
*Governance della spesa farmaceutica* (v2.0). That reading was wrong.
The direction of the gaps rules it out, and the corrected reading
changes the decision rather than softening it.

## The measurement

Recomputed directly from
`DIR_OSP_TRA_003AS_SellInSellOut_nuova_estrazione_2025.xlsx`, 2025,
Abruzzo, 13,116 rows.

At regional level the file reconciles:

| | Value |
|---|---:|
| Acquistato | 450,956,253 |
| Erogato | 451,587,418 |
| Net | **−631,165** (−0.14% of erogato) |

Per Azienda it does not:

| ASL | Acquistato | Erogato | Difference | vs erogato |
|---|---:|---:|---:|---:|
| 130201 | 82,648,601 | 100,534,922 | **−17,886,321** | −17.8% |
| 130202 | 97,913,030 | 119,290,293 | **−21,377,263** | −17.9% |
| 130203 | 189,036,511 | 133,645,086 | **+55,391,425** | +41.5% |
| 130204 | 80,308,346 | 98,117,117 | **−17,808,771** | −18.2% |

The table uses *Costo aziendale stimato* `(h)` as the purchase basis,
which is the basis the v2.0 document used. The file's own variance
column instead uses `(g se disponibile oppure h)`, which gives −18.96M,
−23.39M, +43.25M and −19.23M. The choice of basis does not change the
finding: the signs and the ordering are identical under either.

A residual 1,049,765 of acquistato sits outside the four Aziende, in an
out-of-perimeter ASL row (130106) and an unattributed `ND` bucket, with
no erogato against it. The four Aziende plus that residual account for
the regional total exactly.

## What the numbers say

**Three Aziende dispense more than they purchase. One purchases far more
than it dispenses.** Stock accumulation explains 130203 and only 130203.
It cannot explain the other three, because an Azienda cannot dispense
what it never purchased.

Set that against a regional net of −0.14% and one explanation remains:
**130203 procures on behalf of the perimeter, and dispensing is recorded
locally.** The three deviations of the opposite sign cluster between
−17.8% and −18.2%, which is what a shared central purchasing
arrangement looks like and not what four independent procurement
failures would look like.

This is an **accounting attribution convention, not a performance
difference, and not a data quality failure.** The regional
reconciliation is in fact the evidence that the file is trustworthy: the
euros are all present and accounted for, they are simply booked to the
purchasing entity rather than the dispensing one.

Two further facts bound how the data can be used:

- **32.4% of the purchase valuation by value is backed by an observed
  company price**, covering 44.2% of valued rows (4,586 of 10,367). The
  remainder is estimated from the regional average price. A comparison
  of purchase values between Aziende would therefore be partly a
  comparison between estimates, on top of being mis-attributed.
- **60.4% of rows deviate by more than 20% and 46.0% by more than 50%**
  (6,998 and 5,331 of the 11,586 rows that carry a deviation
  percentage). Row-level noise is high even where regional totals agree,
  which is a further reason to compare on the measured side.
- At record level, **9,818,286 EUR of acquistato sits on rows with zero
  erogato, and 23,993,163 EUR of erogato sits on rows with zero
  acquistato.** Same convention, visible one row at a time.

## The decision

**Cross-Azienda comparison in M6 is computed on erogato only.**

Erogato is recorded where the dispensing happens, so it is attributable
to the Azienda by construction. Acquistato is not, under central
purchasing, and a comparison of purchase totals between Aziende is
**invalid by construction and must never be published.** This is not a
threshold to be tuned or a caveat to be attached. It is a statement
about what the acquistato column means.

Concretely:

1. M6 aggregates the dispensed basis for every cross-Azienda view.
2. Where only an acquistato basis is available for a perimeter, M6
   returns unavailable with an explicit reason, rather than falling back
   to a comparison it cannot support.
3. Acquistato remains available and useful **within** a single Azienda,
   and at regional total, where no attribution question arises.
4. M6's availability rules by titolarità are unchanged. A regional user
   sees the perimeter, an Azienda sees itself.

The 5% gate in the v2.0 document should be read as a check on the
*regional* reconciliation, where the file passes at 0.14%, not as a
per-Azienda publication gate. Applied per Azienda it would suppress
correct data on the strength of a bookkeeping convention.

## Why this is the commercially stronger position

M6 is described in our own materials as the module with the highest
perceived value, and inter-Azienda comparison is the function a Region
buys. Publishing it on erogato keeps the feature intact and makes it
defensible: the first competent reader who asks "why does my Azienda
look worse than the one next door" gets an answer about dispensing,
measured where it happened, rather than an artefact of who signed the
purchase order.

It also matches the stated differentiator. VIS ingests the institution's
own reconciliation file and makes discrepancies explainable. Here the
discrepancy is explained, and the explanation is what determines the
product behaviour.

## What we need from the institution to close it

One question, addressed to whoever administers the reporting platform
rather than to the administrative contact:

> We read the 2025 sell-in / sell-out file as showing that purchases for
> the perimeter are procured centrally through 130203 while dispensing
> is recorded at the Azienda that dispenses. Is that correct, and is
> 130203 the central purchasing point for the perimeter?

We need this in writing. The product behaviour above does not depend on
the answer, since erogato is the right basis for comparison either way.
Written confirmation lets us state the reason for the gap to users
rather than inferring it.

## Related open items

- The v2.0 document's own list of pre-development decisions includes
  "perimetro aziendale o regionale", noting that inter-Azienda
  comparison exists only at regional perimeter. That is consistent with
  this decision and should be recorded alongside it.
- Whether the minimum publishable aggregation level is the *struttura
  erogante* (as our working agreement states) or the *unità operativa*
  (as the antibiotics module already renders) is a separate but adjacent
  call.
- The `ND` acquistato bucket (1,047,956) has no dispensing against it
  and no Azienda attached. Worth raising in the same message.
