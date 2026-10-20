/** Presentation names and safe view models. Audit/formula plumbing stays internal. */
import { type CWorkbookOutput, type CWorkbookSectionId, type CWorkbookTable } from "@/lib/dashboard-review/pillar-c/workbook";
import { cMoneyDifference, cReviewFilters, cReviewSearch, C_ORGS, type CReviewFilters, type CReviewPacket } from "@/lib/dashboard-review/pillar-c/review";
import { C_ORG_LABELS } from "@/lib/dashboard-review/pillar-c/reviewer-labels";
export { cInsightResetSearch } from "@/lib/dashboard-review/pillar-c/reset-search";

export const C_INSIGHT_TITLES: Record<string, string> = {
  'O-09-04':'Qualità degli identificativi e classificazione ATC', 'O-09-05':'Rettifiche di spesa e quantità', 'O-09-06':'Copertura dei mesi osservati', 'O-09-07':'Spesa e rettifiche per periodo', 'O-09-08':'Prodotti distinti per ambito', 'O-10-01':'Quanto della spesa è attribuibile alle aree?', 'O-10-02':'Spesa per portafoglio terapeutico', 'O-10-03':'Spesa condivisa fra aree', 'O-10-04':'Aree esposte alla spesa condivisa', 'O-10-05':'Intervallo di attribuzione per area', 'O-10-06':'Quali evidenze risolvere per prime?', 'O-10-06/20':'Prodotti da approfondire', 'O-10-07':'Copertura della mappatura delle aree', 'O-10-08':'Quanto cambia usando una mappatura alternativa?',
  'O-11-01':'Composizione per area e qualità dell’attribuzione', 'O-11-02':'Composizione per classe ATC', 'O-11-03':'Variazioni delle quote di spesa', 'O-11-05':'Peso delle rettifiche per categoria', 'O-12-01':'Contributi alla variazione annuale', 'O-12-02':'Contributi alla variazione gennaio–maggio', 'O-12-03':'Quali aree spiegano la variazione?', 'O-12-04':'Prodotti che aumentano o riducono la spesa', 'O-12-05':'Contributi per classe ATC e area', 'O-12-06':'Quadratura dei contributi',
  'PC-05/05':'Criteri e stato della mappatura delle aree', 'PC-06/04':'Classificazione dei prodotti', 'O-13-05':'Spesa inclusa ed esclusa dalla scomposizione', 'O-13-04':'Copertura dei confronti fra prodotti', 'O-13-01':'Motivi di esclusione dal confronto', 'O-14-03':'Variazioni grezze e corrette per composizione', 'O-14-06':'Compatibilità fra fonti di spesa', 'O-14-01':'Composizione ATC e comparatori', 'O-14-02':'Portafogli terapeutici e comparatori',
  'O-04-01':'Corrispondenza fra territori e organizzazioni', 'O-15-03':'Popolazione residente di riferimento', 'O-15-04':'Spesa e contesto demografico', 'O-15-07':'Fonti contabili affiancate', 'O-16-01':'Budget approvati e revisioni', 'O-16-02':'Compatibilità del budget con il consuntivo', 'O-16-03':'Obiettivi e dati storici disponibili', 'O-16-04':'Disponibilità del confronto contabile', 'O-17-05':'Tendenze e sensibilità della stima', 'O-17-01':'Andamenti mensili della spesa', 'O-18-02':'Accuratezza dei metodi di riferimento', 'O-18-03':'Esito della valutazione dei modelli aziendali', 'O-18-04':'Scenari di spesa per il resto dell’anno', 'PC-19/SG':'Sensibilità alle ipotesi di classificazione', 'PC-20':'Priorità e prossimi approfondimenti', 'O-03-01':'Fonti utilizzate', 'O-03-03':'Idoneità delle fonti disponibili',
  'C3-05A-B':'Copertura prima e dopo la revisione della mappatura', 'C3-05A-C':'Prodotti che cambiano attribuzione', 'C3-05A-D':'Discordanze con i registri AIFA', 'C3-05A-H':'Impatto della revisione sulle aree', 'PUB-04':'Spesa regionale e nazionale nel tempo', 'PUB-01':'Spesa pubblica per residente', 'PUB-02':'Composizione per classe nel tempo', 'PUB-03':'Composizione ATC regionale e nazionale', 'PUB-05':'Spesa convenzionata per residente', 'PUB-07-10':'Attività ospedaliera di contesto', 'PUB-07-11':'Spesa regionale per ricovero acuto', 'PUB-07-03':'Dimissioni per gruppo diagnostico', 'SRC-DEF-01':'Qualità della fonte sull’attività ospedaliera',
  'ML-3-CO-R':'Spesa per persona nello scenario regionale CO', 'ML-3-SENS':'Sensibilità alla numerosità stimata', 'ML-3-CO-A':'Scenario CO per Azienda e area', 'PUB-09-v2':'Budget dipartimentali approvati', 'PUB-10':'Obiettivi pubblicati da un’altra Azienda', 'ML-1-COV':'Copertura dell’allocazione per area', 'ML-1-FY2025':'Spesa ripartita per disciplina nel 2025', 'ML-1-FY2024':'Spesa ripartita per disciplina nel 2024', 'ML-1-TE':'Ripartizione dipartimentale del 2024', 'ML-A03':'Perimetro coperto dal budget pubblicato', 'ML-2-TE24':'Budget pubblicato e spesa allocata', 'ML-2-FY2025':'Pianificazione modellata del 2025', 'ML-2-JM2026':'Pianificazione modellata gennaio–maggio 2026', 'ML-4-COV':'Copertura delle unità disponibili e imputate', 'ML-4-REAL':'Effetti di quantità, mix e costo unitario', 'ML-4-SYN':'Scomposizione con unità imputate', 'ML-4-PORT-REAL':'Scomposizione per portafoglio', 'ML-4-PORT-SYN':'Portafogli con unità imputate', 'ML-5-ADM':'Affidabilità dei modelli regionali', 'ML-5-FC':'Previsione regionale e intervalli', 'PC-03-C3':'Aggiornamento delle fonti pubbliche',
};
export const C_INSIGHT_DEFAULTS: Record<CWorkbookSectionId,string> = {spesa:'O-10-02',composizione:'O-11-02',attribuzione:'O-10-03',cambiamento:'O-12-04',costi:'ML-4-REAL',confronti:'O-14-03',attivita:'PUB-04',pianificazione:'PUB-09-v2',numerosita:'ML-3-SENS',tendenze:'O-17-01',previsione:'O-18-04',sensibilita:'PC-19/SG',priorita:'PC-20',evidenza:'O-03-03'};

// Admission and model-scoring records stay in the immutable verification dossier.
// The typed regional panel already presents ML-5-FC's monthly/annual results;
// duplicating its raw snapshot would expose audit rows and an unguarded change.
// No workbook evidence is altered by this presentation policy.
const FORECAST_DOSSIER_ONLY_OUTPUTS = new Set(['O-18-02', 'O-18-03', 'ML-5-ADM', 'ML-5-FC']);
export function cInsightDecisionOutputs(outputs: readonly CWorkbookOutput[], section: CWorkbookSectionId): CWorkbookOutput[] {
  return outputs.filter(o => o.section === section && o.availability === 'snapshot' && !FORECAST_DOSSIER_ONLY_OUTPUTS.has(o.id));
}

export function cInsightText(value: string): string {
  if (/^\s*[=+@](?:[A-Z]+\d|(?:SUM|IF|ROUND|VLOOKUP|SUMIFS)\s*\()/i.test(value)) return 'Dettaglio di calcolo riservato al dossier';
  return value.replace(/Degenza media ricalcolata\s*=\s*giornate\s*÷\s*dimessi/gi,'Degenza media (giorni)')
    .replace(/^Pendenza \(€\/mese\)$/,'Variazione tendenziale (€/mese)')
    .replace(/^SC-0 come 2025 \(€\)$/,'Scenario invariato (€)')
    .replace(/^SC-1 × rapporto Gen–Mag \(€\)$/,'Scenario di continuità (€)')
    .replace(/^SC-L × rapporto minimo \(€\)$/,'Scenario basso (€)')
    .replace(/^SC-H × rapporto massimo \(€\)$/,'Scenario alto (€)')
    .replace(/Sensibilità F\s*=\s*1:\s*/gi,'Scenario alternativo · ')
    .replace(/Δ R − O in formula/gi,'Differenza fra fonti contabili')
    .replace(/\b(20\d{2})\s*=\s*100\b/g,'base $1')
    .replace(/I\s*=\s*S1\s*∪\s*S2/g,'Spesa attribuibile alle aree')
    .replace(/\b(?:O-\d{2}-\d{2}(?:\/\d+)?|PC-\d{2}(?:-[A-Z0-9]+)*|ML-A\d+|I-12-\d)\b/g,'')
    .replace(/\bS1\b/g,'attribuzione locale confermata').replace(/\bS2\b/g,'attribuzione tramite portafoglio').replace(/\bS3\b/g,'condiviso fra aree').replace(/\bS4\b/g,'evidenza insufficiente').replace(/\bS5\b/g,'non mappato')
    .replace(/\bM v0\.1\b/g,'mappatura iniziale').replace(/\bM v0\.2\b/g,'mappatura rivista').replace(/\bM v0\b/g,'mappatura precedente').replace(/\bR0\b/g,'raggruppamento alternativo').replace(/\bV0\b/g,'classificazione alternativa')
    .replace(/\bv0\.1\b/gi,'mappatura iniziale').replace(/\bv0\.2\b/gi,'mappatura rivista')
    .replace(/\bML-1\b/g,'allocazione modellata').replace(/\bML-2\b/g,'budget modellato').replace(/\bML-3b?\b/g,'numerosità stimata').replace(/\bML-4b\b/g,'unità imputate').replace(/\bML-4\b/g,'scomposizione dei costi').replace(/\bML-5\b/g,'previsione regionale')
    .replace(/\bK1\b/g,'2024–2025').replace(/\bK2\b/g,'gen–mag 2025–2026').replace(/\bFY(20\d{2})\b/g,'$1').replace(/\bJM(20\d{2})\b/g,'gen–mag $1')
    .replace(/Σ\|C\|/g,'Importi assoluti').replace(/Σ/g,'Totale').replace(/G⁺/g,'Importi positivi').replace(/G⁻/g,'Rettifiche negative').replace(/Con segno/g,'Spesa netta').replace(/Δ/g,'Differenza')
    .replace(/\(file laterale\)|\(formula\)|\bformula\b|nel file laterale/gi,'').replace(/\b(?:B-C|B-E|B-X|B-N)\b/g,m=>({'B-C':'prodotti presenti in entrambi i periodi','B-E':'prodotti entrati','B-X':'prodotti usciti','B-N':'identificativi non classificabili'}[m]!))
    .replace(/\bAQ\b/g,'ASL 1').replace(/\bCH\b/g,'ASL 2').replace(/\bPE\b/g,'ASL 3').replace(/\bTE\b/g,'ASL 4')
    .replace(/\s+·\s+·\s+/g,' · ').replace(/\s{2,}/g,' ').replace(/^\s*[·:;,–-]+\s*|\s*[·:;,–-]+\s*$/g,'').trim();
}
export function cInsightVisibleColumns(table:CWorkbookTable, output?:string) {
  // Hide audit plumbing, not financial totals or materiality merely because
  // their source heading mentions a sum/formula. Those results keep their values.
  return table.columns.flatMap((h,c)=>{
    if (/crit\.|residu[io]|riconciliazione|F_Fatti|∈|\bcoerenza\b|^parametri$|^esito \(|^controllo:|^requisito a h/i.test(h)) return [];
    if (output === 'O-18-04' && /^(?:Σ 7 mesi arrotondati SC-0|Differenza di arrotondamento SC-0)/.test(h)) return [];
    if (output === 'O-17-05' && /^(?:Pendenza sui 24 mesi|Pendenza winsorizzata|Stabilità del segno)/.test(h)) return [];
    return [c];
  });
}
export function cInsightCellText(value:string):string {
  if (/^(?:=|SUM\(|SUMIFS\(|IF\(|ROUND\()/i.test(value.trim()) || /[∈∪]|\bSUMSQ\b|\bSUMIFS\b|\$[A-Z]+\$?\d/.test(value)) return 'Dettaglio metodologico';
  return cInsightText(value);
}
/** A saved selector view has an explicit scope; global scope never pretends to apply. */
export function cInsightScope(table:CWorkbookTable):string|null {
  if(table.sheet==='07_Ambiguity_Value'||table.sheet==='09_Composition'||(table.sheet==='08_Spend_Overview'&&table.headerRow>=150))return 'Aggregato delle quattro Aziende · tutti i canali · selezione di riferimento';
  if(table.sheet==='10_Change_Contributions'&&table.headerRow>=79)return 'Aggregato delle quattro Aziende · dettaglio per il confronto indicato';
  return null;
}
export function cInsightBlockName(table:CWorkbookTable,index:number):string {
  const note=table.notes.flatMap(([,notes])=>notes).find(n=>/^[A-Z][\d.]?\.\s/.test(n));
  return note?cInsightText(note.replace(/^[A-Z][\d.]?\.\s*/,'')):`Dettaglio ${index+1}`;
}
export function cDecisionAnswer(packet:CReviewPacket,filters:CReviewFilters) {
  const [p0,p1]=filters.comparison==='K1'?['FY2024','FY2025']:['JM2025','JM2026'];
  const baseline=(period:string)=>packet.baseline.find(r=>r.period===period&&r.org===filters.org&&r.channel===filters.channel);
  const left=baseline(p0),right=baseline(p1),continuing=packet.bridges.find(r=>r.comparison===filters.comparison&&r.org===filters.org&&r.channel===filters.channel&&r.component==='B-C');
  return {change:left&&right?cMoneyDifference(right.net,left.net):null,continuing:continuing?.value??null,scope:`${C_ORG_LABELS[filters.org]} · ${filters.channel==='Tutti'?'tutti i canali':filters.channel}`,peopleObserved:false as const};
}
export function cBudgetOpening(packet:CReviewPacket,filters:CReviewFilters,explicit:boolean) {
  if(explicit)return filters;
  const first=packet.budgets.find(r=>r.basis==='published'&&r.actual!==null&&r.level==='Dipartimento')??packet.budgets.find(r=>r.actual!==null);
  return first?{...filters,org:first.org,channel:first.channel,budgetPeriod:first.period,budget:first.basis,level:first.level,area:'all'}:filters;
}

/** Budget scope is local, bookmarkable and independent of the spend scope. */
export function cBudgetFilters(packet:CReviewPacket,search:URLSearchParams):CReviewFilters {
  const explicit = [...search.keys()].some(k => /^c_(?:budget|level|area)(?:_|$)/.test(k));
  const filters = cBudgetOpening(packet,cReviewFilters(search),explicit);
  const org = search.get('c_budget_org'), channel = search.get('c_budget_channel');
  return {...filters,
    org: C_ORGS.includes(org as CReviewFilters['org']) && org !== 'Regione' ? org as CReviewFilters['org'] : filters.org,
    channel: ['CO','DD','DPC'].includes(channel ?? '') ? channel as CReviewFilters['channel'] : filters.channel,
  };
}
export function cBudgetSearch(packet:CReviewPacket,search:string,patch:Partial<CReviewFilters>):string {
  const local = {...cBudgetFilters(packet,new URLSearchParams(search)),...patch};
  const {org,channel,budgetPeriod,budget,level,budgetOrder,area}=local;
  const params=new URLSearchParams(cReviewSearch(search,{budgetPeriod,budget,level,budgetOrder,area}));
  params.set('c_budget_org',org);params.set('c_budget_channel',channel);
  return `?${params}`;
}

/** Multiple years/channels must not become indistinguishable bars labelled only ASL. */
export function cInsightRowName(table:CWorkbookTable,cells:CWorkbookTable['rows'][number],fallback:string):string {
  const parts=table.columns.flatMap((h,c)=> /^(?:confronto|periodo|anno|azienda|canale|ambito|classe|stato|livello|tipo|serie|variante|scenario)(?:\s|$)/i.test(h)&&(!table.numericColumns.includes(c)||/^(?:anno|mese|periodo)$/i.test(h))
    ? [Array.isArray(cells[c]) ? cells[c][0] : typeof cells[c]==='string' ? cells[c] : ''] : []);
  return [...new Set([fallback,...parts].filter(Boolean).map(cInsightCellText))].join(' · ');
}
