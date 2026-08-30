"use client";

import { Layer, Rectangle, ResponsiveContainer, Sankey, Tooltip } from "recharts";
import type { SankeyData } from "@/lib/dashboard-review/types";
import { formatEur } from "@/lib/dashboard-review/format";

const NODE_COLOR = "hsl(174 82% 39%)";
const NODE_TEXT = "hsl(204 63% 12%)";
const LINK_COLOR = "hsl(174 82% 39% / 0.25)";

interface SankeyNodeProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  payload?: { name: string };
}

function SankeyNode({ x = 0, y = 0, width = 0, height = 0, payload }: SankeyNodeProps) {
  return (
    <Layer>
      <Rectangle x={x} y={y} width={width} height={height} fill={NODE_COLOR} fillOpacity={0.85} />
      <text
        x={x + width + 8}
        y={y + height / 2}
        dy="0.35em"
        fontSize={12}
        fill={NODE_TEXT}
        textAnchor="start"
      >
        {payload?.name}
      </text>
    </Layer>
  );
}

export function SpendSankey({ data }: { data: SankeyData }) {
  if (data.links.length === 0) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Nessun flusso di spesa nell&apos;ambito selezionato.
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={420}>
      <Sankey
        data={data}
        node={<SankeyNode />}
        nodePadding={28}
        nodeWidth={12}
        linkCurvature={0.5}
        link={{ stroke: LINK_COLOR, strokeOpacity: 1 }}
        margin={{ top: 16, right: 140, bottom: 16, left: 16 }}
      >
        <Tooltip formatter={(value: number) => formatEur(value)} />
      </Sankey>
    </ResponsiveContainer>
  );
}
