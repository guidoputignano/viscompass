type AnnualKey={region:string;group:string;channel:string;year:number};
type SeriesShape={regions:Record<string,string>;annual:AnnualKey[];monthly:AnnualKey[];candidates:{group:string}[]};
/** Release only the rows needed for the selected panels; public values remain extractable. */
export function slicePublicSeries<T extends SeriesShape>(data:T,region:string,group:string,channel:string):T|null{
 if(!Object.hasOwn(data.regions,region)||!['antibiotics','antifungals'].includes(group)||!['direct','convenzionata'].includes(channel))return null;
 const selected=(r:AnnualKey)=>r.group===group&&r.channel===channel;
 return {...data,
  // All four combinations in the selected territory support the independent Sankey year selector.
  annual:data.annual.filter(r=>['antibiotics','antifungals'].includes(r.group)&&['direct','convenzionata'].includes(r.channel)&&(r.region===region||(r.year===2025&&selected(r)))),
  monthly:data.monthly.filter(r=>selected(r)&&((r.region==='000'&&[2023,2024,2025].includes(r.year))||(r.region===region&&r.year===2025))),
  candidates:data.candidates.filter(r=>r.group===group),
 };
}
