"use client";

import React, { useState, useMemo } from "react";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, Legend
} from "recharts";
import {
  LayoutDashboard, PieChart as PieIcon, Radar, ShieldCheck, Boxes,
  Building2, ChevronDown, TrendingUp, TrendingDown, AlertTriangle,
  CheckCircle2, Clock, Search, Columns3, Database
} from "lucide-react";

const NAVY = "#1A2B45";
const TEAL = "#00C9A7";
const TEAL_DARK = "#0F6E56";
const GREY_BG = "#F4F5F6";
const AMBER = "#E8A33D";
const RED = "#D9534F";

const ASLS = ["1", "2", "3", "4"];
const TENANT_OPTIONS = ["Regione (tutte le ASL)", ...ASLS];

// Source: asl-consumption-spend-extract
const spendByAtc = [
  { code: "L", label: "Antineoplastici e immunomodulatori", v2026: 84.2, v2025: 83.0 },
  { code: "B", label: "Sangue e organi emopoietici", v2026: 25.0, v2025: 26.2 },
  { code: "A", label: "Apparato gastrointestinale", v2026: 13.8, v2025: 17.6 },
  { code: "J", label: "Antimicrobici per uso sistemico", v2026: 12.5, v2025: 12.9 },
  { code: "N", label: "Sistema nervoso", v2026: 11.4, v2025: 10.0 },
];

// Source: asl-consumption-spend-extract
const topMovers = [
  { name: "ZOLGENSMA", delta: 2.51, dir: "up" },
  { name: "MOUNJARO", delta: 1.22, dir: "up" },
  { name: "VYNDAQEL", delta: 0.62, dir: "up" },
  { name: "FORXIGA", delta: -1.63, dir: "down" },
  { name: "GILENYA", delta: -1.34, dir: "down" },
];

// Source: aifa-liste-trasparenza
const biosimilarTrend = [
  { year: "2022", pct: 51 },
  { year: "2023", pct: 58 },
  { year: "2024", pct: 63 },
  { year: "2025", pct: 68 },
  { year: "2026", pct: 72 },
];

// Source: aifa-liste-trasparenza
const biosimilarPie = [
  { name: "Biosimilare", value: 72 },
  { name: "Originator / brand", value: 28 },
];

// Source: egualia-scadenze-brevettuali-generici, egualia-scadenze-brevettuali-biosimilari
const patentExpiries = [
  { drug: "OCREVUS", molecule: "ocrelizumab", date: "Mar 2027", window: "far" },
  { drug: "STELARA", molecule: "ustekinumab", date: "Nov 2026", window: "near" },
  { drug: "KEYTRUDA", molecule: "pembrolizumab", date: "Jun 2028", window: "far" },
  { drug: "GILENYA", molecule: "fingolimod", date: "already expired", window: "past" },
  { drug: "JARDIANCE", molecule: "empagliflozin", date: "Jan 2027", window: "near" },
];

// Source: file-f-flow
const complianceRows = [
  { item: "Registro AIFA — Oncologici L01", status: "ok", due: "—" },
  { item: "File F — trasmissione mensile", status: "ok", due: "—" },
  { item: "Registro AIFA — Biologici B01", status: "warn", due: "in 6 giorni" },
  { item: "Scheda fine trattamento — Reparto Oncologia", status: "late", due: "scaduta 3 giorni fa" },
  { item: "File F — riconciliazione trimestrale", status: "ok", due: "—" },
];

// Source: asl-consumption-spend-extract, aifa-farmaci-carenti
const stockRows = [
  { drug: "KAFTRIO", qty: 42, expiry: "Sep 2026", risk: "warn" },
  { drug: "DARZALEX", qty: 118, expiry: "Apr 2027", risk: "ok" },
  { drug: "HYQVIA", qty: 6, expiry: "Oct 2026", risk: "late" },
  { drug: "IBRANCE", qty: 55, expiry: "Jan 2027", risk: "ok" },
  { drug: "BINOCRIT", qty: 14, expiry: "Aug 2026", risk: "late" },
];

// Source: asl-consumption-spend-extract
const capData = [
  { asl: "1", used: 82 },
  { asl: "2", used: 96 },
  { asl: "3", used: 71 },
  { asl: "4", used: 88 },
];

// Source: asl-consumption-spend-extract, cross-referenced across ASL tenants
const crossAslMolecules = [
  {
    molecule: "Rituximab",
    note: "3 of 4 ASL have converted to biosimilar — ASL 4 has not",
    rows: [
      { asl: "1", pct: 71, flag: "ok" },
      { asl: "2", pct: 68, flag: "ok" },
      { asl: "3", pct: 74, flag: "ok" },
      { asl: "4", pct: 12, flag: "gap" },
    ],
  },
  {
    molecule: "Trastuzumab",
    note: "Penetration below regional average in two ASL",
    rows: [
      { asl: "1", pct: 44, flag: "warn" },
      { asl: "2", pct: 81, flag: "ok" },
      { asl: "3", pct: 39, flag: "warn" },
      { asl: "4", pct: 76, flag: "ok" },
    ],
  },
];

const modules = [
  { id: "spend", label: "Spend & Consumption", icon: LayoutDashboard, tag: "M1" },
  { id: "biosimilar", label: "Biosimilar Governance", icon: PieIcon, tag: "M2" },
  { id: "patent", label: "Patent-Expiry Radar", icon: Radar, tag: "M2" },
  { id: "compliance", label: "AIFA / File F Compliance", icon: ShieldCheck, tag: "M3" },
  { id: "stock", label: "Stock & Shortage", icon: Boxes, tag: "M4" },
  { id: "cap", label: "Procurement Cap", icon: TrendingUp, tag: "M1" },
  { id: "cross", label: "Cross-Authority Comparison", icon: Columns3, tag: "M6", flagship: true },
  { id: "sources", label: "Data Sources", icon: Database, tag: "Ref" },
];

// Reference config — mirrors VIS_PHARMA_COMPASS_Master_Database.xlsx, sheet Source_Catalog (S01–S16).
// That workbook is the source of truth; this array and data-sources.json are generated from it.
const dataSources = [
  { id: "S01", name: "DB_Cruscotto_Farmaceutica.xlsx", type: "available", owner: "Abruzzo working group", cadence: "extract", feedsModules: ["M1", "M2", "M6"], note: "Detailed development corpus with product text and flags. 261,153 rows across AQ, CH, PE, TE." },
  { id: "S02", name: "Cruscotto_Farmaceutica.xlsx", type: "available", owner: "Abruzzo working group", cadence: "manual", feedsModules: ["M1", "M2", "M6"], note: "Functional prototype; not a production pipeline. Functional specification for M1/M2/M6." },
  { id: "S03", name: "AIFA/NSIS national CSV", type: "external-public", owner: "AIFA / Ministry", cadence: "monthly", feedsModules: ["M1", "M6"], note: "National benchmark; no AIC or ASL granularity. Verified public, 2016 onward." },
  { id: "S04", name: "AIFA biosimilar reports", type: "external-public", owner: "AIFA", cadence: "periodic", feedsModules: ["M2", "M6"], note: "PDF extraction requires page lineage and validation. Public archives 2020–2025." },
  { id: "S05", name: "AIFA Anagrafica Farmaci", type: "external-public", owner: "AIFA", cadence: "daily", feedsModules: ["M1", "M2", "M4"], note: "Product dictionary, not regional utilisation. VERIFIED: drive.aifa.gov.it bulk CSV, ~82MB." },
  { id: "S06", name: "AIFA Principi Attivi", type: "external-public", owner: "AIFA", cadence: "daily", feedsModules: ["M1", "M2"], note: "VERIFIED: 72,203 product-ingredient rows, 58,496 distinct AICs, 24,034 with usable quantity." },
  { id: "S07", name: "WHO ATC/DDD", type: "external-public", owner: "WHO Collaborating Centre", cadence: "periodic", feedsModules: ["M1", "M2"], note: "DDD denominator, not pack content or local price." },
  { id: "S08", name: "Egualia LOE calendar", type: "external-public", owner: "Egualia", cadence: "annual PDF", feedsModules: ["M2"], note: "Dates indicative — patent-linkage caveat: even AIFA's own dates are 'theoretical'." },
  { id: "S09", name: "Farmadati / equivalent", type: "external-licensed", owner: "Licensed provider", cadence: "licensed", feedsModules: ["M1", "M2"], note: "Gap/validation source after the public S05/S06 coverage benchmark is measured." },
  { id: "S10", name: "Authenticated NSIS OSP/DIR reports", type: "institutional", owner: "Ministry/authority", cadence: "monthly", feedsModules: ["M1", "M2", "M6"], note: "Request OSP_005/007/009/012 + DIR equivalents via institutional access or data-sharing agreement." },
  { id: "S11", name: "File F and Registry exports", type: "client-required", owner: "Participating authority", cadence: "monthly", feedsModules: ["M3"], note: "Minimum lawful fields only." },
  { id: "S12", name: "Inventory/batch feed", type: "client-required", owner: "Participating authority", cadence: "daily/weekly", feedsModules: ["M4"], note: "Stock, expiry and redistribution." },
  { id: "S13", name: "Aggregate compounding logs", type: "client-required", owner: "Participating authority", cadence: "daily", feedsModules: ["M5"], note: "No patient-level dose calculation." },
  { id: "S14", name: "Financial control totals", type: "client-required", owner: "Authority finance", cadence: "monthly", feedsModules: ["M1", "M2", "M3", "M4", "M5", "M6"], note: "Publication reconciliation control." },
  { id: "S15", name: "Population denominators", type: "external-public", owner: "ISTAT/Region", cadence: "annual", feedsModules: ["M1", "M6"], note: "Fair per-capita comparison." },
  { id: "S16", name: "Tender/award prices", type: "client-required", owner: "Procurement body", cadence: "event", feedsModules: ["M2"], note: "Procurement enrichment; may be commercially sensitive, where permitted." },
];

function StatusPill({ status }) {
  const map = {
    ok: { bg: "#E3F7F0", text: TEAL_DARK, label: "In regola", Icon: CheckCircle2 },
    warn: { bg: "#FCF1DF", text: "#8A5A16", label: "In scadenza", Icon: Clock },
    late: { bg: "#FBE7E6", text: "#8C2C29", label: "Scaduto", Icon: AlertTriangle },
  };
  const s = map[status];
  const I = s.Icon;
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium"
      style={{ background: s.bg, color: s.text }}
    >
      <I size={13} /> {s.label}
    </span>
  );
}

function Card({ title, subtitle, children, className = "" }) {
  return (
    <div className={`bg-white rounded-xl border border-gray-200 p-5 ${className}`}>
      {title && (
        <div className="mb-4">
          <h3 className="text-sm font-semibold" style={{ color: NAVY }}>{title}</h3>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      )}
      {children}
    </div>
  );
}

function KpiCard({ label, value, delta, deltaLabel, positiveIsGood = true }) {
  const isUp = delta >= 0;
  const good = isUp === positiveIsGood;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-2xl font-semibold mt-1" style={{ color: NAVY }}>{value}</p>
      {delta !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-xs font-medium`} style={{ color: good ? TEAL_DARK : RED }}>
          {isUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
          {Math.abs(delta)}% {deltaLabel}
        </div>
      )}
    </div>
  );
}

function SpendScreen() {
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-4 gap-4">
        <KpiCard label="Spesa totale 2026" value="€183.4M" delta={1.1} deltaLabel="vs 2025" positiveIsGood={false} />
        <KpiCard label="Categoria top" value="Antineoplastici" delta={1.4} deltaLabel="quota spesa" positiveIsGood={false} />
        <KpiCard label="Accessi coperti" value="1,625/anno" />
        <KpiCard label="ASL monitorate" value="4" />
      </div>
      <div className="grid grid-cols-3 gap-5">
        <Card title="Spesa per categoria ATC" subtitle="Milioni di euro, 2026 vs 2025" className="col-span-2">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={spendByAtc} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEE" />
              <XAxis dataKey="code" tick={{ fontSize: 12, fill: "#666" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: "#666" }} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(v, n) => [`€${v}M`, n === "v2026" ? "2026" : "2025"]}
                labelFormatter={(l) => spendByAtc.find(d => d.code === l)?.label}
              />
              <Bar dataKey="v2025" fill="#D8DDE3" radius={[4, 4, 0, 0]} barSize={18} />
              <Bar dataKey="v2026" fill={TEAL} radius={[4, 4, 0, 0]} barSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Top movimenti" subtitle="Variazione spesa, milioni €">
          <div className="space-y-3">
            {topMovers.map((m) => (
              <div key={m.name} className="flex items-center justify-between">
                <span className="text-sm font-medium" style={{ color: NAVY }}>{m.name}</span>
                <span
                  className="flex items-center gap-1 text-sm font-semibold"
                  style={{ color: m.dir === "up" ? RED : TEAL_DARK }}
                >
                  {m.dir === "up" ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  {m.delta > 0 ? "+" : ""}{m.delta}M
                </span>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}

function BiosimilarScreen() {
  const colors = [TEAL, "#D8DDE3"];
  return (
    <div className="grid grid-cols-3 gap-5">
      <Card title="Penetrazione biosimilari" subtitle="Quota su molecole a brevetto scaduto, 2026">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie data={biosimilarPie} dataKey="value" innerRadius={55} outerRadius={80} paddingAngle={2}>
              {biosimilarPie.map((_, i) => <Cell key={i} fill={colors[i]} />)}
            </Pie>
            <Tooltip formatter={(v) => `${v}%`} />
            <Legend iconType="circle" wrapperStyle={{ fontSize: 12 }} />
          </PieChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Trend penetrazione" subtitle="% biosimilare, ultimi 5 anni" className="col-span-2">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={biosimilarTrend} margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEE" />
            <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#666" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#666" }} axisLine={false} tickLine={false} domain={[40, 80]} />
            <Tooltip formatter={(v) => `${v}%`} />
            <Line type="monotone" dataKey="pct" stroke={TEAL_DARK} strokeWidth={2.5} dot={{ r: 4, fill: TEAL_DARK }} />
          </LineChart>
        </ResponsiveContainer>
      </Card>
      <Card title="Opportunità di risparmio" subtitle="Molecole con margine di switch" className="col-span-3">
        <div className="grid grid-cols-3 gap-4">
          {["Rituximab", "Trastuzumab", "Bevacizumab"].map((mol, i) => (
            <div key={mol} className="rounded-lg p-3" style={{ background: "#F4F5F6" }}>
              <p className="text-sm font-semibold" style={{ color: NAVY }}>{mol}</p>
              <p className="text-xs text-gray-500 mt-1">Quota biosimilare attuale: {[54, 61, 47][i]}%</p>
              <p className="text-xs font-medium mt-1" style={{ color: TEAL_DARK }}>Stima risparmio addizionale: €{[210, 180, 260][i]}k/anno</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function PatentScreen() {
  const badge = { far: { bg: "#EEF1F4", text: "#556070" }, near: { bg: "#FCF1DF", text: "#8A5A16" }, past: { bg: "#E3F7F0", text: TEAL_DARK } };
  const label = { far: "oltre 12 mesi", near: "entro 12 mesi", past: "già scaduto" };
  return (
    <Card title="Radar scadenze brevetto" subtitle="Molecole in monitoraggio, prossimo ingresso biosimilare">
      <div className="divide-y divide-gray-100">
        {patentExpiries.map((p) => (
          <div key={p.drug} className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-semibold" style={{ color: NAVY }}>{p.drug}</p>
              <p className="text-xs text-gray-500">{p.molecule}</p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-gray-600">{p.date}</span>
              <span
                className="px-2.5 py-1 rounded-full text-xs font-medium"
                style={{ background: badge[p.window].bg, color: badge[p.window].text }}
              >
                {label[p.window]}
              </span>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ComplianceScreen() {
  const okCount = complianceRows.filter(r => r.status === "ok").length;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Adempimenti in regola" value={`${okCount}/${complianceRows.length}`} />
        <KpiCard label="In scadenza (7gg)" value="1" />
        <KpiCard label="Scaduti" value="1" delta={0} deltaLabel="richiede azione" positiveIsGood={false} />
      </div>
      <Card title="Registri AIFA e File F" subtitle="Stato adempimenti per ASL">
        <div className="divide-y divide-gray-100">
          {complianceRows.map((r) => (
            <div key={r.item} className="flex items-center justify-between py-3">
              <div>
                <p className="text-sm font-medium" style={{ color: NAVY }}>{r.item}</p>
                {r.due !== "—" && <p className="text-xs text-gray-500 mt-0.5">{r.due}</p>}
              </div>
              <StatusPill status={r.status} />
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function StockScreen() {
  return (
    <Card title="Scorte, scadenze e shortage" subtitle="Livelli critici e in avvicinamento a scadenza">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
            <th className="pb-2 font-medium">Farmaco</th>
            <th className="pb-2 font-medium">Quantità</th>
            <th className="pb-2 font-medium">Scadenza</th>
            <th className="pb-2 font-medium">Stato</th>
          </tr>
        </thead>
        <tbody>
          {stockRows.map((r) => (
            <tr key={r.drug} className="border-b border-gray-50 last:border-0">
              <td className="py-3 font-medium" style={{ color: NAVY }}>{r.drug}</td>
              <td className="py-3 text-gray-600">{r.qty} unità</td>
              <td className="py-3 text-gray-600">{r.expiry}</td>
              <td className="py-3"><StatusPill status={r.risk} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function CrossAuthorityScreen() {
  const flagStyle = {
    ok: { bg: "#E3F7F0", text: TEAL_DARK },
    warn: { bg: "#FCF1DF", text: "#8A5A16" },
    gap: { bg: "#FBE7E6", text: "#8C2C29" },
  };
  return (
    <div className="space-y-5">
      <div
        className="rounded-xl p-4 text-sm"
        style={{ background: "#F0EDFB", color: "#4A3B8A", border: "1px solid #DCD5F3" }}
      >
        Regional view — visible only under a Region-level contract. Same molecule, same channel,
        compared across every ASL in the perimeter.
      </div>
      {crossAslMolecules.map((m) => (
        <Card key={m.molecule} title={m.molecule} subtitle={m.note}>
          <div className="grid grid-cols-4 gap-3">
            {m.rows.map((r) => (
              <div
                key={r.asl}
                className="rounded-lg p-3 text-center"
                style={{ background: flagStyle[r.flag].bg }}
              >
                <p className="text-xs font-medium" style={{ color: flagStyle[r.flag].text }}>ASL {r.asl}</p>
                <p className="text-xl font-semibold mt-1" style={{ color: flagStyle[r.flag].text }}>{r.pct}%</p>
                <p className="text-[11px] mt-0.5" style={{ color: flagStyle[r.flag].text }}>biosimilare</p>
              </div>
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

function DataSourcesScreen() {
  const typeStyle = {
    available: { bg: "#E3F7F0", text: TEAL_DARK, label: "In hand" },
    "external-public": { bg: "#E6F0FB", text: "#1D5EA8", label: "Public" },
    "external-licensed": { bg: "#FCF1DF", text: "#8A5A16", label: "Licensed" },
    institutional: { bg: "#FBE7E6", text: "#8C2C29", label: "Institutional access" },
    "client-required": { bg: "#F1EDFB", text: "#5B3FA8", label: "Client required" },
  };
  return (
    <Card title="Data sources & ingestion" subtitle="Source_Catalog S01–S16 — see VIS_PHARMA_COMPASS_Master_Database.xlsx for the authoritative version">
      <div className="divide-y divide-gray-100">
        {dataSources.map((d) => (
          <div key={d.id} className="py-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold" style={{ color: NAVY }}>{d.id} · {d.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">{d.owner} · {d.cadence}</p>
                <p className="text-xs text-gray-500 mt-1">{d.note}</p>
              </div>
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                <span
                  className="px-2.5 py-1 rounded-full text-xs font-medium whitespace-nowrap"
                  style={{ background: typeStyle[d.type].bg, color: typeStyle[d.type].text }}
                >
                  {typeStyle[d.type].label}
                </span>
                <span className="text-xs text-gray-400">{d.feedsModules.join(", ")}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CapScreen() {
  return (
    <Card title="Tetto acquisti diretti" subtitle="% del tetto regionale utilizzato per ASL, 2026">
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={capData} layout="vertical" margin={{ left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#EEE" />
          <XAxis type="number" domain={[0, 110]} tick={{ fontSize: 12, fill: "#666" }} axisLine={false} tickLine={false} />
          <YAxis type="category" dataKey="asl" tick={{ fontSize: 13, fill: NAVY, fontWeight: 600 }} axisLine={false} tickLine={false} width={40} />
          <Tooltip formatter={(v) => `${v}% del tetto`} />
          <Bar dataKey="used" radius={[0, 4, 4, 0]} barSize={22}>
            {capData.map((d, i) => (
              <Cell key={i} fill={d.used >= 90 ? RED : d.used >= 80 ? AMBER : TEAL} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <p className="text-xs text-gray-500 mt-2">Soglia di attenzione: 80% · Soglia critica: 90%</p>
    </Card>
  );
}

export default function PrototypeFarmaciaDashboard() {
  const [active, setActive] = useState("spend");
  const [asl, setAsl] = useState("1");
  const [aslOpen, setAslOpen] = useState(false);
  const isRegionView = asl.startsWith("Regione");

  const activeModule = useMemo(() => modules.find(m => m.id === active), [active]);

  const screens = {
    spend: <SpendScreen />,
    biosimilar: <BiosimilarScreen />,
    patent: <PatentScreen />,
    compliance: <ComplianceScreen />,
    stock: <StockScreen />,
    cap: <CapScreen />,
    cross: <CrossAuthorityScreen />,
    sources: <DataSourcesScreen />,
  };

  return (
    <div className="flex w-full min-h-[720px] font-sans" style={{ background: GREY_BG }}>
      <aside className="w-60 flex-shrink-0 flex flex-col" style={{ background: NAVY }}>
        <div className="px-5 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
          <p className="text-white font-bold text-lg tracking-tight">
            bio<span style={{ color: TEAL }}>ERGO</span>tech
          </p>
          <p className="text-xs mt-0.5" style={{ color: "rgba(255,255,255,0.55)" }}>Farmacia Ospedaliera</p>
        </div>

        <div className="px-4 pt-4 pb-2 relative">
          <button
            onClick={() => setAslOpen(!aslOpen)}
            className="w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm"
            style={{ background: "rgba(255,255,255,0.06)", color: "white" }}
          >
            <span className="flex items-center gap-2 truncate">
              <Building2 size={15} className="flex-shrink-0" />
              {isRegionView ? asl : `ASL ${asl}`}
            </span>
            <ChevronDown size={14} className="flex-shrink-0" />
          </button>
          {aslOpen && (
            <div className="absolute left-4 right-4 mt-1 rounded-lg overflow-hidden z-10" style={{ background: NAVY, border: "1px solid rgba(255,255,255,0.1)" }}>
              {TENANT_OPTIONS.map(a => (
                <button
                  key={a}
                  onClick={() => { setAsl(a); setAslOpen(false); }}
                  className="w-full text-left px-3 py-2 text-sm text-white hover:opacity-80"
                  style={{ background: a === asl ? "rgba(0,201,167,0.2)" : "transparent" }}
                >
                  {a.startsWith("Regione") ? a : `ASL ${a}`}
                </button>
              ))}
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 py-3 space-y-1">
          {modules.map((m) => {
            const I = m.icon;
            const isActive = m.id === active;
            return (
              <button
                key={m.id}
                onClick={() => setActive(m.id)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm text-left transition-colors"
                style={{
                  background: isActive ? TEAL : "transparent",
                  color: isActive ? NAVY : "rgba(255,255,255,0.75)",
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                <I size={16} className="flex-shrink-0" />
                <span className="flex-1">{m.label}</span>
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded"
                  style={{
                    background: isActive ? "rgba(26,43,69,0.15)" : "rgba(255,255,255,0.1)",
                    color: isActive ? NAVY : "rgba(255,255,255,0.6)",
                  }}
                >
                  {m.tag}
                </span>
              </button>
            );
          })}
        </nav>

        <div className="px-5 py-4 text-xs" style={{ color: "rgba(255,255,255,0.35)", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
          Dati aggregati · non dispositivo medico
        </div>
      </aside>

      <main className="flex-1 flex flex-col">
        <header className="flex items-center justify-between px-8 py-5 bg-white border-b border-gray-200">
          <div>
            <h1 className="text-xl font-semibold" style={{ color: NAVY }}>{activeModule.label}</h1>
            <p className="text-xs text-gray-500 mt-0.5">{isRegionView ? asl : `ASL ${asl}`} · aggiornato oggi, 14 agosto 2026</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-400">
            <Search size={15} /> Cerca farmaco o codice ATC
          </div>
        </header>
        <div className="flex-1 p-8 overflow-auto">
          {screens[active]}
        </div>
      </main>
    </div>
  );
}
