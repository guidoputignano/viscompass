"use client";
import {ResponsiveContainer,LineChart,Line,CartesianGrid,XAxis,YAxis,Tooltip} from 'recharts';

type Point={year:number;ordinary_days:number;day_accesses:number};
const number=(v:number)=>new Intl.NumberFormat('it-IT').format(v);
export function PillarAActivityChart({data,field,title}:{data:Point[];field:'ordinary_days'|'day_accesses';title:string}){
  const ordered=[...data].sort((a,b)=>a.year-b.year);
  const values=ordered.map(r=>r[field]);
  const min=Math.min(...values),max=Math.max(...values);
  const pad=Math.max((max-min)*0.2,max*0.015,1);
  const domain:[number,number]=[Math.max(0,Math.floor(min-pad)),Math.ceil(max+pad)];
  return <div className="min-w-0 rounded-xl border bg-background/40 p-4">
    <h3 className="text-sm font-semibold">{title}</h3>
    <p className="mb-4 mt-2 text-xs text-muted-foreground">Scala verticale adattata: {number(domain[0])}–{number(domain[1])}. Non parte necessariamente da zero.</p>
    <div className="h-64 text-muted-foreground" role="img" aria-label={`${title}, andamento annuale con scala adattata`}>
      <ResponsiveContainer width="100%" height="100%"><LineChart data={ordered} margin={{top:15,right:20,bottom:5,left:5}}>
        <CartesianGrid vertical={false} stroke="currentColor" strokeOpacity={0.2} strokeDasharray="3 5"/>
        <XAxis dataKey="year" tick={{fill:'currentColor',fontSize:11}} axisLine={false} tickLine={false}/>
        <YAxis domain={domain} tickFormatter={number} width={85} tick={{fill:'currentColor',fontSize:11}} axisLine={false} tickLine={false}/>
        <Tooltip contentStyle={{background:'hsl(var(--card))',color:'hsl(var(--foreground))',borderRadius:12,border:'1px solid hsl(var(--border))'}} formatter={v=>[number(Number(v)),title]}/>
        <Line type="linear" dataKey={field} stroke="#21b8aa" strokeWidth={3} dot={{r:5,fill:'#21b8aa'}} activeDot={{r:7}} isAnimationActive={false}/>
      </LineChart></ResponsiveContainer>
    </div>
    <table className="mt-4 w-full text-xs tabular-nums"><thead><tr className="text-muted-foreground"><th className="py-2 text-left">Anno</th><th className="text-right">Valore</th><th className="text-right">Δ anno precedente</th></tr></thead><tbody>{ordered.map((r,i)=>{
      const previous=ordered[i-1];const change=previous&&previous.year===r.year-1&&previous[field]!==0?(r[field]/previous[field]-1)*100:null;
      return <tr key={r.year} className="border-t"><td className="py-2">{r.year}</td><td className="text-right font-medium">{number(r[field])}</td><td className="text-right">{change===null?'—':`${change>=0?'+':''}${change.toLocaleString('it-IT',{minimumFractionDigits:1,maximumFractionDigits:1})}%`}</td></tr>;
    })}</tbody></table>
  </div>;
}
