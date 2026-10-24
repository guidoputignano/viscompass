// Page-level stubs for app/dashboard-review/pillar-c/page.tsx: the reviewer loaders, the public forecast
// loader and the three client components are replaced by recorders, so the server component's branches and
// the exact props it hands to the client can be asserted. Synthetic data only.
export const PAGE_STUBS={
  'lib/dashboard-review/pillar-c/review-loader.ts':`export async function loadCReviewPacket(approved,reviewer){globalThis.__pcs.reads.push(['review',approved,reviewer]);return globalThis.__pcs.review;}`,
  'lib/dashboard-review/pillar-c/workbook-loader.ts':`export async function loadCWorkbookIndex(approved,reviewer){globalThis.__pcs.reads.push(['workbook-index',approved,reviewer]);return globalThis.__pcs.workbook;}`,
  // The extension loaders (January DPC, File F) are recorded apart, so the rest of each branch is still compared as before.
  'lib/dashboard-review/pillar-c/extension-loader.ts':`export async function loadCExtensionReviewer(approved,reviewer){(globalThis.__pcs.extReads??=[]).push(['extension-reviewer',approved,reviewer]);return globalThis.__pcs.extension??{state:'unavailable'};}export async function loadCExtensionScoped(audience,db,labels){(globalThis.__pcs.extReads??=[]).push(['extension-scoped',[...audience.units],audience.units.map(labels)]);return globalThis.__pcs.extension??{state:'unavailable'};}`,
  'lib/dashboard-review/pillar-c/regional-forecast-loader.ts':`export async function loadCRegionalForecast(approved){globalThis.__pcs.reads.push(['forecast',approved]);return globalThis.__pcs.forecast;}`,
  // The additions loaders (P8-03, P10-04, P10-05; owner decision D24-4) are recorded apart too. The page's check of the
  // additions against the extension (additions-parse.ts cAdditionsWithExtension) is the real one.
  'lib/dashboard-review/pillar-c/additions-loader.ts':`export async function loadCAdditionsReviewer(approved,reviewer){(globalThis.__pcs.addReads??=[]).push(['additions-reviewer',approved,reviewer]);return globalThis.__pcs.additions??{state:'unavailable'};}export async function loadCAdditionsScoped(audience,db,labels){(globalThis.__pcs.addReads??=[]).push(['additions-scoped',[...audience.units],audience.units.map(labels)]);return globalThis.__pcs.additions??{state:'unavailable'};}`,
  // The reviewer workspace's mandatory audience (interface step) is recorded apart, so the rest of the branch is still
  // compared with the page before recommendation 5. The page imports it through its dynamic wrapper
  // (reviewer-workspace.tsx, review finding UI-4), which exports the same component name.
  'components/dashboard-review/pillar-c/reviewer-workspace.tsx':`export function PillarCAnalyticalWorkspace({audience,extension,extensionUnavailable,additions,additionsUnavailable,...props}){globalThis.__pcs.rendered.push(['PillarCAnalyticalWorkspace',props]);(globalThis.__pcs.extensionUnavailable??=[]).push(extensionUnavailable);(globalThis.__pcs.audiences??=[]).push(audience);(globalThis.__pcs.extensions??=[]).push(extension);(globalThis.__pcs.additionsShown??=[]).push(additions);(globalThis.__pcs.additionsUnavailable??=[]).push(additionsUnavailable);return null;}`,
  'components/dashboard-review/pillar-c/regional-forecast-workspace.tsx':`export function PillarCRegionalForecastWorkspace(props){globalThis.__pcs.rendered.push(['PillarCRegionalForecastWorkspace',props]);return null;}`,
  'components/dashboard-review/pillar-c/scoped-workspace.tsx':`export function PillarCScopedWorkspace({extension,extensionUnavailable,additions,additionsUnavailable,...props}){globalThis.__pcs.rendered.push(['PillarCScopedWorkspace',props]);(globalThis.__pcs.extensionUnavailable??=[]).push(extensionUnavailable);(globalThis.__pcs.extensions??=[]).push(extension);(globalThis.__pcs.additionsShown??=[]).push(additions);(globalThis.__pcs.additionsUnavailable??=[]).push(additionsUnavailable);return null;}`,
};

/** Renders the page for every reviewer-path and no-membership identity; returns one canonical JSON string. */
export async function reviewerPageMatrix(PillarCPage,renderToStaticMarkup,cases){
  const out=[];
  for(const [name,set] of cases){
    const state=set();state.rendered=[];
    const html=renderToStaticMarkup(await PillarCPage());
    out.push([name,html,state.rendered,state.reads]);
  }
  return JSON.stringify(out);
}

export function reviewerPageCases({as,ORGS,viewer,packet}){
  const client=()=>({rpc:async()=>({data:[],error:null}),auth:{getUser:async()=>({data:{user:null},error:null})},storage:{from(){throw Error('no storage');}}});
  const ready={state:'ready',packet},wb={state:'ready',index:{schema:'pillar-c-workbook-index-v1',synthetic:true}};
  const forecast={state:'ready',data:{forecast:{synthetic:'forecast'}}};
  const with_=(id,extra)=>()=>Object.assign(as({client,...id}),{review:ready,workbook:wb,forecast,...extra});
  return [
    ['anonymous',with_({org:null,viewer:null},{})],
    ['pending',with_({org:null,viewer:viewer(false)},{})],
    ['reviewerWithoutMembership',with_({org:null,viewer:viewer(true)},{})],
    ['reviewer ready',with_({org:ORGS['asl-4'],viewer:viewer(true)},{})],
    ['reviewer ready, no workbook',with_({org:ORGS['asl-4'],viewer:viewer(true)},{workbook:{state:'invalid'}})],
    ['reviewer invalid',with_({org:ORGS['asl-1'],viewer:viewer(true)},{review:{state:'invalid'}})],
    ['reviewer not configured',with_({org:ORGS['asl-1'],viewer:viewer(true)},{review:{state:'not_configured'}})],
    ['admin ready',with_({org:ORGS.regione,viewer:viewer(false,'admin@example.org'),admin:'admin@example.org'},{})],
  ];
}
