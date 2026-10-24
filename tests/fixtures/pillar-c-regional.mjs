// Synthetic regional objects of the Regione (regional analytical parity): the price/quantity/mix object and the review
// object (modelled budgets, provenance), serialised as the private build writes them, with the pins a test installs in
// place of regional-storage.ts. Invented values only.
import {createHash} from 'node:crypto';

const sha256=b=>createHash('sha256').update(b).digest('hex');
export const C_TEST_WORKBOOK='f8fe8b13f10eab51194b057f52dd11a599d28d827ce92438b1043837c60894bb';
export const C_TEST_COSTI='c'.repeat(64);
const n=raw=>[String(raw),164];

/** One ML-4-PORT-REAL row for portfolio AA, admitted at 60-70 % support. */
export function regionalPvmObject(label='Portafoglio sintetico A'){
  const table={sheet:'12A_ML4_Price_Vol_Mix',range:'A209:L234',startColumn:1,
    columns:['Portafoglio','Nome','Esito','Copertura t0','Copertura t1','Δ ammesso (€)','Quantità · Shapley (€)','Mix · Shapley (€)','Mix · LMDI (€)','Costo unitario · Shapley (€)','Livello','Stato di verifica'],
    headerRow:209,rows:[['AA',label,'parziale (50–80 %)',n('0.6'),n('0.7'),n('4'),n('6'),n('1'),n('0.8'),n('-3'),'Solo descrittivo','V2_IN_ATTESA']],sourceRows:[210],notes:[],numericColumns:[3,4,5,6,7,8,9]};
  const output={id:'ML-4-PORT-REAL',title:'Invented test only',section:'costi',tier:'Solo descrittivo',qualifier:'mappatura in bozza',grain:'portafoglio',ranges:['12A_ML4_Price_Vol_Mix!A209:L234'],availability:'snapshot',reason:null,sourceState:'WAIT-W',tables:[table]};
  return {schema:'pillar-c-regional-pvm-v1',workbookSha256:C_TEST_WORKBOOK,costiSha256:C_TEST_COSTI,formats:{164:'#,##0.00 "€"'},output};
}
/** Two modelled rows for ASL 1 and one for ASL 3, and the provenance of five sections. */
export function regionalReviewObject(){
  const row=(unit,i,area,level='Disciplina',period='FY2025',channel='CO')=>({id:`${unit}-m-${String(i).padStart(4,'0')}`,period,org:unit,channel,level,area,basis:'synthetic',budget:`${1000+i}.00`,actual:`${900+i}.5`,alternative:`${950+i}.25`});
  return {schema:'pillar-c-regional-review-v1',workbookVersion:'R5',workbookSha256:C_TEST_WORKBOOK,
    evidence:{financial:'a'.repeat(64),budgetCount:'b'.repeat(64)},sections:['spend','change','budget','counts','forecast'],
    budgets:[row('asl-1',1,'08'),row('asl-1',2,'09'),row('asl-3',1,'12','Dipartimento','JM2026','DD')]};
}
/** Files at their regional paths and the pins of regional-storage.ts. */
export function regionalFixture({pvm=regionalPvmObject(),review=regionalReviewObject()}={}){
  const files=new Map(),pins={root:'v9',costiSha256:C_TEST_COSTI};
  for(const [key,prefix,object] of [['pvm','pvm',pvm],['review','revisione',review]]){
    const body=Buffer.from(JSON.stringify(object)+'\n'),sha=sha256(body),name=`${prefix}-${sha}.json`;
    files.set(`v9/regione/${name}`,body);pins[key]={name,sha256:sha,bytes:body.length};
  }
  return {files,pins};
}
