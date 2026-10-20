// The reviewer request matrix of the Pillar C data routes, serialised (status, headers, body, loader calls).
// Used to pin reviewer responses byte-identical to the implementation before recommendation 5.
// Synthetic identities; the reviewer loaders are stubs that echo their arguments.
export const REVIEWER_LOADER_STUBS={
  'lib/dashboard-review/pillar-c/attribution-loader.ts':`export async function loadCAttrView(approved,reviewer,period,org,channel){
      globalThis.__pcs.reads.push(['attribution',approved,reviewer,period,org,channel]);
      if(period==='JM2026'&&channel==='DPC')return {state:'invalid'};
      return {state:'ready',view:{schema:'pillar-c-attribution-view-v1',scope:{period,org,channel},comparison:{org},sourceSnapshot:'0'.repeat(64)}};}`,
  'lib/dashboard-review/pillar-c/portfolio-loader.ts':`export async function loadCPortfolioView(approved,reviewer,period,org,channel,portfolio){
      globalThis.__pcs.reads.push(['portfolio',approved,reviewer,period,org,channel,portfolio]);
      if(portfolio==='ZZ')return {state:'invalid'};
      return {state:'ready',view:{schema:'pillar-c-portfolio-view-v1',scope:{period,org,channel},portfolio}};}`,
  'lib/dashboard-review/pillar-c/workbook-loader.ts':`export async function loadCWorkbookSection(section,approved,reviewer){
      globalThis.__pcs.reads.push(['workbook',section,approved,reviewer]);
      return section==='costi'?{state:'invalid'}:{state:'ready',section:{schema:'pillar-c-workbook-section-v1',section}};}
    export async function loadCWorkbookIndex(approved,reviewer){globalThis.__pcs.reads.push(['workbook-index',approved,reviewer]);return {state:'invalid'};}`,
};

const ORIGIN='https://vis.test';
const QUERIES=[
  ...['FY2024','FY2025','JM2025','JM2026'].flatMap(period=>['Regione','AQ','CH','PE','TE'].flatMap(org=>['Tutti','CO','DD','DPC'].map(channel=>`period=${period}&org=${org}&channel=${channel}`))),
  'period=FY2025&org=AQ&org=TE&channel=Tutti','period=FY2025&org=TE&channel=Tutti&period=JM2026','period=FY2025&channel=Tutti','period=FY2025&org=&channel=Tutti',
  'period=FY2025&org=te&channel=Tutti','period=FY2025&org=%20TE&channel=Tutti','period=FY2025&org=TE%00&channel=Tutti','period=FY2025&org=Regione,TE&channel=Tutti',
  'period=FY2026&org=TE&channel=Tutti','period=FY2025&org=TE&channel=ALL','period=FY2025&org=asl-4&channel=Tutti','period=FY2025&org=aggregato&channel=Tutti','',
];
const PORTFOLIO_SUFFIX=['&portfolio=AA','&portfolio=ZZ','&portfolio=aa','&portfolio=ABCDEFGHIJKLM','','&portfolio=AA&portfolio=BB'];

async function serialise(response){
  const headers=['content-type','cache-control','vary','x-content-type-options','server-timing'].map(h=>[h,response.headers.get(h)]);
  return {status:response.status,headers,body:await response.text()};
}
/** Runs every request for each identity factory and returns one canonical JSON string. */
export async function reviewerRouteMatrix({attribution,portfolio,workbook},NextRequest,identities){
  const out=[];
  for(const [name,set] of identities){
    for(const q of QUERIES){
      const s=set();out.push([name,'attribution',q,await serialise(await attribution.GET(new NextRequest(`${ORIGIN}/api/pillar-c/attribution?${q}`))),s.reads]);
    }
    for(const q of QUERIES.filter((_,i)=>i%7===0||i>=80))for(const p of PORTFOLIO_SUFFIX){
      const s=set();out.push([name,'portfolio',q+p,await serialise(await portfolio.GET(new NextRequest(`${ORIGIN}/api/pillar-c/portfolio?${q}${p}`))),s.reads]);
    }
    for(const section of ['spesa','costi','evidenza','bogus','../index','']){
      const s=set();out.push([name,'workbook',section,await serialise(await workbook.GET(new NextRequest(`${ORIGIN}/api/pillar-c/workbook?section=${encodeURIComponent(section)}`))),s.reads]);
    }
  }
  return JSON.stringify(out);
}
