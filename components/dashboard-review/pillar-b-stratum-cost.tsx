// Costo lordo osservato per unità, nello stesso strato (#costo-per-strato).
//
// A SERVER COMPONENT that prints strings: every figure, label and sentence is
// formed by lib/dashboard-review/pillar-b/stratum-cost.ts, which the tests and
// the private harness drive directly. Nothing here computes.
//
// WHAT THE MARKUP MAY NOT SAY, by the owner's decision of 17 October 2026: which
// side of a stratum is cheaper. Both sides use the SAME class constants; no
// colour, weight, icon or order depends on a value. The only mark that depends
// on data is ⚑ after a record count below three, on either side alike.
//
// Collapsed like the reconciliation above it, and open by itself when a year
// does not reconcile; such a year shows its reasons and no value per unit.
// Below the table's 44rem plus its two 1px borders (44.125rem) of its OWN
// width, the same strata in the same order as a stacked list, with the same
// strings. React keys are ordinals: a key reaches the page payload, and a
// stratum id is for reviewers only.

import { AlertTriangle, Info } from "lucide-react";
import type { StratumCostPanel } from "@/lib/dashboard-review/pillar-b/stratum-cost";

type Ready = Extract<StratumCostPanel, { kind: "ready" }>;
type Block = Ready["blocks"][number];
type Row = Block["molecules"][number]["strata"][number];
type Side = NonNullable<Row["reference"]>;

/** One class per role, shared by both sides. */
const SIDE_VALUE = "whitespace-nowrap font-mono text-xs text-foreground";
const SIDE_NOTE = "text-[11px] text-muted-foreground";
const SIDE_LABEL = "text-muted-foreground";

/** One side of a stratum, for the table cell. */
function SideCell({ side }: { side: Side | null }) {
  if (side === null) return <span className={SIDE_NOTE}>—</span>;
  return (
    <div className="flex flex-col gap-0.5">
      <span className={SIDE_VALUE}>{side.spend} · {side.quantity}</span>
      <span data-part="tariffa" className={SIDE_VALUE}>{side.rate}</span>
      <span className={SIDE_VALUE}>{side.records} record{side.fewRecords ? " ⚑" : ""}</span>
      <span data-part="canali" className={SIDE_NOTE}>{side.channels}</span>
    </div>
  );
}

/** One side of a stratum, for the stacked card. */
function SideList({ title, side }: { title: string; side: Side | null }) {
  return (
    <div>
      <p className="font-medium text-foreground">{title}</p>
      {side === null ? <p className={SIDE_NOTE}>—</p> : (<>
        <dl className="mt-0.5 grid max-w-sm grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-0.5">
          <dt className={SIDE_LABEL}>Spesa</dt><dd className={`text-right ${SIDE_VALUE}`}>{side.spend}</dd>
          <dt className={SIDE_LABEL}>Quantità</dt><dd className={`text-right ${SIDE_VALUE}`}>{side.quantity}</dd>
          <dt className={SIDE_LABEL}>€/unità</dt><dd className="text-right"><span data-part="tariffa" className={SIDE_VALUE}>{side.rate}</span></dd>
          <dt className={SIDE_LABEL}>Record</dt><dd className={`text-right ${SIDE_VALUE}`}>{side.records}{side.fewRecords ? " ⚑" : ""}</dd>
        </dl>
        <p className="mt-0.5"><span data-part="canali" className={SIDE_NOTE}>{side.channels}</span></p>
      </>)}
    </div>
  );
}

function StratumLabel({ row }: { row: Row }) {
  return (
    <>
      <span className="text-foreground">{row.label}</span>
      {row.rawId !== null && <span className="block break-all font-mono text-[10px] text-muted-foreground">{row.rawId}</span>}
    </>
  );
}

export function PillarBStratumCost({ panel }: { panel: StratumCostPanel }) {
  return (
    <details id="costo-per-strato" className="scroll-mt-8 rounded-xl border border-border bg-card p-4" open={panel.kind === "ready" && panel.open}>
      <summary className="cursor-pointer text-sm font-semibold text-foreground">{panel.summary}</summary>
      {panel.kind === "notice" ? (
        <div className="mt-3 flex gap-2.5 rounded-xl border border-border bg-muted/30 px-3.5 py-2.5 text-xs leading-relaxed">
          <Info size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
          <div>
            <p>{panel.notice}</p>
            {panel.linkToFilters && (
              <a href="#filtri" className="mt-1 inline-block rounded-lg px-2 py-1 font-medium text-primary hover:bg-primary/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
                Cambia selezione ↑
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-3 flex flex-col gap-5">
          <div className="max-w-3xl space-y-2 text-xs leading-relaxed text-muted-foreground">
            {panel.lead.map((p, i) => <p key={`l${i}`}>{p}</p>)}
          </div>

          {panel.blocks.map((b) => (
            <section key={`y${b.year}`} className="flex flex-col gap-3 border-t border-border/70 pt-4">
              <h4 className="font-display text-base font-semibold text-foreground">
                {b.heading}{b.reconciled ? "" : " · non riconciliato"}
              </h4>
              {!b.reconciled ? (
                <div className="flex gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 text-xs leading-relaxed">
                  <AlertTriangle size={14} className="mt-0.5 shrink-0 text-amber-600" />
                  <div>
                    <p className="font-semibold text-foreground">Non riconciliato: nessun costo per unità è mostrato per questo anno.</p>
                    <ul className="mt-1 list-disc space-y-0.5 pl-5">
                      {b.reasons.map((r, i) => <li key={`r${i}`}>{r}</li>)}
                    </ul>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-1 text-xs leading-relaxed text-muted-foreground">
                    <p className="text-foreground">{b.selectionLine}</p>
                    <p>{b.selection.text}</p>
                    {b.funnelLine && <p>{b.funnelLine}</p>}
                    {b.notComparedLine && <p>{b.notComparedLine}</p>}
                    {b.withoutBiosimilarLine && <p>{b.withoutBiosimilarLine}</p>}
                    {b.crossCheckLine && <p>{b.crossCheckLine}</p>}
                    {b.emptyLine && <p className="font-medium text-foreground">{b.emptyLine}</p>}
                  </div>

                  {b.molecules.map((m, i) => (
                    <div key={`m${i}`} className="flex flex-col gap-2">
                      <p className="text-sm text-foreground">
                        <span className="font-semibold">{m.substance}</span>
                        <span className="text-muted-foreground"> · {m.openingLabel} · {m.windowLabel}</span>
                      </p>
                      <p className="text-xs leading-relaxed text-muted-foreground">{m.funnelLine}</p>
                      {m.clampNote && <p className="text-xs leading-relaxed text-muted-foreground">{m.clampNote}</p>}
                      {m.strata.length === 0 ? (
                        <p className="text-xs text-muted-foreground">Nessuno strato con quantità di massa misurabile per questa molecola.</p>
                      ) : (
                        <div className="[container-type:inline-size]">
                          <ul translate="no" aria-label={`${m.substance}: strati, spesa, quantità e costo per unità di ciascun lato`}
                            className="divide-y divide-border rounded-lg border border-border text-xs [@container(min-width:44.125rem)]:hidden">
                            {m.strata.map((row, j) => (
                              <li key={`s${i}-${j}`} className="flex flex-col gap-2 px-3 py-2">
                                <p className="font-medium"><StratumLabel row={row} /></p>
                                <SideList title="Riferimento" side={row.reference} />
                                <SideList title="Biosimilare" side={row.biosimilar} />
                                <p><span className={SIDE_LABEL}>Lati: </span><span className="text-foreground">{row.sides}</span></p>
                              </li>
                            ))}
                          </ul>
                          <div className="hidden overflow-x-auto rounded-lg border border-border [@container(min-width:44.125rem)]:block">
                            <table className="w-full min-w-[44rem] text-sm" translate="no">
                              <caption className="sr-only">{m.substance}: strati, spesa, quantità e costo per unità di ciascun lato</caption>
                              <thead className="bg-muted/50 text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
                                <tr>
                                  <th scope="col" className="px-3 py-2 text-left font-semibold">Strato · via · forma · unità</th>
                                  <th scope="col" className="px-3 py-2 text-left font-semibold">Riferimento · spesa · quantità · €/unità · record</th>
                                  <th scope="col" className="px-3 py-2 text-left font-semibold">Biosimilare · spesa · quantità · €/unità · record</th>
                                  <th scope="col" className="px-3 py-2 text-left font-semibold">Lati</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-border">
                                {m.strata.map((row, j) => (
                                  <tr key={`s${i}-${j}`} className="align-top">
                                    <td className="px-3 py-2 text-xs"><StratumLabel row={row} /></td>
                                    <td className="px-3 py-2"><SideCell side={row.reference} /></td>
                                    <td className="px-3 py-2"><SideCell side={row.biosimilar} /></td>
                                    <td className="px-3 py-2 text-xs text-foreground">{row.sides}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </>
              )}
            </section>
          ))}

          {panel.fewRecordsNote && <p className="text-[11px] text-muted-foreground">{panel.fewRecordsNote}</p>}

          <details>
            <summary className="cursor-pointer text-xs font-semibold text-primary">Che cosa è escluso e perché</summary>
            <dl className="mt-2 grid gap-x-6 gap-y-2 text-xs md:grid-cols-2">
              {panel.exclusions.map((e, i) => (
                <div key={`e${i}`}>
                  <dt className="font-semibold text-foreground">{e.term}</dt>
                  <dd className="mt-0.5 text-muted-foreground">{e.meaning}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>
      )}
    </details>
  );
}
