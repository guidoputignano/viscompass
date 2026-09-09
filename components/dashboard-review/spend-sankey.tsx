"use client";

import { Layer, Rectangle, ResponsiveContainer, Sankey, Tooltip } from "recharts";
import type { SpendFlowClass, SpendFlowData } from "@/lib/dashboard-review/types";
import { formatEur, formatPercent } from "@/lib/dashboard-review/format";

// Two colours, both design-system tokens, assigned by meaning rather than by
// class identity: teal is the dispensed flow, the destructive tone is the part
// that was purchased and not dispensed. Colouring the fourteen ATC classes
// instead would need a hue per class and would encode identity where the reader
// needs polarity. Written as CSS variables so light and dark each use the value
// their own theme defines.
const DISPENSED = "hsl(var(--primary))";
const RESIDUAL = "hsl(var(--destructive))";
const CLASS_NODE = "hsl(var(--muted-foreground))";
const LABEL_INK = "hsl(var(--foreground))";
const VALUE_INK = "hsl(var(--muted-foreground))";

interface NodeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  index?: number;
  payload?: { value?: number };
}

interface LinkProps {
  sourceX?: number;
  targetX?: number;
  sourceY?: number;
  targetY?: number;
  sourceControlX?: number;
  targetControlX?: number;
  linkWidth?: number;
  index?: number;
}

function nodeFill(kind: SpendFlowData["nodes"][number]["kind"]): string {
  if (kind === "channel") return DISPENSED;
  if (kind === "residual") return RESIDUAL;
  return CLASS_NODE;
}

export function SpendSankey({ data }: { data: SpendFlowData }) {
  // Node and link identity come from the index recharts hands back rather than
  // from its computed payload, so the mapping does not depend on which of our
  // own fields survive its internal reshaping.
  const FlowNode = ({ x = 0, y = 0, width = 0, height = 0, index = 0, payload }: NodeProps) => {
    const node = data.nodes[index];
    if (!node) return <Layer />;
    const onLeft = node.kind === "class";
    return (
      <Layer>
        <Rectangle x={x} y={y} width={width} height={height} fill={nodeFill(node.kind)} fillOpacity={0.9} />
        <text
          x={onLeft ? x - 8 : x + width + 8}
          y={y + height / 2}
          dy="-0.15em"
          fontSize={11}
          fontWeight={600}
          fill={LABEL_INK}
          textAnchor={onLeft ? "end" : "start"}
        >
          {node.name}
        </text>
        <text
          x={onLeft ? x - 8 : x + width + 8}
          y={y + height / 2}
          dy="1.0em"
          fontSize={10}
          fill={VALUE_INK}
          textAnchor={onLeft ? "end" : "start"}
        >
          {formatEur(payload?.value ?? 0)}
        </text>
      </Layer>
    );
  };

  const FlowLink = ({
    sourceX = 0,
    targetX = 0,
    sourceY = 0,
    targetY = 0,
    sourceControlX = 0,
    targetControlX = 0,
    linkWidth = 0,
    index = 0,
  }: LinkProps) => {
    const link = data.links[index];
    const stroke = link?.kind === "residual" ? RESIDUAL : DISPENSED;
    return (
      <path
        d={`M${sourceX},${sourceY}C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
        fill="none"
        stroke={stroke}
        strokeWidth={Math.max(linkWidth, 1)}
        strokeOpacity={link?.kind === "residual" ? 0.4 : 0.24}
      />
    );
  };

  if (data.links.length === 0 && data.negative_classes.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Nessun flusso di spesa nell&apos;ambito selezionato.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Total label="Acquistato" value={data.total_acquistato_eur} />
        <Total label="Erogato" value={data.total_erogato_eur} />
        <Total
          label="Differenza"
          value={data.net_eur}
          detail={
            data.total_erogato_eur > 0
              ? `${formatPercent(data.net_eur / data.total_erogato_eur)} dell’erogato`
              : undefined
          }
        />
      </div>

      {data.links.length > 0 && (
        <>
          <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
            <Swatch color={DISPENSED} label="Erogato, per canale" />
            <Swatch color={RESIDUAL} label="Residuo non erogato" />
          </div>

          <ResponsiveContainer width="100%" height={Math.max(420, data.nodes.length * 58)}>
            <Sankey
              data={data}
              node={<FlowNode />}
              link={<FlowLink />}
              nodePadding={38}
              nodeWidth={12}
              linkCurvature={0.5}
              margin={{ top: 24, right: 172, bottom: 24, left: 214 }}
            >
              <Tooltip
                formatter={(value: number) => formatEur(value)}
                contentStyle={{
                  borderRadius: 10,
                  border: "1px solid hsl(var(--border))",
                  background: "hsl(var(--popover))",
                  color: "hsl(var(--popover-foreground))",
                  fontSize: 12,
                }}
              />
            </Sankey>
          </ResponsiveContainer>

          <p className="text-[11px] leading-5 text-muted-foreground">
            Il diagramma comprende soltanto le classi con residuo non negativo. I valori indicati
            sui nodi di canale sono quindi riferiti a queste classi, non all’intero perimetro: i
            totali completi sono quelli in alto.
          </p>

          <ClassTable
            caption="Classi con residuo positivo, ordinate per valore non erogato"
            rows={data.classes}
          />
        </>
      )}

      {data.negative_classes.length > 0 && (
        <section className="rounded-xl border border-border bg-secondary/30 p-4 md:p-5">
          <h3 className="text-sm font-semibold text-foreground">
            Erogato senza acquistato corrispondente (attribuzione centralizzata)
          </h3>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">
            In queste classi l’erogato supera l’acquistato. Il residuo sarebbe negativo e un
            diagramma di flusso non può rappresentarlo, quindi le classi sono riportate qui invece
            di essere azzerate. Non si tratta di scorte: gli acquisti per il perimetro sono
            effettuati centralmente dall’Azienda 130203, mentre l’erogazione è registrata
            localmente, così l’Azienda che eroga può risultare priva dell’acquisto corrispondente.
          </p>
          <ClassTable rows={data.negative_classes} negative />
        </section>
      )}

      <Caption data={data} />
    </div>
  );
}

function Total({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">{label}</p>
      <p className="font-display mt-1 text-lg text-foreground">{formatEur(value)}</p>
      {detail && <p className="mt-0.5 text-[11px] text-muted-foreground">{detail}</p>}
    </div>
  );
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <span className="flex items-center gap-2">
      <span aria-hidden="true" className="h-2.5 w-5 rounded-full" style={{ background: color, opacity: 0.55 }} />
      {label}
    </span>
  );
}

function ClassTable({
  rows,
  caption,
  negative = false,
}: {
  rows: SpendFlowClass[];
  caption?: string;
  negative?: boolean;
}) {
  return (
    <div className="mt-3 overflow-x-auto">
      {caption && <p className="mb-2 text-[11px] text-muted-foreground">{caption}</p>}
      <table className="w-full min-w-[520px] text-xs">
        <thead>
          <tr className="border-b border-border text-left text-[10px] uppercase tracking-[0.1em] text-muted-foreground">
            <th className="py-2 pr-4 font-semibold">Classe ATC</th>
            <th className="py-2 pr-4 text-right font-semibold">Acquistato</th>
            <th className="py-2 pr-4 text-right font-semibold">Erogato</th>
            <th className="py-2 pr-4 text-right font-semibold">{negative ? "Scarto" : "Residuo"}</th>
            <th className="py-2 text-right font-semibold">% della classe</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.code} className="border-b border-border/60 last:border-0">
              <td className="py-2 pr-4">
                {/* The unattributed bucket has no ATC code, so its label stands alone. */}
                {row.code !== row.label && (
                  <span className="font-mono text-[10px] text-muted-foreground">{row.code} </span>
                )}
                <span className="text-foreground">{row.label}</span>
              </td>
              <td className="py-2 pr-4 text-right font-mono">{formatEur(row.acquistato_eur)}</td>
              <td className="py-2 pr-4 text-right font-mono">{formatEur(row.erogato_eur)}</td>
              <td className="py-2 pr-4 text-right font-mono">{formatEur(row.residual_eur)}</td>
              <td className="py-2 text-right font-mono">
                {row.residual_share === null ? "—" : formatPercent(row.residual_share)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// The analytical point, stated from the data rather than from fixed prose: which
// class carries the most purchasing, how tight its residual is, and which classes
// leak hardest as a share of themselves.
function Caption({ data }: { data: SpendFlowData }) {
  const withShare = data.classes.filter(
    // A real ATC first level is a single letter. The bucket holding rows whose
    // AIC never resolved to a class is a data-quality residue, not a
    // therapeutic class, and would otherwise top the ranking at 100% and say
    // nothing about where clinical attention belongs.
    (row): row is SpendFlowClass & { residual_share: number } =>
      row.residual_share !== null && /^[A-Z]$/.test(row.code),
  );
  if (withShare.length < 2) return null;

  const largest = [...withShare].sort((a, b) => b.acquistato_eur - a.acquistato_eur)[0];
  const leakiest = [...withShare]
    .filter((row) => row.code !== largest.code)
    .sort((a, b) => b.residual_share - a.residual_share)
    .slice(0, 2);
  const multiples = leakiest
    .map((row) => (largest.residual_share > 0 ? row.residual_share / largest.residual_share : null))
    .filter((value): value is number => value !== null && Number.isFinite(value));
  const ratioPhrase =
    multiples.length === 2
      ? `da ${Math.round(Math.min(...multiples))} a ${Math.round(Math.max(...multiples))} volte`
      : "diverse volte";

  return (
    <p className="text-xs leading-6 text-muted-foreground">
      La classe che concentra il maggior valore di acquisto, {largest.label} ({largest.code}), ha
      anche il residuo più contenuto: {formatPercent(largest.residual_share)} di quanto acquistato.
      Classi molto più piccole in valore assoluto disperdono {ratioPhrase} tanto in proporzione:{" "}
      {leakiest
        .map((row) => `${row.label} (${row.code}) al ${formatPercent(row.residual_share)}`)
        .join(", ")}
      . È la percentuale sulla classe, non il valore assoluto in euro, a indicare dove l’attenzione
      è giustificata: un residuo di pochi milioni su una classe piccola segnala un problema di
      processo che lo stesso importo su {largest.code} non segnalerebbe.
    </p>
  );
}
