"use client";

import { useEffect, useMemo, useState } from "react";
import { assignAbcBands } from "@/lib/analytics/abc-bands";
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip, Cell } from "recharts";

// One territory-and-channel slice, served by /api/pillar-a/atc4. The compiled
// table is not delivered whole: the server releases only the slice on screen.
// [yearIdx, codeIdx, spendEur, packs]
type Row = [number, number, number, number];
type Atc4 = {years:number[];codes:{code:string;label:string}[];rows:Row[]};

// Categorical slots 1-6 of the validated theme, assigned in fixed order and never cycled.
const SERIES=["var(--viz-1)","var(--viz-2)","var(--viz-3)","var(--viz-4)","var(--viz-5)","var(--viz-6)"];
// A/B/C are three bands of one ranking, so they reuse the first three slots.
const BANDS:Record<string,string>={A:"var(--viz-1)",B:"var(--viz-2)",C:"var(--viz-3)"};
const TOP_N=6;
// Theme tokens, not fixed light values: the tooltip was white-on-navy text
// floating over a dark page in dark mode.
const tipStyle={borderRadius:12,border:"1px solid hsl(var(--border))",background:"hsl(var(--card))",color:"hsl(var(--card-foreground))",boxShadow:"0 12px 30px rgba(0,0,0,.18)"};
const nf=(v:number,d=0)=>new Intl.NumberFormat("it-IT",{maximumFractionDigits:d}).format(v);
const compact=(v:number)=>new Intl.NumberFormat("it-IT",{notation:"compact",maximumFractionDigits:1}).format(v);
const labelOf=(data:Atc4,code:string)=>data.codes.find(c=>c.code===code)?.label??"";

export function PillarAAtc4({region,regionName,group,channel}:{region:string;regionName:string;group:string;channel:string}){
  const [data,setData]=useState<Atc4|null>(null);
  const [view,setView]=useState<"trend"|"abc">("trend");
  useEffect(()=>{
    const c=new AbortController();
    setData(null);
    const q=new URLSearchParams({region,channel,group});
    fetch(`/api/pillar-a/atc4?${q}`,{signal:c.signal}).then(r=>r.ok?r.json():Promise.reject()).then(setData).catch(()=>{});
    return()=>c.abort();
  },[region,channel,group]);

  const model=useMemo(()=>{
    if(!data||!data.codes.length)return null;
    const label=(i:number)=>data.codes[i].code;
    const lastYear=data.years.length-1;
    // Latest-year ranking drives both which series are drawn and the ABC bands.
    const latest=data.rows.filter(r=>r[0]===lastYear).map(r=>({code:label(r[1]),spend:r[2]})).filter(r=>r.spend>0).sort((a,b)=>b.spend-a.spend);
    if(!latest.length)return null;
    const total=latest.reduce((s,r)=>s+r.spend,0);
    // Shared banding rule: the band follows the cumulative share of the items
    // ranked ahead of this one, matching the private workbook exactly.
    const abc=assignAbcBands(latest,r=>r.spend,r=>r.code);
    const top=latest.slice(0,TOP_N).map(r=>r.code);
    const series=data.years.map((year,y)=>{
      const point:Record<string,number|null|string>={year};
      for(const code of top){
        const ci=data.codes.findIndex(c=>c.code===code);
        point[code]=data.rows.find(r=>r[0]===y&&r[1]===ci)?.[2]??null;
      }
      return point;
    });
    const shownShare=total>0?top.reduce((s,c)=>s+(latest.find(r=>r.code===c)?.spend??0),0)/total:0;
    return {abc,top,series,total,shownShare,lastYear:data.years[lastYear]};
  },[data]);

  if(!data||!model||!model.abc.length)return null;
  const {abc,top,series,total,shownShare,lastYear}=model;

  return <section className="min-w-0 rounded-2xl border bg-card p-5 shadow-sm sm:p-6">
    <div className="mb-6 flex flex-wrap items-start justify-between gap-x-8 gap-y-4">
      <div className="min-w-0 grow basis-72">
        <h2 className="font-display text-xl font-semibold">Categorie ATC4 · andamento e concentrazione</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{regionName} · {channel==="direct"?"Acquisti diretti":"Convenzionata"}. Il livello ATC4 è il dettaglio più fine pubblicato da AIFA: raggruppa più principi attivi e non corrisponde alla singola molecola. Le classi AWaRe non sono derivabili da questo livello.</p>
      </div>
      <label className="flex w-full min-w-0 flex-col gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:w-60 sm:shrink-0">Vista
        <select className="h-11 rounded-lg border bg-background px-3 text-sm font-medium normal-case tracking-normal text-foreground" value={view} onChange={e=>setView(e.target.value as "trend"|"abc")}>
          <option value="trend">Andamento nel tempo</option>
          <option value="abc">Concentrazione della spesa (ABC)</option>
        </select>
      </label>
    </div>

    {view==="trend"?<>
      <div className="mb-4 flex flex-wrap gap-x-5 gap-y-2 text-xs">{top.map((code,i)=><span key={code} className="flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{background:SERIES[i]}}/>{code} · {labelOf(data,code)}</span>)}</div>
      <div className="h-80" role="img" aria-label={`Spesa annuale per categoria ATC4, ${regionName}`}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={series} margin={{left:0,right:15,top:10,bottom:5}}>
            <CartesianGrid strokeDasharray="3 5" vertical={false} stroke="#dbe5e8"/>
            <XAxis dataKey="year" tick={{fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis tickFormatter={compact} tick={{fontSize:11}} width={65} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={tipStyle} formatter={(v,n)=>[`€ ${nf(Number(v))}`,String(n)]}/>
            {top.map((code,i)=><Line key={code} type="linear" dataKey={code} stroke={SERIES[i]} strokeWidth={2} dot={{r:3}} connectNulls={false}/>)}
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">Le {top.length} categorie più rilevanti nel {lastYear} rappresentano il {nf(shownShare*100,1)}% della spesa di quell’anno. Le celle mancanti non diventano zero.</p>
    </>:<>
      <div className="h-80" role="img" aria-label={`Concentrazione della spesa per categoria ATC4 nel ${lastYear}`}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={abc.slice(0,12)} layout="vertical" margin={{left:0,right:20,top:5,bottom:5}}>
            <CartesianGrid strokeDasharray="3 5" horizontal={false} stroke="#dbe5e8"/>
            <XAxis type="number" tickFormatter={v=>`${v}%`} tick={{fontSize:11}} axisLine={false} tickLine={false}/>
            <YAxis type="category" dataKey="code" width={62} tick={{fontSize:11}} axisLine={false} tickLine={false}/>
            <Tooltip contentStyle={tipStyle} formatter={(v,_n,p)=>[`${nf(Number(v),1)}% · € ${nf(p.payload.spend)} · banda ${p.payload.band}`,p.payload.code]}/>
            <Bar dataKey={(d:{share:number})=>d.share*100} radius={[0,4,4,0]}>
              {abc.slice(0,12).map(r=><Cell key={r.code} fill={BANDS[r.band]}/>)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-xs">{Object.entries(BANDS).map(([band,color])=>{
        const n=abc.filter(r=>r.band===band).length, s=abc.filter(r=>r.band===band).reduce((a,r)=>a+r.share,0);
        return <span key={band} className="flex items-center gap-2"><span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{background:color}}/>Banda {band}: {n} categorie · {nf(s*100,1)}% della spesa</span>;
      })}</div>
      <div className="mt-4 max-h-64 overflow-auto"><table className="w-full text-left text-sm"><thead className="sticky top-0 bg-card text-xs text-muted-foreground"><tr><th className="p-2">ATC4</th><th className="p-2">Categoria</th><th className="p-2 text-right">Spesa {lastYear}</th><th className="p-2 text-right">Quota</th><th className="p-2 text-right">Cumulata</th><th className="p-2 text-right">Banda</th></tr></thead><tbody>{abc.map(r=><tr key={r.code} className="border-t"><td className="p-2 font-mono">{r.code}</td><td className="p-2">{labelOf(data,r.code)}</td><td className="p-2 text-right font-mono tabular-nums">€ {nf(r.spend)}</td><td className="p-2 text-right font-mono tabular-nums">{nf(r.share*100,1)}%</td><td className="p-2 text-right font-mono tabular-nums">{nf(r.cumulativeShare*100,1)}%</td><td className="p-2 text-right font-mono">{r.band}</td></tr>)}</tbody></table></div>
      <p className="mt-4 text-xs text-muted-foreground">ABC ordina le categorie per spesa {lastYear} (totale € {nf(total)}): la banda segue la quota cumulata delle categorie che precedono, quindi la categoria che supera la soglia resta nella banda inferiore: A sotto l’80%, B sotto il 95%, C il resto. Il grafico riporta le prime 12 categorie; la tabella le elenca tutte e {abc.length}. Descrive dove si concentra la spesa, non l’efficacia né l’appropriatezza.</p>
    </>}
  </section>;
}
